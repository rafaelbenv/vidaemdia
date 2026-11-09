import { Module } from '@nestjs/common';
import { CalendarsService } from './calendars.service';
import { CalendarsController } from './calendars.controller';
import { CalendarAccessService } from './calendar-access.service';
import { MonitoringModule } from '../monitoring/monitoring.module';

@Module({
  imports: [MonitoringModule],
  controllers: [CalendarsController],
  providers: [CalendarsService, CalendarAccessService],
  exports: [CalendarsService, CalendarAccessService],
})
export class CalendarsModule {}

