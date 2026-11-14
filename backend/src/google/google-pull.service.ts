import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  AppointmentStatus,
  NotificationChannel,
  ReminderStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { MetricsService } from '../monitoring/metrics.service';
import { GoogleAccountService } from './google-account.service';
import { GoogleCalendarClient } from './google-calendar.client';
import { GoogleInvalidGrantError } from './google-oauth.client';
import { googleConfig } from './google.config';
import { fromGoogleEvent } from './google-event.mapper';
import { allDayRemindAt } from '../appointments/all-day.util';
import { ConflictService } from '../appointments/conflict.service';

export interface PullCounters {
  created: number;
  updated: number;
  cancelled: number;
  ignored: number;
}

export interface PullAllResult extends PullCounters {
  calendars: number;
  errors: number;
}

@Injectable()
export class GooglePullService {
  private readonly logger = new Logger(GooglePullService.name);
  private isRunning = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly googleAccountService: GoogleAccountService,
    private readonly calendarClient: GoogleCalendarClient,
    private readonly auditService: AuditService,
    private readonly metricsService: MetricsService,
    private readonly conflictService: ConflictService,
  ) {}

  @Cron(process.env.GOOGLE_PULL_CRON_EXPRESSION || '*/1 * * * *')
  async pullAll(): Promise<PullAllResult> {
    const cfg = googleConfig();
    if (!cfg.configured) {
      return {
        calendars: 0,
        created: 0,
        updated: 0,
        cancelled: 0,
        ignored: 0,
        errors: 0,
      };
    }

    if (this.isRunning) {
      return {
        calendars: 0,
        created: 0,
        updated: 0,
        cancelled: 0,
        ignored: 0,
        errors: 0,
      };
    }

    this.isRunning = true;
    try {
      const calendars = await this.prisma.calendar.findMany({
        where: {
          googleCalendarId: { not: null },
        },
      });

      let totalCreated = 0;
      let totalUpdated = 0;
      let totalCancelled = 0;
      let totalIgnored = 0;
      let totalErrors = 0;

      for (const cal of calendars) {
        try {
          const res = await this.pullCalendar(cal.id);
          totalCreated += res.created;
          totalUpdated += res.updated;
          totalCancelled += res.cancelled;
          totalIgnored += res.ignored;
        } catch (err: any) {
          totalErrors++;
          this.logger.error(
            `Erro ao sincronizar agenda ${cal.id} do Google: ${err?.message || err}`,
          );
        }
      }

      return {
        calendars: calendars.length,
        created: totalCreated,
        updated: totalUpdated,
        cancelled: totalCancelled,
        ignored: totalIgnored,
        errors: totalErrors,
      };
    } finally {
      this.isRunning = false;
    }
  }

  async pullCalendarForOwner(
    userId: string,
    calendarId: string,
  ): Promise<PullCounters> {
    const calendar = await this.prisma.calendar.findUnique({
      where: { id: calendarId },
    });

    if (!calendar) {
      throw new NotFoundException('Agenda não encontrada');
    }

    if (calendar.ownerId !== userId) {
      throw new ForbiddenException('Só o dono da agenda pode sincronizá-la.');
    }

    if (!calendar.googleCalendarId) {
      throw new BadRequestException('Agenda não está ligada ao Google Agenda.');
    }

    return this.pullCalendar(calendarId);
  }

  async pullCalendar(calendarId: string): Promise<PullCounters> {
    const calendar = await this.prisma.calendar.findUnique({
      where: { id: calendarId },
    });

    if (!calendar || !calendar.googleCalendarId) {
      return { created: 0, updated: 0, cancelled: 0, ignored: 0 };
    }

    let token: string;
    try {
      token = await this.googleAccountService.getAccessToken(calendar.ownerId);
    } catch (err: any) {
      let message: string;
      if (err instanceof GoogleInvalidGrantError) {
        message = 'Conexão com o Google expirou; conecte de novo.';
      } else if (err instanceof NotFoundException) {
        message = 'O dono da agenda não tem o Google conectado.';
      } else {
        message = err?.message || 'Erro ao obter token do Google.';
      }

      await (this.prisma as any).calendar.update({
        where: { id: calendar.id },
        data: { googleSyncError: message },
      });
      this.metricsService.incrementGoogleSync('erro');
      throw err;
    }

    let created = 0;
    let updated = 0;
    let cancelled = 0;
    let ignored = 0;

    let syncToken = (calendar as any).googleSyncToken as
      | string
      | null
      | undefined;
    let hasRetriedAfter410 = false;
    let nextSyncToken: string | undefined = undefined;

    try {
      let pageToken: string | undefined = undefined;

      while (true) {
        let res: {
          items: any[];
          nextPageToken?: string;
          nextSyncToken?: string;
        };

        const opts: {
          syncToken?: string;
          timeMin?: string;
          timeMax?: string;
          pageToken?: string;
        } = {};

        if (pageToken) {
          opts.pageToken = pageToken;
        }

        if (syncToken) {
          opts.syncToken = syncToken;
        } else {
          const now = new Date();
          opts.timeMin = new Date(
            now.getTime() - 24 * 60 * 60 * 1000,
          ).toISOString();
          opts.timeMax = new Date(
            now.getTime() + 60 * 24 * 60 * 60 * 1000,
          ).toISOString();
        }

        try {
          res = await this.calendarClient.listEvents(
            token,
            calendar.googleCalendarId,
            opts,
          );
        } catch (err: any) {
          if (err?.status === 410 && !hasRetriedAfter410) {
            hasRetriedAfter410 = true;
            await (this.prisma as any).calendar.update({
              where: { id: calendar.id },
              data: { googleSyncToken: null },
            });
            syncToken = null;
            pageToken = undefined;
            created = 0;
            updated = 0;
            cancelled = 0;
            ignored = 0;
            continue;
          }
          throw err;
        }

        for (const ev of res.items) {
          const outcome = await this.applyEvent(calendar, ev);
          if (outcome === 'created') created++;
          else if (outcome === 'updated') updated++;
          else if (outcome === 'cancelled') cancelled++;
          else if (outcome === 'ignored') ignored++;
        }

        if (res.nextSyncToken) {
          nextSyncToken = res.nextSyncToken;
        }

        if (res.nextPageToken) {
          pageToken = res.nextPageToken;
        } else {
          break;
        }
      }

      if (created + updated + cancelled > 0) {
        await this.conflictService.recalculateCalendar(calendar.id);
      }

      await (this.prisma as any).calendar.update({
        where: { id: calendar.id },
        data: {
          googleSyncToken: nextSyncToken ?? null,
          googleLastSyncAt: new Date(),
          googleSyncError: null,
        },
      });
      this.metricsService.incrementGoogleSync('ok');

      return { created, updated, cancelled, ignored };
    } catch (err: any) {
      const message = err?.message || String(err);
      await (this.prisma as any).calendar.update({
        where: { id: calendar.id },
        data: {
          googleSyncError: `Não foi possível receber do Google: ${message}`,
        },
      });
      this.metricsService.incrementGoogleSync('erro');
      throw err;
    }
  }

  private async applyEvent(
    calendar: any,
    ev: any,
  ): Promise<'created' | 'updated' | 'cancelled' | 'ignored'> {
    // 1. Achar o compromisso local, nesta ordem:
    // { calendarId, googleEventId: ev.id }; senão, se ev.extendedProperties?.private?.vidaemdiaId,
    // { id: vidaemdiaId, calendarId }. Chamar o achado de appt.
    let appt: any = null;
    if (ev.id) {
      appt = await (this.prisma as any).appointment.findFirst({
        where: { calendarId: calendar.id, googleEventId: ev.id },
      });
    }

    const vidaemdiaId = ev.extendedProperties?.private?.vidaemdiaId;
    if (!appt && vidaemdiaId) {
      appt = await (this.prisma as any).appointment.findFirst({
        where: { id: vidaemdiaId, calendarId: calendar.id },
      });
    }

    // Achado pelo vidaemdiaId sem googleEventId grava googleEventId/googleEtag antes de decidir
    if (appt && !appt.googleEventId && vidaemdiaId) {
      await (this.prisma as any).appointment.update({
        where: { id: appt.id },
        data: {
          googleEventId: ev.id,
          googleEtag: ev.etag ?? null,
        },
      });
      appt.googleEventId = ev.id;
      appt.googleEtag = ev.etag ?? null;
    }

    // 2. Última alteração vence:
    // - Se existe job com status PROCESSING → ignorar (o próximo ciclo vê de novo)
    // - Se existe job PENDING: comparar new Date(ev.updated) com appt.updatedAt:
    //   Google mais novo (ou ev.updated ausente → considera o local mais novo, ignora):
    //   marcar o job como DONE com lastError: 'Substituído por alteração mais recente no Google Agenda', claimedAt/claimedBy: null, e seguir aplicando
    //   Local mais novo ou igual → ignorar
    if (appt) {
      const activeJob = await (this.prisma as any).googleSyncJob.findFirst({
        where: {
          appointmentId: appt.id,
          status: { in: ['PENDING', 'PROCESSING'] },
        },
      });

      if (activeJob) {
        if (activeJob.status === 'PROCESSING') {
          return 'ignored';
        }

        if (activeJob.status === 'PENDING') {
          if (!ev.updated) {
            return 'ignored';
          }

          const googleUpdated = new Date(ev.updated);
          if (isNaN(googleUpdated.getTime())) {
            return 'ignored';
          }

          const localUpdatedAt = appt.updatedAt
            ? new Date(appt.updatedAt)
            : new Date(0);

          if (googleUpdated.getTime() > localUpdatedAt.getTime()) {
            await (this.prisma as any).googleSyncJob.update({
              where: { id: activeJob.id },
              data: {
                status: 'DONE',
                lastError:
                  'Substituído por alteração mais recente no Google Agenda',
                claimedAt: null,
                claimedBy: null,
              },
            });
          } else {
            return 'ignored';
          }
        }
      }
    }

    // 3. Convite recusado: antes de cancelled, se ev.attendees?.some((a) => a.self && a.responseStatus === 'declined')
    const isDeclined =
      Array.isArray(ev.attendees) &&
      ev.attendees.some(
        (a: any) => a?.self && a?.responseStatus === 'declined',
      );

    if (isDeclined) {
      if (!appt || appt.status === AppointmentStatus.CANCELLED) {
        return 'ignored';
      }

      await (this.prisma as any).appointment.update({
        where: { id: appt.id },
        data: {
          status: AppointmentStatus.CANCELLED,
          googleEventId: ev.id,
          googleEtag: ev.etag ?? appt.googleEtag ?? null,
          googleSyncedAt: new Date(),
        },
      });

      await (this.prisma as any).reminder.deleteMany({
        where: {
          appointmentId: appt.id,
          status: ReminderStatus.PENDING,
        },
      });

      const titleLabel = appt.isPrivate
        ? 'Compromisso privado'
        : `Compromisso "${appt.title}"`;

      await this.auditService.log({
        actorUserId: undefined,
        targetCalendarId: calendar.id,
        entityType: 'APPOINTMENT',
        entityId: appt.id,
        action: 'CANCEL',
        details: `${titleLabel} cancelado: convite recusado no Google Agenda`,
        metadata: { source: 'GOOGLE', googleEventId: ev.id },
      });

      return 'cancelled';
    }

    // 4. ev.status === 'cancelled':
    // - sem appt ou appt.status === CANCELLED → ignorar;
    // - senão: appt.status = CANCELLED, googleEtag = ev.etag ?? appt.googleEtag, googleSyncedAt = agora; apagar os lembretes PENDING dele;
    //   auditoria { actorUserId: undefined, targetCalendarId, entityType: 'APPOINTMENT', entityId: appt.id, action: 'CANCEL',
    //   details: 'Compromisso "<título>" cancelado via Google Agenda', metadata: { source: 'GOOGLE', googleEventId: ev.id } }. Conta cancelled.
    // - Não enfileirar DELETE (o evento já sumiu do Google).
    if (ev.status === 'cancelled') {
      if (!appt || appt.status === AppointmentStatus.CANCELLED) {
        return 'ignored';
      }

      await (this.prisma as any).appointment.update({
        where: { id: appt.id },
        data: {
          status: AppointmentStatus.CANCELLED,
          googleEventId: ev.id,
          googleEtag: ev.etag ?? appt.googleEtag ?? null,
          googleSyncedAt: new Date(),
        },
      });

      await (this.prisma as any).reminder.deleteMany({
        where: {
          appointmentId: appt.id,
          status: ReminderStatus.PENDING,
        },
      });

      const titleLabel = appt.isPrivate
        ? 'Compromisso privado'
        : `Compromisso "${appt.title}"`;

      await this.auditService.log({
        actorUserId: undefined,
        targetCalendarId: calendar.id,
        entityType: 'APPOINTMENT',
        entityId: appt.id,
        action: 'CANCEL',
        details: `${titleLabel} cancelado via Google Agenda`,
        metadata: { source: 'GOOGLE', googleEventId: ev.id },
      });

      return 'cancelled';
    }

    // 5. fromGoogleEvent(ev) devolve null (evento sem data válida) → ignorar.
    const mapped = fromGoogleEvent(ev);
    if (!mapped) {
      return 'ignored';
    }

    // 6. Existe appt e appt.googleEtag === ev.etag → ignorar (é o eco do próprio envio).
    if (appt && appt.googleEtag && ev.etag && appt.googleEtag === ev.etag) {
      return 'ignored';
    }

    // 7. Existe appt (etag diferente) → update com title, description, startTime, endTime, allDay = mapped.allDay, isPrivate = mapped.isPrivate, googleEventId = ev.id, googleEtag = ev.etag,
    // googleSyncedAt = agora, googleSyncError = null. Se estava CANCELLED e o evento voltou ativo, volta para SCHEDULED.
    // Lembretes: se há lembrete PENDING, atualizar o remindAt (se mapped.allDay: allDayRemindAt; senão startTime − reminderMinutes);
    // se startTime/endTime ainda válido e não há lembrete PENDING nem SENT, criar um PENDING (canal TELEGRAM). Auditoria action: 'UPDATE'.
    if (appt) {
      const newStatus =
        appt.status === AppointmentStatus.CANCELLED
          ? AppointmentStatus.SCHEDULED
          : appt.status;

      await (this.prisma as any).appointment.update({
        where: { id: appt.id },
        data: {
          title: mapped.title,
          description: mapped.description,
          startTime: mapped.startTime,
          endTime: mapped.endTime,
          allDay: mapped.allDay,
          isPrivate: mapped.isPrivate,
          googleEventId: ev.id,
          googleEtag: ev.etag ?? null,
          googleSyncedAt: new Date(),
          googleSyncError: null,
          status: newStatus,
        },
      });

      const reminderMinutes = appt.reminderMinutesBefore ?? 30;
      const targetRemindAt = mapped.allDay
        ? allDayRemindAt(mapped.startTime)
        : new Date(
            mapped.startTime.getTime() - reminderMinutes * 60 * 1000,
          );

      const pendingReminder = await (this.prisma as any).reminder.findFirst({
        where: {
          appointmentId: appt.id,
          status: ReminderStatus.PENDING,
        },
      });

      if (pendingReminder) {
        await (this.prisma as any).reminder.updateMany({
          where: {
            appointmentId: appt.id,
            status: ReminderStatus.PENDING,
          },
          data: {
            remindAt: targetRemindAt,
          },
        });
      } else if (
        mapped.allDay
          ? mapped.endTime.getTime() > Date.now()
          : mapped.startTime.getTime() > Date.now()
      ) {
        const sentReminder = await (this.prisma as any).reminder.findFirst({
          where: {
            appointmentId: appt.id,
            status: ReminderStatus.SENT,
          },
        });
        if (!sentReminder) {
          await (this.prisma as any).reminder.create({
            data: {
              appointmentId: appt.id,
              remindAt: targetRemindAt,
              channel: NotificationChannel.TELEGRAM,
              status: ReminderStatus.PENDING,
            },
          });
        }
      }

      const titleLabel = mapped.isPrivate
        ? 'Compromisso privado'
        : `Compromisso "${mapped.title}"`;

      await this.auditService.log({
        actorUserId: undefined,
        targetCalendarId: calendar.id,
        entityType: 'APPOINTMENT',
        entityId: appt.id,
        action: 'UPDATE',
        details: `${titleLabel} alterado via Google Agenda`,
        metadata: { source: 'GOOGLE', googleEventId: ev.id },
      });

      return 'updated';
    }

    // 8. Não existe appt:
    // - se endTime < agora − 1 dia → ignorar;
    // - senão create: calendarId, createdById = calendar.ownerId, title, description, startTime, endTime, allDay: mapped.allDay, isPrivate: mapped.isPrivate,
    //   reminderMinutesBefore, status: SCHEDULED, createdVia: 'GOOGLE', googleEventId = ev.id, googleEtag = ev.etag, googleSyncedAt = agora;
    //   Lembrete: quando mapped.allDay, se mapped.endTime > agora, cria lembrete com allDayRemindAt(mapped.startTime);
    //   senão se startTime − reminderMinutesBefore ainda está no futuro, lembrete PENDING canal TELEGRAM nesse horário.
    //   Auditoria action: 'CREATE', details 'Compromisso "<título>" importado do Google Agenda'. Conta created. Não enfileirar envio.
    // - Se o create falhar por unicidade (P2002, outro ciclo criou ao mesmo tempo) → ignorar.
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    if (mapped.endTime.getTime() < oneDayAgo.getTime()) {
      return 'ignored';
    }

    try {
      const createdAppt = await (this.prisma as any).appointment.create({
        data: {
          calendarId: calendar.id,
          createdById: calendar.ownerId,
          title: mapped.title,
          description: mapped.description,
          startTime: mapped.startTime,
          endTime: mapped.endTime,
          allDay: mapped.allDay,
          isPrivate: mapped.isPrivate,
          reminderMinutesBefore: mapped.reminderMinutesBefore,
          status: AppointmentStatus.SCHEDULED,
          createdVia: 'GOOGLE',
          googleEventId: ev.id,
          googleEtag: ev.etag ?? null,
          googleSyncedAt: new Date(),
        },
      });

      if (mapped.allDay) {
        if (mapped.endTime.getTime() > Date.now()) {
          const remindAt = allDayRemindAt(mapped.startTime);
          await (this.prisma as any).reminder.create({
            data: {
              appointmentId: createdAppt.id,
              remindAt,
              channel: NotificationChannel.TELEGRAM,
              status: ReminderStatus.PENDING,
            },
          });
        }
      } else {
        const remindAt = new Date(
          mapped.startTime.getTime() - mapped.reminderMinutesBefore * 60 * 1000,
        );
        if (remindAt.getTime() > Date.now()) {
          await (this.prisma as any).reminder.create({
            data: {
              appointmentId: createdAppt.id,
              remindAt,
              channel: NotificationChannel.TELEGRAM,
              status: ReminderStatus.PENDING,
            },
          });
        }
      }

      const titleLabel = mapped.isPrivate
        ? 'Compromisso privado'
        : `Compromisso "${mapped.title}"`;

      await this.auditService.log({
        actorUserId: undefined,
        targetCalendarId: calendar.id,
        entityType: 'APPOINTMENT',
        entityId: createdAppt.id,
        action: 'CREATE',
        details: `${titleLabel} importado do Google Agenda`,
        metadata: { source: 'GOOGLE', googleEventId: ev.id },
      });

      return 'created';
    } catch (err: any) {
      if (err?.code === 'P2002') {
        return 'ignored';
      }
      throw err;
    }
  }
}
