import { Injectable } from '@nestjs/common';
import { AppointmentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ConflictService {
  constructor(private readonly prisma: PrismaService) {}

  async recalculateCalendar(calendarId: string): Promise<void> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const appointments = await this.prisma.appointment.findMany({
      where: {
        calendarId,
        status: AppointmentStatus.SCHEDULED,
        allDay: false,
        endTime: { gte: oneDayAgo },
      },
      select: {
        id: true,
        startTime: true,
        endTime: true,
        hasConflict: true,
      },
      orderBy: { startTime: 'asc' },
    });

    const conflictSet = new Set<string>();
    let maxEndTime: Date | null = null;
    let maxEndId: string | null = null;

    for (const appt of appointments) {
      const start =
        appt.startTime instanceof Date ? appt.startTime : new Date(appt.startTime);
      const end =
        appt.endTime instanceof Date ? appt.endTime : new Date(appt.endTime);

      if (
        maxEndTime !== null &&
        maxEndId !== null &&
        start.getTime() < maxEndTime.getTime()
      ) {
        conflictSet.add(maxEndId);
        conflictSet.add(appt.id);
      }

      if (maxEndTime === null || end.getTime() > maxEndTime.getTime()) {
        maxEndTime = end;
        maxEndId = appt.id;
      }
    }

    const conflictIds = Array.from(conflictSet);

    if (conflictIds.length > 0) {
      await this.prisma.appointment.updateMany({
        where: {
          calendarId,
          id: { in: conflictIds },
          hasConflict: false,
        },
        data: {
          hasConflict: true,
        },
      });
    }

    await this.prisma.appointment.updateMany({
      where: {
        calendarId,
        ...(conflictIds.length > 0 ? { id: { notIn: conflictIds } } : {}),
        hasConflict: true,
      },
      data: {
        hasConflict: false,
      },
    });
  }
}
