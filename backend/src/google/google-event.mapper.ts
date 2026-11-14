import {
  addDays,
  startOfSaoPauloDay,
  toSaoPauloDateString,
} from '../appointments/all-day.util';

export interface AppointmentForGoogleEvent {
  id: string;
  title: string;
  description?: string | null;
  startTime: Date | string;
  endTime: Date | string;
  allDay?: boolean;
}

export interface GoogleEventDateTime {
  date?: string | null;
  dateTime?: string | null;
  timeZone?: string | null;
}

export interface GoogleEventPayload {
  summary: string;
  description?: string;
  start: GoogleEventDateTime;
  end: GoogleEventDateTime;
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
  const startDate =
    appt.startTime instanceof Date
      ? appt.startTime
      : new Date(appt.startTime);
  const endDate =
    appt.endTime instanceof Date
      ? appt.endTime
      : new Date(appt.endTime);

  let start: GoogleEventDateTime;
  let end: GoogleEventDateTime;

  if (appt.allDay) {
    start = {
      date: toSaoPauloDateString(startDate),
      dateTime: null,
      timeZone: null,
    };
    end = {
      date: toSaoPauloDateString(endDate),
      dateTime: null,
      timeZone: null,
    };
  } else {
    start = {
      date: null,
      dateTime: startDate.toISOString(),
      timeZone: 'America/Sao_Paulo',
    };
    end = {
      date: null,
      dateTime: endDate.toISOString(),
      timeZone: 'America/Sao_Paulo',
    };
  }

  return {
    summary: appt.title,
    description: appt.description ?? undefined,
    start,
    end,
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
  allDay: boolean;
  isPrivate: boolean;
  reminderMinutesBefore: number;
  vidaemdiaId: string | null;
}

export function fromGoogleEvent(ev: any): MappedFromGoogleEvent | null {
  if (!ev?.start) {
    return null;
  }

  const isPrivate =
    ev.visibility === 'private' || ev.visibility === 'confidential';

  let allDay = false;
  let startTime: Date;
  let endTime: Date;

  if (!ev.start.dateTime && ev.start.date) {
    allDay = true;
    startTime = startOfSaoPauloDay(ev.start.date);
    endTime = startOfSaoPauloDay(ev.end?.date ?? ev.start.date);
    if (endTime <= startTime) {
      endTime = addDays(startTime, 1);
    }
  } else if (ev.start.dateTime) {
    if (!ev.end?.dateTime) {
      return null;
    }
    allDay = false;
    startTime = new Date(ev.start.dateTime);
    endTime = new Date(ev.end.dateTime);
  } else {
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
    startTime,
    endTime,
    allDay,
    isPrivate,
    reminderMinutesBefore,
    vidaemdiaId: ev.extendedProperties?.private?.vidaemdiaId ?? null,
  };
}
