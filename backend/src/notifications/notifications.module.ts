import { Module } from '@nestjs/common';
import { NotificationProvider } from './notification.provider';
import { NotificationWorker } from './notification.worker';
import { BotWebhookController } from './bot-webhook.controller';
import { BotService } from './bot.service';
import { AppointmentsModule } from '../appointments/appointments.module';
import { MonitoringModule } from '../monitoring/monitoring.module';

@Module({
  imports: [AppointmentsModule, MonitoringModule],
  controllers: [BotWebhookController],
  providers: [NotificationProvider, NotificationWorker, BotService],
  exports: [NotificationProvider, NotificationWorker, BotService],
})
export class NotificationsModule {}
