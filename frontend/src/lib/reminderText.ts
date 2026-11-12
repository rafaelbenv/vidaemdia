import { Appointment } from '../types';
import { formatDayMonth, formatTime, isSameDay } from './dates';

export interface ReminderLineOptions {
  ownerTelegramLinked: boolean;
  isOwnCalendar?: boolean;
}

export interface ReminderLineResult {
  text: string;
  tone: 'muted' | 'danger' | 'action';
}

export function formatRemindSuffix(targetIso: string, startIso: string): string {
  const targetDate = new Date(targetIso);
  const startDate = new Date(startIso);
  if (isSameDay(targetDate, startDate)) {
    return `às ${formatTime(targetDate)}`;
  }
  return `em ${formatDayMonth(targetDate)} às ${formatTime(targetDate)}`;
}

export function reminderLine(
  appt: Appointment,
  opts: ReminderLineOptions,
): ReminderLineResult | null {
  if (!appt.reminders || appt.reminders.length === 0) {
    return null;
  }

  const reminder = appt.reminders[0];
  const isOwnCalendar = opts.isOwnCalendar ?? true;

  if (reminder.status === 'FAILED') {
    return { text: 'Lembrete falhou', tone: 'danger' };
  }

  if (reminder.status === 'PROCESSING') {
    return { text: 'Enviando lembrete…', tone: 'muted' };
  }

  if (reminder.status === 'SENT') {
    const rawTime = reminder.sentAt ?? reminder.remindAt;
    const suffix = formatRemindSuffix(rawTime, appt.startTime);
    return {
      text: `Lembrete enviado ${suffix}`,
      tone: 'muted',
    };
  }

  if (reminder.status === 'PENDING') {
    if (!opts.ownerTelegramLinked) {
      if (!isOwnCalendar) {
        return {
          text: 'Sem lembrete — Telegram do dono não conectado',
          tone: 'muted',
        };
      }
      return {
        text: 'Sem lembrete — conecte o Telegram',
        tone: 'action',
      };
    }
    const suffix = formatRemindSuffix(reminder.remindAt, appt.startTime);
    return {
      text: `Lembrete ${suffix}`,
      tone: 'muted',
    };
  }

  return null;
}
