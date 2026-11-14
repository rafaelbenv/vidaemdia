import {
  SAO_PAULO_OFFSET,
  toSaoPauloDateString,
  startOfSaoPauloDay,
  addDays,
  normalizeAllDayRange,
  allDayRemindAt,
} from './all-day.util';

describe('all-day.util', () => {
  it('SAO_PAULO_OFFSET deve ser -03:00', () => {
    expect(SAO_PAULO_OFFSET).toBe('-03:00');
  });

  it('data 2026-11-20 às 23:30 de São Paulo (02:30Z do dia 21) cai no dia 20', () => {
    // 2026-11-21T02:30:00.000Z em UTC equivale a 2026-11-20T23:30:00-03:00 em São Paulo
    const d = new Date('2026-11-21T02:30:00.000Z');
    expect(toSaoPauloDateString(d)).toBe('2026-11-20');

    const start = startOfSaoPauloDay(d);
    // 00:00:00 do dia 20 em São Paulo (-03:00) equivale a 03:00:00Z
    expect(start.toISOString()).toBe('2026-11-20T03:00:00.000Z');
  });

  it('startOfSaoPauloDay deve aceitar string YYYY-MM-DD diretamente', () => {
    const start = startOfSaoPauloDay('2026-11-20');
    expect(start.toISOString()).toBe('2026-11-20T03:00:00.000Z');
  });

  it('addDays deve somar n * 24 horas', () => {
    const d = new Date('2026-11-20T03:00:00.000Z');
    const plusOne = addDays(d, 1);
    expect(plusOne.toISOString()).toBe('2026-11-21T03:00:00.000Z');

    const minusOne = addDays(d, -1);
    expect(minusOne.toISOString()).toBe('2026-11-19T03:00:00.000Z');
  });

  it('faixa de um dia normaliza para 00:00 do primeiro dia e 00:00 do dia seguinte', () => {
    const start = new Date('2026-11-20T10:00:00.000Z');
    const range = normalizeAllDayRange(start);

    expect(range.startTime.toISOString()).toBe('2026-11-20T03:00:00.000Z'); // 00:00 SP
    expect(range.endTime.toISOString()).toBe('2026-11-21T03:00:00.000Z'); // 00:00 SP do dia seguinte
  });

  it('faixa de 3 dias normaliza corretamente (último dia inclusive)', () => {
    // Dias 20, 21 e 22 (inclusive)
    const start = new Date('2026-11-20T10:00:00.000Z');
    const endInclusive = new Date('2026-11-22T15:00:00.000Z');

    const range = normalizeAllDayRange(start, endInclusive);

    expect(range.startTime.toISOString()).toBe('2026-11-20T03:00:00.000Z'); // 2026-11-20 00:00 SP
    expect(range.endTime.toISOString()).toBe('2026-11-23T03:00:00.000Z'); // 2026-11-23 00:00 SP (dia seguinte ao dia 22)
  });

  it('normalizeAllDayRange com término anterior ao início usa addDays(startTime, 1)', () => {
    const start = new Date('2026-11-20T10:00:00.000Z');
    const endBefore = new Date('2026-11-18T10:00:00.000Z');

    const range = normalizeAllDayRange(start, endBefore);

    expect(range.startTime.toISOString()).toBe('2026-11-20T03:00:00.000Z');
    expect(range.endTime.toISOString()).toBe('2026-11-21T03:00:00.000Z');
  });

  it('lembrete às 08:00 (11:00Z)', () => {
    const startTime = new Date('2026-11-20T03:00:00.000Z'); // 2026-11-20 00:00 SP
    const now = new Date('2026-11-20T09:00:00.000Z'); // 2026-11-20 06:00 SP (< 08:00)

    const remindAt = allDayRemindAt(startTime, now);

    // 08:00:00 em São Paulo (-03:00) equivale a 11:00:00Z
    expect(remindAt.toISOString()).toBe('2026-11-20T11:00:00.000Z');
  });

  it('lembrete que já passou vira now', () => {
    const startTime = new Date('2026-11-20T03:00:00.000Z'); // 2026-11-20 00:00 SP
    const now = new Date('2026-11-20T14:00:00.000Z'); // 2026-11-20 11:00 SP (> 08:00)

    const remindAt = allDayRemindAt(startTime, now);

    expect(remindAt.getTime()).toBe(now.getTime());
  });
});
