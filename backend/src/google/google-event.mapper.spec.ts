import { toGoogleEvent, fromGoogleEvent } from './google-event.mapper';

describe('toGoogleEvent', () => {
  it('deve mapear compromisso completo com fuso, useDefault e vidaemdiaId', () => {
    const appt = {
      id: 'appt-123',
      title: 'Consulta Médica',
      description: 'Retorno de exames',
      startTime: new Date('2026-11-20T10:00:00.000Z'),
      endTime: new Date('2026-11-20T11:00:00.000Z'),
    };

    const result = toGoogleEvent(appt);

    expect(result).toEqual({
      summary: 'Consulta Médica',
      description: 'Retorno de exames',
      start: {
        dateTime: '2026-11-20T10:00:00.000Z',
        timeZone: 'America/Sao_Paulo',
      },
      end: {
        dateTime: '2026-11-20T11:00:00.000Z',
        timeZone: 'America/Sao_Paulo',
      },
      reminders: {
        useDefault: true,
      },
      extendedProperties: {
        private: {
          vidaemdiaId: 'appt-123',
        },
      },
    });
  });

  it('deve converter description nula para undefined e aceitar strings ISO em startTime/endTime', () => {
    const appt = {
      id: 'appt-456',
      title: 'Reunião de Alinhamento',
      description: null,
      startTime: '2026-11-25T14:30:00.000Z',
      endTime: '2026-11-25T15:30:00.000Z',
    };

    const result = toGoogleEvent(appt);

    expect(result.summary).toBe('Reunião de Alinhamento');
    expect(result.description).toBeUndefined();
    expect(result.start).toEqual({
      dateTime: '2026-11-25T14:30:00.000Z',
      timeZone: 'America/Sao_Paulo',
    });
    expect(result.end).toEqual({
      dateTime: '2026-11-25T15:30:00.000Z',
      timeZone: 'America/Sao_Paulo',
    });
    expect(result.reminders).toEqual({ useDefault: true });
    expect(result.extendedProperties).toEqual({
      private: {
        vidaemdiaId: 'appt-456',
      },
    });
  });
});

describe('fromGoogleEvent', () => {
  it('dia inteiro sem start.dateTime deve retornar null', () => {
    const ev = {
      summary: 'Feriado Nacional',
      start: { date: '2026-11-20' },
      end: { date: '2026-11-21' },
    };

    expect(fromGoogleEvent(ev)).toBeNull();
  });

  it('sem end.dateTime deve retornar null', () => {
    const ev = {
      summary: 'Evento sem término',
      start: { dateTime: '2026-11-20T10:00:00.000Z' },
    };

    expect(fromGoogleEvent(ev)).toBeNull();
  });

  it('popup override usado deve definir reminderMinutesBefore com o valor do popup', () => {
    const ev = {
      summary: 'Dentista',
      description: 'Limpeza semestral',
      start: { dateTime: '2026-11-20T14:00:00.000Z' },
      end: { dateTime: '2026-11-20T15:00:00.000Z' },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 60 },
          { method: 'popup', minutes: 15 },
        ],
      },
      extendedProperties: {
        private: {
          vidaemdiaId: 'appt-dentista-1',
        },
      },
    };

    const result = fromGoogleEvent(ev);

    expect(result).toEqual({
      title: 'Dentista',
      description: 'Limpeza semestral',
      startTime: new Date('2026-11-20T14:00:00.000Z'),
      endTime: new Date('2026-11-20T15:00:00.000Z'),
      reminderMinutesBefore: 15,
      vidaemdiaId: 'appt-dentista-1',
    });
  });

  it('sem override deve definir reminderMinutesBefore padrão de 30 minutos', () => {
    const ev = {
      summary: 'Reunião',
      start: { dateTime: '2026-11-20T10:00:00.000Z' },
      end: { dateTime: '2026-11-20T11:00:00.000Z' },
      reminders: {
        useDefault: true,
      },
    };

    const result = fromGoogleEvent(ev);

    expect(result?.reminderMinutesBefore).toBe(30);
  });

  it('sem título ou título com espaços em branco deve retornar "(Sem título)"', () => {
    const evSemTitulo = {
      start: { dateTime: '2026-11-20T10:00:00.000Z' },
      end: { dateTime: '2026-11-20T11:00:00.000Z' },
    };

    const evEspacos = {
      summary: '    ',
      start: { dateTime: '2026-11-20T10:00:00.000Z' },
      end: { dateTime: '2026-11-20T11:00:00.000Z' },
    };

    expect(fromGoogleEvent(evSemTitulo)?.title).toBe('(Sem título)');
    expect(fromGoogleEvent(evEspacos)?.title).toBe('(Sem título)');
  });
});
