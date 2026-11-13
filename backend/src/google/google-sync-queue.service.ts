import { Injectable } from '@nestjs/common';
import { AppointmentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type GoogleSyncOperation = 'UPSERT' | 'DELETE';
export type GoogleSyncStatus = 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED';

@Injectable()
export class GoogleSyncQueueService {
  constructor(private readonly prisma: PrismaService) {}

  async enqueue(
    appointmentId: string,
    operation: GoogleSyncOperation,
    tx?: any,
  ) {
    const db = tx ?? this.prisma;
    const existing = await (db as any).googleSyncJob.findFirst({
      where: {
        appointmentId,
        status: 'PENDING',
      },
    });

    if (existing) {
      return (db as any).googleSyncJob.update({
        where: { id: existing.id },
        data: {
          operation,
          nextRetryAt: null,
        },
      });
    }

    return (db as any).googleSyncJob.create({
      data: {
        appointmentId,
        operation,
        status: 'PENDING',
        nextRetryAt: null,
      },
    });
  }

  async enqueueCalendar(calendarId: string) {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const appointments = await this.prisma.appointment.findMany({
      where: {
        calendarId,
        status: AppointmentStatus.SCHEDULED,
        endTime: { gte: oneDayAgo },
      },
      select: { id: true },
    });

    for (const appt of appointments) {
      await this.enqueue(appt.id, 'UPSERT');
    }
  }

  async dropCalendar(calendarId: string) {
    await (this.prisma as any).googleSyncJob.deleteMany({
      where: {
        status: 'PENDING',
        appointment: {
          calendarId,
        },
      },
    });

    await (this.prisma as any).appointment.updateMany({
      where: { calendarId },
      data: {
        googleEventId: null,
        googleSyncError: null,
        googleSyncedAt: null,
      },
    });
  }
}
