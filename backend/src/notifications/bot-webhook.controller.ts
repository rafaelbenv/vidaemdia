import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';
import { NotificationWorker } from './notification.worker';
import { NotificationProvider } from './notification.provider';
import { PrismaService } from '../prisma/prisma.service';
import { BotService } from './bot.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

export class SimulateBotMessageDto {
  @ApiProperty({
    example: 'Marcar Consulta Odontológica amanhã às 15:30',
    description: 'Mensagem enviada ao Chatbot (ex.: "/agenda", "/start", "/ajuda", "Marcar Reunião amanhã às 14:00")',
  })
  @IsString()
  @IsNotEmpty()
  text: string;

  @ApiPropertyOptional({ enum: ['WHATSAPP', 'TELEGRAM'], default: 'TELEGRAM' })
  @IsOptional()
  @IsString()
  channel?: string;

  @ApiPropertyOptional({ description: 'Identificador do remetente (ignorado no simulador)' })
  @IsOptional()
  @IsString()
  senderIdentifier?: string;
}

export class SimulateFailureDto {
  @ApiPropertyOptional({ default: 1, description: 'Quantidade de próximas requisições ao WhatsApp/Telegram que devem falhar para testar o Retry (máx. 3)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  failCount?: number;
}

@ApiTags('Notificações (Worker WhatsApp/Telegram) & Chatbot Webhook')
@Controller('notificacoes')
export class BotWebhookController {
  constructor(
    private readonly worker: NotificationWorker,
    private readonly provider: NotificationProvider,
    private readonly prisma: PrismaService,
    private readonly botService: BotService,
  ) {}

  @Get('status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Retorna status do Worker de Notificações, fila de lembretes e mensagens disparadas no WhatsApp/Telegram' })
  async getStatus() {
    const reminders = await this.prisma.reminder.findMany({
      include: {
        appointment: {
          include: {
            calendar: { select: { id: true, name: true, type: true } },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });

    return {
      worker: this.worker.getWorkerStatus(),
      reminders,
      dispatchedMessages: this.provider.getDispatchedMessages(),
    };
  }

  @Post('executar-worker')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Dispara imediatamente um ciclo do Worker de Notificações (sem precisar aguardar os 5 minutos)' })
  async triggerWorkerNow() {
    return this.worker.processPendingReminders();
  }

  @Post('simular-falha')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Configura o simulador para falhar nas próximas N entregas para demonstrar o Retry (máx. 3 tentativas)' })
  async simulateFailure(@Body() dto: SimulateFailureDto) {
    return this.provider.setSimulateFailureCount(dto.failCount ?? 1);
  }

  /**
   * Simulador do chatbot (WhatsApp / Telegram)
   * Recebe { text }, usa o telegramChatId do usuário autenticado (ou sim:userId se não vinculado) e retorna { botReply }
   */
  @Post('bot/webhook')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Simulador do chatbot' })
  async handleBotMessage(@Body() dto: SimulateBotMessageDto, @Req() req: any) {
    const userId = req.user?.sub || req.user?.id;
    const user = userId
      ? await this.prisma.user.findUnique({
          where: { id: userId },
          select: { telegramChatId: true },
        })
      : null;

    const telegramChatId = user?.telegramChatId || req.user?.telegramChatId;
    const chatId = telegramChatId ? String(telegramChatId) : `sim:${userId}`;

    const botReply = await this.botService.handleMessage({
      channel: (dto.channel as any) || 'TELEGRAM',
      chatId,
      text: dto.text,
      ip: req.ip,
    });

    return { botReply };
  }
}
