import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';
import { UserRole } from '@prisma/client';
import { NotificationWorker } from './notification.worker';
import { NotificationProvider } from './notification.provider';
import { PrismaService } from '../prisma/prisma.service';
import { BotService } from './bot.service';
import { JwtAuthGuard, RbacGuard, Roles } from '../auth/jwt-auth.guard';

export class SimulateBotMessageDto {
  @ApiProperty({
    example: 'Marcar Consulta Odontológica amanhã às 15:30',
    description: 'Mensagem enviada ao Chatbot (ex.: "/agenda", "/start", "/ajuda", "Marcar Reunião amanhã às 14:00")',
  })
  @IsString()
  @IsNotEmpty()
  text: string;

  @ApiPropertyOptional({ enum: ['TELEGRAM'], default: 'TELEGRAM' })
  @IsOptional()
  @IsString()
  channel?: string;

  @ApiPropertyOptional({ description: 'Identificador do remetente (ignorado no simulador)' })
  @IsOptional()
  @IsString()
  senderIdentifier?: string;
}

export class SimulateFailureDto {
  @ApiPropertyOptional({ default: 1, description: 'Quantidade de próximas requisições ao Telegram que devem falhar para testar o Retry (máx. 3)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  failCount?: number;
}

@ApiTags('Notificações (Worker Telegram) & Chatbot Webhook')
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
  @ApiOperation({ summary: 'Retorna status do Worker de Notificações, fila de lembretes e mensagens disparadas no Telegram' })
  async getStatus(@Req() req: any) {
    const userId = req.user?.sub || req.user?.id;
    const role = req.user?.role;

    const calendarFilter = {
      OR: [
        { ownerId: userId },
        { permissions: { some: { granteeUserId: userId, canView: true } } },
      ],
    };

    const reminders = await this.prisma.reminder.findMany({
      ...(role !== 'ADMIN'
        ? {
            where: {
              appointment: {
                calendar: calendarFilter,
              },
            },
          }
        : {}),
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

    let dispatchedMessages = this.provider.getDispatchedMessages();

    if (role !== 'ADMIN') {
      const ids = Array.from(
        new Set(
          dispatchedMessages
            .map((m) => m.appointmentId)
            .filter((id): id is string => Boolean(id)),
        ),
      );

      const visibleAppointments = await this.prisma.appointment.findMany({
        where: {
          id: { in: ids },
          calendar: calendarFilter,
        },
        select: {
          id: true,
          isPrivate: true,
          calendar: { select: { ownerId: true } },
        },
      });

      const visibleIds = new Set(
        visibleAppointments
          .filter((a: any) => !a.isPrivate || a.calendar?.ownerId === userId)
          .map((a: any) => a.id),
      );
      dispatchedMessages = dispatchedMessages.filter((m) =>
        visibleIds.has(m.appointmentId),
      );
    }

    return {
      worker: this.worker.getWorkerStatus(),
      reminders,
      dispatchedMessages,
    };
  }

  @Post('executar-worker')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @Roles(UserRole.PROFESSIONAL, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Dispara imediatamente um ciclo do Worker de Notificações (sem precisar aguardar os 5 minutos) (Profissional e Admin)' })
  async triggerWorkerNow() {
    return this.worker.processPendingReminders();
  }

  @Post('simular-falha')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @Roles(UserRole.PROFESSIONAL, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Configura o simulador para falhar nas próximas N entregas para demonstrar o Retry (máx. 3 tentativas) (Profissional e Admin)' })
  async simulateFailure(@Body() dto: SimulateFailureDto) {
    return this.provider.setSimulateFailureCount(dto.failCount ?? 1);
  }

  /**
   * Simulador do chatbot (Telegram)
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
      channel: 'TELEGRAM',
      chatId,
      text: dto.text,
      ip: req.ip,
    });

    return { botReply };
  }
}
