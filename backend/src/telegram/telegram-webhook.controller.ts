import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { TelegramService } from './telegram.service';
import { TelegramUpdate } from './telegram.types';

@ApiTags('Telegram Webhook')
@Controller('telegram')
export class TelegramWebhookController {
  private readonly logger = new Logger(TelegramWebhookController.name);

  constructor(private readonly telegramService: TelegramService) {}

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Endpoint do Webhook oficial da Bot API do Telegram' })
  @ApiResponse({ status: 200, description: 'Update recebido e aceito' })
  @ApiResponse({ status: 401, description: 'Secret token ausente ou inválido' })
  async handleWebhook(
    @Headers('x-telegram-bot-api-secret-token') secretHeader: string | undefined,
    @Body() update: TelegramUpdate,
  ) {
    const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

    if (!expectedSecret || secretHeader !== expectedSecret) {
      this.logger.warn('Webhook do Telegram rejeitado: secret token ausente ou inválido');
      throw new UnauthorizedException('Secret token inválido');
    }

    void this.telegramService.dispatchUpdate(update).catch((err) => {
      this.logger.error(`Erro ao processar update no webhook: ${err?.message || err}`);
    });

    return { ok: true };
  }
}
