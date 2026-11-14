import { BadRequestException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { AppointmentStatus, CalendarType, NotificationChannel, ReminderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CalendarAccessService } from '../calendars/calendar-access.service';
import { MetricsService } from '../monitoring/metrics.service';
import { CreateAppointmentDto, UpdateAppointmentDto } from './dto/appointment.dto';
import { GoogleSyncQueueService } from '../google/google-sync-queue.service';
import { ConflictService } from './conflict.service';
import { addDays, allDayRemindAt, normalizeAllDayRange } from './all-day.util';

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly calendarAccess: CalendarAccessService,
    private readonly metricsService: MetricsService,
    private readonly conflictService: ConflictService,
    @Optional() private readonly googleSyncQueue?: GoogleSyncQueueService,
  ) {}

  async findAllForCalendar(userId: string, userRole: string, calendarId: string, ipAddress?: string) {
    // Etapa 3 do Fluxo RBAC: Verifica JWT + papel + permissão de visualização na agenda
    await this.calendarAccess.verifyAccessOrThrow(userId, userRole, calendarId, 'VIEW', ipAddress);

    const appointments = await this.prisma.appointment.findMany({
      where: { calendarId },
      include: {
        createdBy: { select: { id: true, name: true, email: true, role: true } },
        reminders: { orderBy: { createdAt: 'desc' } },
        calendar: {
          include: { owner: { select: { id: true, name: true, telegramChatId: true } } },
        },
      },
      orderBy: { startTime: 'asc' },
    });

    return appointments.map((appt) => {
      const ownerId = appt.calendar?.owner?.id || (appt as any).calendar?.ownerId;
      if (appt.isPrivate && userId !== ownerId) {
        return {
          ...appt,
          title: 'Ocupado',
          description: null,
        };
      }
      return appt;
    });
  }

  private computeRemindAt(startTime: Date, minutesBefore: number): Date {
    return new Date(startTime.getTime() - minutesBefore * 60 * 1000);
  }

  /**
   * Implementa exatamente as etapas 5, 6 e 7 do Fluxo Principal e a Dupla Checagem do Fluxo RBAC:
   * - NestJS valida autenticação + RBAC + dados do compromisso
   * - Verifica conflito de horários em agendas profissionais
   * - Salva no PostgreSQL (Usuário, Agenda, Título, Data, Horário, Descrição, Config. lembrete, Status)
   * - Grava log de auditoria (quem criou / quando)
   * - Retorna 201 Created
   */
  async create(
    userId: string,
    userRole: string,
    dto: CreateAppointmentDto,
    createdVia: 'WEB' | 'TELEGRAM' = 'WEB',
    ipAddress?: string,
  ) {
    // Dupla checagem RBAC para criação na agenda alvo
    const { calendar, isDelegated } = await this.calendarAccess.verifyAccessOrThrow(
      userId,
      userRole,
      dto.calendarId,
      'CREATE',
      ipAddress,
    );

    const rawStartTime = new Date(dto.startTime);
    if (isNaN(rawStartTime.getTime())) {
      throw new BadRequestException('Data/horário de início inválido');
    }

    const allDay = dto.allDay === true;
    let startTime: Date;
    let endTime: Date;

    if (allDay) {
      const normalized = normalizeAllDayRange(
        rawStartTime,
        dto.endTime ? new Date(dto.endTime) : undefined,
      );
      startTime = normalized.startTime;
      endTime = normalized.endTime;
    } else {
      startTime = rawStartTime;
      endTime = dto.endTime
        ? new Date(dto.endTime)
        : new Date(startTime.getTime() + 60 * 60 * 1000); // Padrão: 1 hora de duração

      if (endTime <= startTime) {
        throw new BadRequestException('O horário de término deve ser posterior ao horário de início');
      }
    }

    // Validação de Conflito de Horários (Double-Booking) em agendas profissionais
    if (!allDay && calendar.type === CalendarType.PROFESSIONAL) {
      const conflict = await this.prisma.appointment.findFirst({
        where: {
          calendarId: dto.calendarId,
          status: AppointmentStatus.SCHEDULED,
          allDay: false,
          AND: [
            { startTime: { lt: endTime } },
            { endTime: { gt: startTime } },
          ],
        },
      });

      if (conflict) {
        throw new BadRequestException(
          `Conflito de horário: Já existe o compromisso "${conflict.title}" agendado neste período na agenda profissional.`,
        );
      }
    }

    const reminderMinutesBefore = dto.reminderMinutesBefore ?? 30;
    const remindAt = allDay
      ? allDayRemindAt(startTime)
      : this.computeRemindAt(startTime, reminderMinutesBefore);

    const channel = dto.reminderChannel || NotificationChannel.TELEGRAM;

    const data: any = {
      calendarId: dto.calendarId,
      createdById: userId,
      title: dto.title.trim(),
      description: dto.description?.trim() || null,
      startTime,
      endTime,
      allDay,
      reminderMinutesBefore,
      status: AppointmentStatus.SCHEDULED,
      createdVia,
    };

    if (dto.reminderEnabled !== false) {
      data.reminders = {
        create: {
          remindAt,
          channel,
          status: ReminderStatus.PENDING,
        },
      };
    }

    const appointment = await this.prisma.appointment.create({
      data,
      include: {
        createdBy: { select: { id: true, name: true, email: true, role: true } },
        reminders: true,
        calendar: {
          include: { owner: { select: { id: true, name: true, email: true } } },
        },
      },
    });

    this.metricsService.incrementAppointmentCreated(createdVia);

    const titleLabel = appointment.isPrivate
      ? 'Compromisso privado'
      : `Compromisso "${appointment.title}"`;

    const metadata: any = {
      startTime: appointment.startTime,
      endTime: appointment.endTime,
      allDay: appointment.allDay,
      reminderChannel: channel,
      reminderMinutesBefore,
      isDelegated,
      createdVia,
    };
    if (!appointment.isPrivate) {
      metadata.title = appointment.title;
    }

    await this.auditService.log({
      actorUserId: userId,
      targetCalendarId: dto.calendarId,
      entityType: 'APPOINTMENT',
      entityId: appointment.id,
      action: 'CREATE',
      details: `${isDelegated ? '[Fluxo RBAC Delegado] ' : ''}${titleLabel} criado na agenda "${calendar.name}" via ${createdVia}.`,
      metadata,
      ipAddress,
    });

    await this.conflictService.recalculateCalendar(dto.calendarId);

    const fresh = await this.prisma.appointment.findUnique({
      where: { id: appointment.id },
      select: { hasConflict: true },
    });
    if (fresh) {
      appointment.hasConflict = fresh.hasConflict;
    }

    if (calendar.googleCalendarId && this.googleSyncQueue) {
      const syncOp =
        appointment.status === AppointmentStatus.CANCELLED ? 'DELETE' : 'UPSERT';
      await this.googleSyncQueue.enqueue(appointment.id, syncOp);
    }

    return appointment;
  }

  async update(
    userId: string,
    userRole: string,
    appointmentId: string,
    dto: UpdateAppointmentDto,
    ipAddress?: string,
  ) {
    const existing = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { reminders: { orderBy: { createdAt: 'desc' } } },
    });

    if (!existing) {
      throw new NotFoundException('Compromisso não encontrado');
    }

    const operation = dto.status === AppointmentStatus.CANCELLED ? 'CANCEL' : 'UPDATE';
    const { calendar, isDelegated } = await this.calendarAccess.verifyAccessOrThrow(
      userId,
      userRole,
      existing.calendarId,
      operation,
      ipAddress,
    );

    const allDay = dto.allDay !== undefined ? dto.allDay : (existing.allDay ?? false);
    let startTime: Date;
    let endTime: Date;

    if (allDay) {
      const startInput = dto.startTime ? new Date(dto.startTime) : existing.startTime;
      const endInput = dto.endTime
        ? new Date(dto.endTime)
        : (dto.startTime ? undefined : addDays(existing.endTime, -1));
      const normalized = normalizeAllDayRange(startInput, endInput);
      startTime = normalized.startTime;
      endTime = normalized.endTime;
    } else {
      startTime = dto.startTime ? new Date(dto.startTime) : existing.startTime;
      if (existing.allDay && !allDay && !dto.endTime) {
        endTime = new Date(startTime.getTime() + 60 * 60 * 1000);
      } else if (dto.startTime && !dto.endTime) {
        endTime = new Date(startTime.getTime() + (existing.endTime.getTime() - existing.startTime.getTime()));
      } else if (dto.endTime) {
        endTime = new Date(dto.endTime);
      } else {
        endTime = existing.endTime;
      }

      if (endTime <= startTime) {
        throw new BadRequestException('O horário de término deve ser posterior ao horário de início');
      }
    }

    const allDayChanged = allDay !== existing.allDay;
    const timeChanged =
      allDayChanged ||
      startTime.getTime() !== existing.startTime.getTime() ||
      endTime.getTime() !== existing.endTime.getTime();

    if (!allDay && operation === 'UPDATE' && calendar.type === CalendarType.PROFESSIONAL && timeChanged) {
      const conflict = await this.prisma.appointment.findFirst({
        where: {
          calendarId: existing.calendarId,
          id: { not: appointmentId },
          status: AppointmentStatus.SCHEDULED,
          allDay: false,
          AND: [
            { startTime: { lt: endTime } },
            { endTime: { gt: startTime } },
          ],
        },
      });

      if (conflict) {
        throw new BadRequestException(
          `Conflito de horário: Já existe o compromisso "${conflict.title}" agendado neste período na agenda profissional.`,
        );
      }
    }

    const reminderMinutesBefore = dto.reminderMinutesBefore ?? existing.reminderMinutesBefore;

    const isPrivateNonOwner = existing.isPrivate && userId !== calendar.ownerId;
    const targetTitle = isPrivateNonOwner ? existing.title : (dto.title ?? existing.title);
    const targetDescription = isPrivateNonOwner
      ? existing.description
      : (dto.description !== undefined ? dto.description : existing.description);

    await this.prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        title: targetTitle,
        description: targetDescription,
        startTime,
        endTime,
        allDay,
        reminderMinutesBefore,
        status: dto.status ?? existing.status,
      },
    });

    if (operation === 'UPDATE') {
      const existingReminders = existing.reminders ?? [];
      const enabled =
        dto.reminderEnabled ??
        existingReminders.some(
          (r) =>
            r.status === ReminderStatus.PENDING ||
            r.status === ReminderStatus.SENT ||
            r.status === ReminderStatus.FAILED,
        );

      const minutesChanged =
        dto.reminderMinutesBefore !== undefined &&
        dto.reminderMinutesBefore !== existing.reminderMinutesBefore;

      if (enabled === false) {
        await this.prisma.reminder.deleteMany({
          where: { appointmentId, status: ReminderStatus.PENDING },
        });
      } else if (
        enabled === true &&
        (timeChanged ||
          minutesChanged ||
          dto.reminderEnabled === true ||
          dto.reminderChannel)
      ) {
        const remindAt = allDay
          ? allDayRemindAt(startTime)
          : this.computeRemindAt(startTime, reminderMinutesBefore);
        const hasPending = existingReminders.some((r) => r.status === ReminderStatus.PENDING);

        if (hasPending) {
          await this.prisma.reminder.updateMany({
            where: { appointmentId, status: ReminderStatus.PENDING },
            data: {
              remindAt,
              ...(dto.reminderChannel ? { channel: dto.reminderChannel } : {}),
            },
          });
        } else {
          const alreadyExists = existingReminders.some(
            (r) => r.remindAt && new Date(r.remindAt).getTime() === remindAt.getTime(),
          );

          if ((allDay ? endTime > new Date() : remindAt > new Date()) && !alreadyExists) {
            const channel =
              dto.reminderChannel ??
              existingReminders[0]?.channel ??
              NotificationChannel.TELEGRAM;

            await this.prisma.reminder.create({
              data: {
                appointmentId,
                remindAt,
                channel,
                status: ReminderStatus.PENDING,
              },
            });
          }
        }
      }
    }

    await this.conflictService.recalculateCalendar(existing.calendarId);

    const updated = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        createdBy: { select: { id: true, name: true, email: true, role: true } },
        reminders: { orderBy: { createdAt: 'desc' } },
      },
    });

    const isPrivate = updated?.isPrivate ?? existing.isPrivate;
    const titleLabel = isPrivate
      ? 'Compromisso privado'
      : `Compromisso "${updated?.title ?? existing.title}"`;

    const beforeMetadata: any = {
      startTime: existing.startTime,
      endTime: existing.endTime,
      allDay: existing.allDay,
      status: existing.status,
    };
    if (!isPrivate) {
      beforeMetadata.title = existing.title;
    }

    const afterMetadata: any = {
      startTime: updated.startTime,
      endTime: updated.endTime,
      allDay: updated.allDay,
      status: updated.status,
    };
    if (!isPrivate) {
      afterMetadata.title = updated.title;
    }

    await this.auditService.log({
      actorUserId: userId,
      targetCalendarId: existing.calendarId,
      entityType: 'APPOINTMENT',
      entityId: appointmentId,
      action: operation,
      details: `${isDelegated ? '[Fluxo RBAC Delegado] ' : ''}${titleLabel} ${
        operation === 'CANCEL' ? 'cancelado' : 'atualizado'
      } na agenda "${calendar.name}".`,
      metadata: {
        before: beforeMetadata,
        after: afterMetadata,
        isDelegated,
      },
      ipAddress,
    });

    if (calendar.googleCalendarId && this.googleSyncQueue && updated) {
      const syncOp =
        updated.status === AppointmentStatus.CANCELLED ? 'DELETE' : 'UPSERT';
      await this.googleSyncQueue.enqueue(updated.id, syncOp);
    }

    return updated;
  }

  async cancel(userId: string, userRole: string, appointmentId: string, ipAddress?: string) {
    return this.update(
      userId,
      userRole,
      appointmentId,
      { status: AppointmentStatus.CANCELLED },
      ipAddress,
    );
  }
}

