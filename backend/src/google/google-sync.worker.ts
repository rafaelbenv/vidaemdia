import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AppointmentStatus } from '@prisma/client';
import * as os from 'os';
import { PrismaService } from '../prisma/prisma.service';
import { MetricsService } from '../monitoring/metrics.service';
import { GoogleAccountService } from './google-account.service';
import {
  GoogleCalendarClient,
  GoogleApiError,
} from './google-calendar.client';
import { GoogleInvalidGrantError } from './google-oauth.client';
import { googleConfig } from './google.config';
import { toGoogleEvent } from './google-event.mapper';

const RETRY_DELAYS_MINUTES = [1, 5, 15, 30];

@Injectable()
export class GoogleSyncWorker {
  private readonly logger = new Logger(GoogleSyncWorker.name);
  private readonly instanceId = `${os.hostname()}-${process.pid}`;
  private isRunning = false;
  private lastRunAt: string | null = null;
  private totalCycles = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly googleAccountService: GoogleAccountService,
    private readonly calendarClient: GoogleCalendarClient,
    private readonly metricsService: MetricsService,
  ) {}

  getWorkerStatus() {
    return {
      isRunning: this.isRunning,
      lastRunAt: this.lastRunAt,
      totalCycles: this.totalCycles,
    };
  }

  @Cron(process.env.GOOGLE_SYNC_CRON_EXPRESSION || '*/1 * * * *')
  async processQueue() {
    if (this.isRunning) {
      return {
        processed: 0,
        skipped: 0,
        message: 'Worker já está em execução neste momento',
      };
    }

    const cfg = googleConfig();
    if (!cfg.configured) {
      return {
        processed: 0,
        skipped: 0,
        message: 'Integração Google não configurada',
      };
    }

    this.isRunning = true;
    this.lastRunAt = new Date().toISOString();
    this.totalCycles++;

    let processedCount = 0;
    let successCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    try {
      // 1. Recupera reservas esquecidas (PROCESSING com claimedAt > 5 min atrás)
      const staleThreshold = new Date(Date.now() - 5 * 60 * 1000);
      const recovered = await (this.prisma as any).googleSyncJob.updateMany({
        where: {
          status: 'PROCESSING',
          claimedAt: { lt: staleThreshold },
        },
        data: {
          status: 'PENDING',
          claimedAt: null,
          claimedBy: null,
        },
      });
      if (recovered.count > 0) {
        this.logger.warn(
          `Recuperados ${recovered.count} jobs de sincronização com reserva esquecida.`,
        );
      }

      // 2. Busca até 50 jobs PENDING com nextRetryAt nulo ou vencido, mais antigos primeiro
      const now = new Date();
      const pendingJobs = await (this.prisma as any).googleSyncJob.findMany({
        where: {
          status: 'PENDING',
          OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
        },
        orderBy: { createdAt: 'asc' },
        take: 50,
      });

      for (const job of pendingJobs) {
        // Reserva cada um com updateMany condicional
        const claim = await (this.prisma as any).googleSyncJob.updateMany({
          where: {
            id: job.id,
            status: 'PENDING',
            OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
          },
          data: {
            status: 'PROCESSING',
            claimedAt: new Date(),
            claimedBy: this.instanceId,
          },
        });

        if (claim.count === 0) {
          skippedCount++;
          continue;
        }

        processedCount++;

        try {
          await this.processJob(job);
          successCount++;
        } catch (error: any) {
          errorCount++;
          await this.handleJobError(job, error);
        }
      }

      return {
        cycle: this.totalCycles,
        processed: processedCount,
        success: successCount,
        skipped: skippedCount,
        errors: errorCount,
        message: `Ciclo concluído: ${successCount} sucesso(s), ${errorCount} erro(s), ${skippedCount} ignorado(s).`,
      };
    } finally {
      this.isRunning = false;
    }
  }

  private async processJob(job: any) {
    const appt = await this.prisma.appointment.findUnique({
      where: { id: job.appointmentId },
      include: {
        calendar: true,
      },
    });

    if (!appt) {
      await (this.prisma as any).googleSyncJob.update({
        where: { id: job.id },
        data: { status: 'DONE', claimedAt: null, claimedBy: null },
      });
      return;
    }

    // agenda sem googleCalendarId → DONE (nada a fazer)
    if (!appt.calendar?.googleCalendarId) {
      await (this.prisma as any).googleSyncJob.update({
        where: { id: job.id },
        data: { status: 'DONE', claimedAt: null, claimedBy: null },
      });
      return;
    }

    const googleCalendarId = appt.calendar.googleCalendarId;

    // token: googleAccountService.getAccessToken(calendar.ownerId)
    let token: string;
    try {
      token = await this.googleAccountService.getAccessToken(appt.calendar.ownerId);
    } catch (err: any) {
      if (err instanceof NotFoundException) {
        throw new Error('O dono da agenda não tem o Google conectado.');
      }
      throw err;
    }

    const isDelete =
      job.operation === 'DELETE' || appt.status === AppointmentStatus.CANCELLED;

    if (!isDelete) {
      // UPSERT (e o compromisso não está cancelado)
      const eventPayload = toGoogleEvent(appt);
      let eventResultId: string | null = null;

      const currentGoogleEventId = (appt as any).googleEventId;

      if (currentGoogleEventId) {
        try {
          const patchResult = await this.calendarClient.patchEvent(
            token,
            googleCalendarId,
            currentGoogleEventId,
            eventPayload,
          );
          eventResultId = patchResult?.id || currentGoogleEventId;
        } catch (err: any) {
          if (
            err instanceof GoogleApiError &&
            (err.status === 404 || err.status === 410)
          ) {
            const insertResult = await this.calendarClient.insertEvent(
              token,
              googleCalendarId,
              eventPayload,
            );
            eventResultId = insertResult?.id;
          } else {
            throw err;
          }
        }
      } else {
        const insertResult = await this.calendarClient.insertEvent(
          token,
          googleCalendarId,
          eventPayload,
        );
        eventResultId = insertResult?.id;
      }

      await (this.prisma as any).appointment.update({
        where: { id: appt.id },
        data: {
          googleEventId: eventResultId,
          googleSyncedAt: new Date(),
          googleSyncError: null,
        },
      });
    } else {
      // DELETE (ou UPSERT de compromisso cancelado)
      const currentGoogleEventId = (appt as any).googleEventId;

      if (currentGoogleEventId) {
        try {
          await this.calendarClient.deleteEvent(
            token,
            googleCalendarId,
            currentGoogleEventId,
          );
        } catch (err: any) {
          if (
            err instanceof GoogleApiError &&
            (err.status === 404 || err.status === 410)
          ) {
            // 404/410 contam como sucesso
          } else {
            throw err;
          }
        }
      }

      await (this.prisma as any).appointment.update({
        where: { id: appt.id },
        data: {
          googleSyncedAt: new Date(),
          googleSyncError: null,
        },
      });
    }

    // Sucesso → job DONE, reserva limpa; métrica incrementGoogleSync('ok')
    await (this.prisma as any).googleSyncJob.update({
      where: { id: job.id },
      data: {
        status: 'DONE',
        claimedAt: null,
        claimedBy: null,
        lastError: null,
      },
    });

    this.metricsService.incrementGoogleSync('ok');
  }

  private async handleJobError(job: any, error: any) {
    const isInvalidGrant =
      error instanceof GoogleInvalidGrantError ||
      error?.name === 'GoogleInvalidGrantError';

    const isNoAccount =
      error?.message === 'O dono da agenda não tem o Google conectado.';

    let reason: string;
    let shouldFailPermanently = false;

    if (isInvalidGrant) {
      reason = 'Conexão com o Google expirou; conecte de novo.';
      shouldFailPermanently = true;
    } else if (isNoAccount) {
      reason = 'O dono da agenda não tem o Google conectado.';
      shouldFailPermanently = true;
    } else {
      reason = error?.message || 'Erro inesperado ao sincronizar com o Google';
      const newRetryCount = job.retryCount + 1;
      shouldFailPermanently = newRetryCount >= 5;
    }

    const newRetryCount = job.retryCount + 1;
    const errorMessage = `Não foi possível enviar ao Google: ${reason}`;

    let nextRetryAt: Date | null = null;
    let finalStatus: 'PENDING' | 'FAILED';

    if (shouldFailPermanently) {
      finalStatus = 'FAILED';
      nextRetryAt = null;
    } else {
      finalStatus = 'PENDING';
      const delayMinutes = RETRY_DELAYS_MINUTES[job.retryCount] ?? 30;
      nextRetryAt = new Date(Date.now() + delayMinutes * 60 * 1000);
    }

    await (this.prisma as any).googleSyncJob.update({
      where: { id: job.id },
      data: {
        status: finalStatus,
        retryCount: newRetryCount,
        nextRetryAt,
        lastError: reason,
        claimedAt: null,
        claimedBy: null,
      },
    });

    try {
      await (this.prisma as any).appointment.update({
        where: { id: job.appointmentId },
        data: {
          googleSyncError: errorMessage,
        },
      });
    } catch {
      // Se compromisso foi deletado, ignora
    }

    this.metricsService.incrementGoogleSync('erro');
  }
}
