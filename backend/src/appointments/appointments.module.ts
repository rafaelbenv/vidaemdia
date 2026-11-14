import { Module } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { AppointmentsController } from './appointments.controller';
import { ConflictService } from './conflict.service';
import { CalendarsModule } from '../calendars/calendars.module';
import { MonitoringModule } from '../monitoring/monitoring.module';
import { GoogleModule } from '../google/google.module';

@Module({
  imports: [CalendarsModule, MonitoringModule, GoogleModule],
  controllers: [AppointmentsController],
  providers: [AppointmentsService, ConflictService],
  exports: [AppointmentsService, ConflictService],
})
export class AppointmentsModule {}

