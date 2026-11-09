import { Global, Module } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { TelegramWebhookController } from './telegram-webhook.controller';
import { TelegramLinkService } from './telegram-link.service';
import { TelegramLinkController } from './telegram-link.controller';
import { MonitoringModule } from '../monitoring/monitoring.module';

@Global()
@Module({
  imports: [MonitoringModule],
  controllers: [TelegramWebhookController, TelegramLinkController],
  providers: [TelegramService, TelegramLinkService],
  exports: [TelegramService, TelegramLinkService],
})
export class TelegramModule {}
