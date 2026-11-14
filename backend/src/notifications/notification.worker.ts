import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AppointmentStatus, ReminderStatus } from '@prisma/client';
import * as os from 'os';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationProvider } from './notification.provider';
import { MetricsService } from '../monitoring/metrics.service';
import { escapeHtml } from '../telegram/telegram.service';

@Injectable()
export class NotificationWorker {
  private readonly logger = new Logger(NotificationWorker.name);
  private readonly instanceId = `${os.hostname()}-${process.pid}`;
  private isRunning = false;
  private lastRunAt: string | null = null;
  private totalCycles = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationProvider: NotificationProvider,
    private readonly metricsService: MetricsService,
  ) {}

  getWorkerStatus() {
    return {
      isRunning: this.isRunning,
      lastRunAt: this.lastRunAt,
      totalCycles: this.totalCycles,
      maxRetries: Number(process.env.MAX_REMINDER_RETRIES || 3),
    };
  }

  /**
   * Executa automaticamente a cada 1 minuto (ou pode ser acionado sob demanda pela API/UI)
   * seguindo exatamente o FLUXO DE NOTIFICAÇÃO do diagrama VidaEmDia_Fluxo.drawio.html:
   * 1. Consulta PostgreSQL: compromissos com lembrete pendente dentro da janela
   * 2. Existe lembrete pendente? Se NÃO -> aguarda próximo ciclo
   * 3. Se SIM -> Monta mensagem de lembrete (Título · Data · Horário)
   * 4. Envia requisição para Telegram Bot API
   * 5. Envio bem-sucedido?
   *    - SIM: Atualiza status do lembrete para ENVIADO (SENT) no PostgreSQL
   *    - NÃO: Registra erro -> agenda nova tentativa (máx. 3 tentativas)
   */
  @Cron(process.env.WORKER_CRON_EXPRESSION || '*/1 * * * *')
  async processPendingReminders() {
    if (this.isRunning) {
      return { processed: 0, skipped: 0, message: 'Worker já está em execução neste momento' };
    }

    this.isRunning = true;
    this.lastRunAt = new Date().toISOString();
    this.totalCycles++;
    const maxRetries = Number(process.env.MAX_REMINDER_RETRIES || 3);

    try {
      // Recuperar reservas esquecidas (processo caiu no meio)
      const staleThreshold = new Date(Date.now() - 5 * 60 * 1000);
      const recovered = await this.prisma.reminder.updateMany({
        where: {
          status: ReminderStatus.PROCESSING,
          claimedAt: { lt: staleThreshold },
        },
        data: {
          status: ReminderStatus.PENDING,
          claimedAt: null,
          claimedBy: null,
        },
      });
      if (recovered.count > 0) {
        this.logger.warn(`Recuperados ${recovered.count} lembrete(s) com reserva esquecida.`);
      }

      const now = new Date();

      const pendingReminders = await this.prisma.reminder.findMany({
        where: {
          status: ReminderStatus.PENDING,
          remindAt: { lte: now },
          retryCount: { lt: maxRetries },
          OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
          appointment: {
            status: AppointmentStatus.SCHEDULED,
          },
        },
        include: {
          appointment: {
            include: {
              calendar: {
                include: {
                  owner: true,
                },
              },
            },
          },
        },
        take: 50,
      });

      if (pendingReminders.length === 0) {
        return {
          cycle: this.totalCycles,
          processed: 0,
          sent: 0,
          retried: 0,
          failedPermanently: 0,
          skipped: 0,
          message: 'Nenhum lembrete pendente na janela atual -> aguardando próximo ciclo.',
        };
      }

      let sentCount = 0;
      let retriedCount = 0;
      let failedPermanentlyCount = 0;
      let skippedCount = 0;

      for (const reminder of pendingReminders) {
        const claim = await this.prisma.reminder.updateMany({
          where: {
            id: reminder.id,
            status: ReminderStatus.PENDING,
            OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
          },
          data: {
            status: ReminderStatus.PROCESSING,
            claimedAt: new Date(),
            claimedBy: this.instanceId,
          },
        });
        if (claim.count === 0) {
          skippedCount++;
          continue; // outra instância pegou
        }

        const appt = reminder.appointment;
        const owner = appt.calendar.owner;

        const dateFormatted = appt.startTime.toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          timeZone: process.env.APP_TIMEZONE || 'America/Sao_Paulo',
        });
        const timeFormatted = appt.startTime.toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: process.env.APP_TIMEZONE || 'America/Sao_Paulo',
        });

        // Formato fiel ao diagrama: "Lembrete VidaEmDia\nConsulta médica hoje às 08:00."
        const line = appt.allDay
          ? `${escapeHtml(appt.title)} em ${dateFormatted} (dia inteiro).\n`
          : `${escapeHtml(appt.title)} em ${dateFormatted} às ${timeFormatted}.\n`;

        const messageText =
          `🔔 <b>Lembrete VidaEmDia</b>\n` +
          line +
          (appt.description ? `📝 <i>${escapeHtml(appt.description)}</i>\n` : '') +
          `📂 Agenda: ${escapeHtml(appt.calendar.name)}`;

        let result: { success: boolean; error?: string };
        try {
          result = await this.notificationProvider.sendReminderMessage({
            reminderId: reminder.id,
            appointmentId: appt.id,
            channel: reminder.channel,
            recipientName: owner.name,
            telegramChatId: owner.telegramChatId,
            messageText,
          });
        } catch (error: unknown) {
          const err = error as Error | undefined;
          result = {
            success: false,
            error: err?.message || 'Exceção ao disparar mensagem',
          };
        }

        if (result.success) {
          await this.prisma.reminder.update({
            where: { id: reminder.id },
            data: {
              status: ReminderStatus.SENT,
              sentAt: new Date(),
              lastError: null,
              claimedAt: null,
              claimedBy: null,
            },
          });
          sentCount++;
          this.metricsService.incrementReminderSent(reminder.channel);
        } else {
          const newRetryCount = reminder.retryCount + 1;
          const exhausted = newRetryCount >= maxRetries;
          // Backoff para próxima tentativa (ex.: +1 min)
          const nextRetryAt = exhausted ? null : new Date(Date.now() + 60 * 1000);

          await this.prisma.reminder.update({
            where: { id: reminder.id },
            data: {
              retryCount: newRetryCount,
              status: exhausted ? ReminderStatus.FAILED : ReminderStatus.PENDING,
              nextRetryAt,
              lastError: result.error || 'Falha no envio para API de mensageria',
              claimedAt: null,
              claimedBy: null,
            },
          });

          this.metricsService.incrementReminderFailed(reminder.channel);
          if (exhausted) {
            failedPermanentlyCount++;
            this.logger.warn(
              `❌ Lembrete ${reminder.id} atingiu o limite máximo de ${maxRetries} tentativas e foi marcado como FAILED.`,
            );
          } else {
            retriedCount++;
            this.logger.warn(
              `⚠️ Erro no lembrete ${reminder.id} (tentativa ${newRetryCount}/${maxRetries}). Nova tentativa agendada.`,
            );
          }
        }
      }

      let message = `Ciclo concluído: ${sentCount} enviado(s), ${retriedCount} agendado(s) para retry, ${failedPermanentlyCount} falha(s) definitiva(s)`;
      if (skippedCount > 0) {
        message += `, ${skippedCount} reservado(s) por outra instância`;
      }
      message += '.';

      return {
        cycle: this.totalCycles,
        processed: pendingReminders.length,
        sent: sentCount,
        retried: retriedCount,
        failedPermanently: failedPermanentlyCount,
        skipped: skippedCount,
        message,
      };
    } finally {
      this.isRunning = false;
    }
  }
}
