import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AppointmentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService, escapeHtml } from '../telegram/telegram.service';
import { MetricsService } from '../monitoring/metrics.service';
import {
  toSaoPauloDateString,
  startOfSaoPauloDay,
  addDays,
} from '../appointments/all-day.util';

export function saoPauloHour(d: Date): number {
  const date = d instanceof Date ? d : new Date(d);
  const formatted = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    hourCycle: 'h23',
  }).format(date);
  return Number(formatted);
}

export interface DailySummaryAppointmentItem {
  title: string;
  startTime: Date;
  endTime: Date;
  allDay: boolean;
  calendar: { name: string };
}

export function buildDailySummaryMessage(
  name: string,
  appointments: DailySummaryAppointmentItem[],
  today: string,
): string {
  const safeName = escapeHtml(name);
  const [, mm, dd] = today.split('-');
  const dateHeader = `${dd}/${mm}`;
  const footer = '💡 <i>Para desligar ou mudar o horário, acesse Minha conta no VidaEmDia.</i>';

  if (!appointments || appointments.length === 0) {
    return `☀️ <b>Bom dia, ${safeName}!</b> Você não tem compromissos hoje (${dateHeader}). Dia livre! 🎉\n\n${footer}`;
  }

  const sorted = [...appointments].sort((a, b) => {
    if (a.allDay !== b.allDay) {
      return a.allDay ? -1 : 1;
    }
    const aTime = new Date(a.startTime).getTime();
    const bTime = new Date(b.startTime).getTime();
    return aTime - bTime;
  });

  const dayStart = startOfSaoPauloDay(today);

  const lines = sorted.map((appt) => {
    const safeTitle = escapeHtml(appt.title);
    const safeCalendar = escapeHtml(appt.calendar?.name);
    let timeLabel: string;

    if (appt.allDay) {
      timeLabel = 'Dia inteiro';
    } else {
      const start = appt.startTime instanceof Date ? appt.startTime : new Date(appt.startTime);
      if (start < dayStart) {
        timeLabel = 'Em andamento';
      } else {
        timeLabel = new Intl.DateTimeFormat('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'America/Sao_Paulo',
        }).format(start);
      }
    }

    return `• <b>${timeLabel}</b> — ${safeTitle} <i>(${safeCalendar})</i>`;
  });

  return `☀️ <b>Bom dia, ${safeName}!</b> Sua agenda de hoje (${dateHeader}):\n\n${lines.join('\n')}\n\n${footer}`;
}

@Injectable()
export class DailySummaryWorker {
  private readonly logger = new Logger(DailySummaryWorker.name);
  private isRunning = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly telegramService: TelegramService,
    private readonly metricsService: MetricsService,
  ) {}

  @Cron(process.env.DAILY_SUMMARY_CRON_EXPRESSION || '*/5 * * * *')
  async run(now = new Date()) {
    if (this.isRunning) {
      return {
        today: toSaoPauloDateString(now),
        hour: saoPauloHour(now),
        candidates: 0,
        sent: 0,
        failed: 0,
        skipped: 0,
      };
    }

    this.isRunning = true;
    const today = toSaoPauloDateString(now);
    const hour = saoPauloHour(now);
    let sent = 0;
    let failed = 0;
    let skipped = 0;
    let candidatesCount = 0;

    try {
      const candidates = await this.prisma.user.findMany({
        where: {
          dailySummaryEnabled: true,
          dailySummaryHour: hour,
          telegramChatId: { not: null },
          OR: [
            { dailySummaryLastSentOn: null },
            { dailySummaryLastSentOn: { not: today } },
          ],
        },
        select: {
          id: true,
          name: true,
          telegramChatId: true,
          dailySummaryLastSentOn: true,
        },
        take: 200,
      });

      candidatesCount = candidates.length;

      for (const user of candidates) {
        const claim = await this.prisma.user.updateMany({
          where: {
            id: user.id,
            dailySummaryLastSentOn: user.dailySummaryLastSentOn,
          },
          data: {
            dailySummaryLastSentOn: today,
          },
        });

        if (claim.count === 0) {
          skipped++;
          continue;
        }

        try {
          const dayStart = startOfSaoPauloDay(today);
          const dayEnd = addDays(dayStart, 1);

          const appointments = await this.prisma.appointment.findMany({
            where: {
              status: AppointmentStatus.SCHEDULED,
              calendar: { ownerId: user.id },
              startTime: { lt: dayEnd },
              endTime: { gt: dayStart },
            },
            include: {
              calendar: {
                select: { name: true },
              },
            },
            orderBy: [{ allDay: 'desc' }, { startTime: 'asc' }],
            take: 30,
          });

          const message = buildDailySummaryMessage(
            user.name,
            appointments,
            today,
          );

          await this.telegramService.sendMessage(
            user.telegramChatId!,
            message,
          );

          this.metricsService.incrementDailySummarySent();
          sent++;
        } catch (err: any) {
          this.logger.error(
            `Erro ao enviar resumo diário para o usuário ${user.id}: ${err?.message || err}`,
          );
          this.metricsService.incrementDailySummaryFailed();
          failed++;

          await this.prisma.user.updateMany({
            where: {
              id: user.id,
              dailySummaryLastSentOn: today,
            },
            data: {
              dailySummaryLastSentOn: user.dailySummaryLastSentOn,
            },
          });
        }
      }

      return {
        today,
        hour,
        candidates: candidatesCount,
        sent,
        failed,
        skipped,
      };
    } finally {
      this.isRunning = false;
    }
  }
}
