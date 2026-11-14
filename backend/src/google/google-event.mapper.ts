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

export interface MappedFromGoogleEvent {
  title: string;
  description: string | null;
  startTime: Date;
  endTime: Date;
  reminderMinutesBefore: number;
  vidaemdiaId: string | null;
}

export function fromGoogleEvent(ev: any): MappedFromGoogleEvent | null {
  if (!ev?.start?.dateTime || !ev?.end?.dateTime) {
    return null;
  }

  let reminderMinutesBefore = 30;
  if (Array.isArray(ev.reminders?.overrides)) {
    const popupOverride = ev.reminders.overrides.find(
      (o: any) => o?.method === 'popup' && typeof o?.minutes === 'number',
    );
    if (popupOverride) {
      reminderMinutesBefore = popupOverride.minutes;
    }
  }

  return {
    title: (ev.summary ?? '').trim() || '(Sem título)',
    description: ev.description ?? null,
    startTime: new Date(ev.start.dateTime),
    endTime: new Date(ev.end.dateTime),
    reminderMinutesBefore,
    vidaemdiaId: ev.extendedProperties?.private?.vidaemdiaId ?? null,
  };
}

