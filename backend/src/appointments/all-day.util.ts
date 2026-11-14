export const SAO_PAULO_OFFSET = '-03:00';

/**
 * Retorna 'AAAA-MM-DD' da data no fuso de São Paulo.
 */
export function toSaoPauloDateString(d: Date): string {
  const date = d instanceof Date ? d : new Date(d);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/**
 * Retorna o início do dia (00:00:00) no fuso de São Paulo.
 * Aceita string 'AAAA-MM-DD' ou Date (convertida para a data em São Paulo).
 */
export function startOfSaoPauloDay(day: string | Date): Date {
  const dayStr =
    typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day.trim())
      ? day.trim()
      : toSaoPauloDateString(day instanceof Date ? day : new Date(day));
  return new Date(`${dayStr}T00:00:00${SAO_PAULO_OFFSET}`);
}

/**
 * Adiciona n dias (n * 24 horas) a uma data.
 */
export function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 24 * 60 * 60 * 1000);
}

/**
 * Normaliza um intervalo de dia inteiro:
 * - startTime = 00:00:00 do primeiro dia (São Paulo)
 * - endTime = 00:00:00 do dia seguinte ao último dia (inclusive)
 * Se endTime <= startTime, usa addDays(startTime, 1).
 */
export function normalizeAllDayRange(
  start: Date,
  endInclusive?: Date,
): { startTime: Date; endTime: Date } {
  const startTime = startOfSaoPauloDay(start);
  let endTime = addDays(startOfSaoPauloDay(endInclusive ?? start), 1);
  if (endTime <= startTime) {
    endTime = addDays(startTime, 1);
  }
  return { startTime, endTime };
}

/**
 * Calcula o horário de lembrete para compromissos de dia inteiro:
 * - 08:00:00 do primeiro dia no fuso de São Paulo.
 * - Se esse horário já passou (< now), retorna now.
 */
export function allDayRemindAt(startTime: Date, now = new Date()): Date {
  const dateStr = toSaoPauloDateString(startTime);
  const remindAt = new Date(`${dateStr}T08:00:00${SAO_PAULO_OFFSET}`);
  return remindAt < now ? now : remindAt;
}
