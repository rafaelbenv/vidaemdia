export interface AppointmentForGoogleEvent {
  id: string;
  title: string;
  description?: string | null;
  startTime: Date | string;
  endTime: Date | string;
}

export interface GoogleEventPayload {
  summary: string;
  description?: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  reminders: {
    useDefault: boolean;
  };
  extendedProperties: {
    private: {
      vidaemdiaId: string;
    };
  };
}

export function toGoogleEvent(
  appt: AppointmentForGoogleEvent,
): GoogleEventPayload {
  const startIso =
    appt.startTime instanceof Date
      ? appt.startTime.toISOString()
      : new Date(appt.startTime).toISOString();
  const endIso =
    appt.endTime instanceof Date
      ? appt.endTime.toISOString()
      : new Date(appt.endTime).toISOString();

  return {
    summary: appt.title,
    description: appt.description ?? undefined,
    start: {
      dateTime: startIso,
      timeZone: 'America/Sao_Paulo',
    },
    end: {
      dateTime: endIso,
      timeZone: 'America/Sao_Paulo',
    },
    reminders: {
      useDefault: true,
    },
    extendedProperties: {
      private: {
        vidaemdiaId: appt.id,
      },
    },
  };
}
