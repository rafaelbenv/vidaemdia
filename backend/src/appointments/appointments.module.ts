import { Module } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { AppointmentsController } from './appointments.controller';
import { CalendarsModule } from '../calendars/calendars.module';
import { MonitoringModule } from '../monitoring/monitoring.module';

@Module({
  imports: [CalendarsModule, MonitoringModule],
  controllers: [AppointmentsController],
  providers: [AppointmentsService],
  exports: [AppointmentsService],
})
export class AppointmentsModule {}

