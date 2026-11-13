import { toGoogleEvent } from './google-event.mapper';

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
