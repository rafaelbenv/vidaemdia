import { describe, it, expect } from 'vitest';
import { formatLongDate, monthGridDays } from '../lib/dates';
import { reminderLine } from '../lib/reminderText';
import { historySentence } from '../lib/historySentence';
import { firstName } from '../lib/format';
import { Appointment, AuditLogEntry, User } from '../types';

describe('lib (funções puras)', () => {
  describe('formatLongDate', () => {
    it('formata "Terça, 10 de novembro"', () => {
      const d = new Date(2026, 10, 10, 12, 0, 0); // mês 10 = novembro
      expect(formatLongDate(d)).toBe('Terça, 10 de novembro');
    });
  });

  describe('monthGridDays', () => {
    it('novembro de 2026 começa num domingo: 6 células vazias antes do dia 1', () => {
      const d = new Date(2026, 10, 1);
      const cells = monthGridDays(d);
      expect(cells.slice(0, 6)).toEqual([null, null, null, null, null, null]);
      expect(cells[6]?.getDate()).toBe(1);
      expect(cells.length % 7).toBe(0);
    });
  });

  describe('reminderLine', () => {
    const baseAppt: Appointment = {
      id: 'appt-1',
      calendarId: 'cal-1',
      createdById: 'user-1',
      title: 'Consulta',
      startTime: '2026-11-10T10:00:00.000-03:00',
      endTime: '2026-11-10T11:00:00.000-03:00',
      reminderMinutesBefore: 30,
      status: 'SCHEDULED',
      createdVia: 'WEB',
      reminders: [],
    };

    it('pendente no mesmo dia', () => {
      const appt: Appointment = {
        ...baseAppt,
        reminders: [
          {
            id: 'rem-1',
            appointmentId: 'appt-1',
            remindAt: '2026-11-10T09:30:00.000-03:00',
            channel: 'TELEGRAM',
            status: 'PENDING',
            retryCount: 0,
          },
        ],
      };
      const result = reminderLine(appt, { ownerTelegramLinked: true, isOwnCalendar: true });
      expect(result).toEqual({
        text: 'Lembrete às 09:30',
        tone: 'muted',
      });
    });

    it('enviado em outro dia → "Lembrete enviado em …"', () => {
      const appt: Appointment = {
        ...baseAppt,
        reminders: [
          {
            id: 'rem-1',
            appointmentId: 'appt-1',
            remindAt: '2026-11-09T18:00:00.000-03:00',
            sentAt: '2026-11-09T18:00:05.000-03:00',
            channel: 'TELEGRAM',
            status: 'SENT',
            retryCount: 0,
          },
        ],
      };
      const result = reminderLine(appt, { ownerTelegramLinked: true, isOwnCalendar: true });
      expect(result).toEqual({
        text: 'Lembrete enviado em 09/11 às 18:00',
        tone: 'muted',
      });
      expect(result?.text).toMatch(/^Lembrete enviado em /);
    });

    it('falhou → tom danger', () => {
      const appt: Appointment = {
        ...baseAppt,
        reminders: [
          {
            id: 'rem-1',
            appointmentId: 'appt-1',
            remindAt: '2026-11-10T09:30:00.000-03:00',
            channel: 'TELEGRAM',
            status: 'FAILED',
            retryCount: 3,
          },
        ],
      };
      const result = reminderLine(appt, { ownerTelegramLinked: true, isOwnCalendar: true });
      expect(result).toEqual({
        text: 'Lembrete falhou',
        tone: 'danger',
      });
    });
  });

  describe('historySentence', () => {
    const me = { id: 'me-1' };

    it('marcou compromisso', () => {
      const entry: AuditLogEntry = {
        id: 'log-1',
        details: 'Consulta Médica',
        actorUserId: 'u1',
        actorUser: {
          id: 'u1',
          name: 'Carlos Silva',
          email: 'carlos@vidaemdia.com.br',
          role: 'USER',
          preferredChannel: 'TELEGRAM',
        } as User,
        entityType: 'APPOINTMENT',
        action: 'CREATE',
        createdAt: '2026-11-10T08:00:00.000-03:00',
        metadata: {
          title: 'Consulta Médica',
          startTime: '2026-11-10T10:00:00.000-03:00',
        },
      };
      const res = historySentence(entry, me);
      expect(res?.text).toBe('Carlos Silva marcou "Consulta Médica" para 10/11 às 10:00');
      expect(res?.tone).toBe('normal');
    });

    it('cancelou compromisso', () => {
      const entry: AuditLogEntry = {
        id: 'log-2',
        details: 'Consulta Médica',
        actorUserId: 'u1',
        actorUser: {
          id: 'u1',
          name: 'Carlos Silva',
          email: 'carlos@vidaemdia.com.br',
          role: 'USER',
          preferredChannel: 'TELEGRAM',
        } as User,
        entityType: 'APPOINTMENT',
        action: 'CANCEL',
        createdAt: '2026-11-10T08:30:00.000-03:00',
        metadata: {
          before: {
            title: 'Consulta Médica',
            startTime: '2026-11-10T10:00:00.000-03:00',
          },
        },
      };
      const res = historySentence(entry, me);
      expect(res?.text).toBe('Carlos Silva cancelou "Consulta Médica" de 10/11 às 10:00');
      expect(res?.tone).toBe('normal');
    });

    it('deu acesso', () => {
      const entry: AuditLogEntry = {
        id: 'log-3',
        details: 'Permissão concedida',
        actorUserId: 'u2',
        actorUser: {
          id: 'u2',
          name: 'Dr. João',
          email: 'dr.joao@vidaemdia.com.br',
          role: 'PROFESSIONAL',
          preferredChannel: 'TELEGRAM',
        } as User,
        entityType: 'PERMISSION',
        action: 'CREATE',
        createdAt: '2026-11-10T09:00:00.000-03:00',
        metadata: {
          granteeName: 'Maria Oliveira',
        },
      };
      const res = historySentence(entry, me);
      expect(res?.text).toBe('Dr. João deu acesso a Maria Oliveira');
      expect(res?.tone).toBe('normal');
    });

    it('acesso negado', () => {
      const entry: AuditLogEntry = {
        id: 'log-4',
        details: 'Acesso negado',
        actorUserId: 'u3',
        actorUser: {
          id: 'u3',
          name: 'Maria Oliveira',
          email: 'maria@vidaemdia.com.br',
          role: 'SECRETARY',
          preferredChannel: 'TELEGRAM',
        } as User,
        entityType: 'RBAC',
        action: 'ACCESS_DENIED',
        createdAt: '2026-11-10T09:15:00.000-03:00',
      };
      const res = historySentence(entry, me);
      expect(res?.text).toBe('Tentativa de acesso negada: Maria Oliveira');
      expect(res?.tone).toBe('alert');
    });
  });

  describe('firstName', () => {
    it('Dr. João Mendes (Cardiologista) === "João"', () => {
      expect(firstName('Dr. João Mendes (Cardiologista)')).toBe('João');
    });
  });
});
