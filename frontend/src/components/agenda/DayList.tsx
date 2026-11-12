import React, { useState } from 'react';
import { Appointment } from '../../types';
import { formatLongDate, isSameDay } from '../../lib/dates';
import { reminderLine } from '../../lib/reminderText';
import { AppointmentRow } from './AppointmentRow';

export interface DayListProps {
  day: Date;
  appointments: Appointment[];
  now: Date;
  ownerId: string;
  ownerTelegramLinked: boolean;
  isOwnCalendar?: boolean;
  canCreate?: boolean;
  onConnectTelegram: () => void;
  onOpen: (a: Appointment) => void;
  onNew: () => void;
}

export function DayList({
  day,
  appointments,
  now,
  ownerId,
  ownerTelegramLinked,
  isOwnCalendar = true,
  canCreate = true,
  onConnectTelegram,
  onOpen,
  onNew,
}: DayListProps) {
  const [showCancelled, setShowCancelled] = useState(false);

  const sorted = [...appointments].sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
  );
  const active = sorted.filter((a) => a.status !== 'CANCELLED');
  const cancelled = sorted.filter((a) => a.status === 'CANCELLED');

  const isToday = isSameDay(day, now);

  let ongoingApptId: string | null = null;
  let firstFutureApptId: string | null = null;
  let futureDiffMinutes = 0;

  if (isToday) {
    for (const appt of active) {
      const start = new Date(appt.startTime);
      const end = new Date(appt.endTime);
      if (start <= now && now < end) {
        ongoingApptId = appt.id;
        break;
      }
    }

    if (!ongoingApptId) {
      for (const appt of active) {
        const start = new Date(appt.startTime);
        if (start > now) {
          firstFutureApptId = appt.id;
          const diffMs = start.getTime() - now.getTime();
          futureDiffMinutes = Math.floor(diffMs / (60 * 1000));
          break;
        }
      }
    }
  }

  const renderCancelledSection = () => {
    if (cancelled.length === 0) return null;
    const count = cancelled.length;
    const label = showCancelled
      ? 'Esconder cancelados'
      : `Mostrar ${count} ${count === 1 ? 'cancelado' : 'cancelados'}`;

    return (
      <div className="pt-3 pb-2 border-t border-stone-100 text-left">
        <button
          type="button"
          onClick={() => setShowCancelled(!showCancelled)}
          className="text-xs text-stone-500 hover:text-stone-800"
        >
          {label}
        </button>
        {showCancelled && (
          <div className="mt-2">
            {cancelled.map((appt) => (
              <AppointmentRow
                key={appt.id}
                appt={appt}
                isPast={new Date(appt.endTime) < now}
                marker={null}
                reminder={reminderLine(appt, { ownerTelegramLinked, isOwnCalendar })}
                createdByOther={
                  appt.createdBy && appt.createdBy.id !== ownerId
                    ? appt.createdBy.name.trim().split(/\s+/)[0]
                    : null
                }
                onConnectTelegram={onConnectTelegram}
                onOpen={onOpen}
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  if (active.length === 0) {
    const fullDate = formatLongDate(day);
    const dateLower = fullDate.charAt(0).toLowerCase() + fullDate.slice(1);

    return (
      <div className="py-10 text-center">
        <p className="text-sm text-stone-600">
          Nada marcado para {dateLower}.
        </p>
        {canCreate && (
          <button
            type="button"
            onClick={onNew}
            className="border border-stone-300 rounded-md px-3 py-2 text-sm text-stone-700 hover:bg-stone-50 font-medium transition mt-3"
          >
            Novo compromisso
          </button>
        )}
        {renderCancelledSection()}
      </div>
    );
  }

  return (
    <div>
      <div>
        {active.map((appt) => {
          let marker: string | null = null;
          if (isToday) {
            if (appt.id === ongoingApptId) {
              marker = 'agora';
            } else if (!ongoingApptId && appt.id === firstFutureApptId) {
              if (futureDiffMinutes < 60) {
                marker = `em ${futureDiffMinutes} min`;
              } else {
                const hours = Math.floor(futureDiffMinutes / 60);
                marker = `em ${hours} h`;
              }
            }
          }

          const isPast = new Date(appt.endTime) < now;
          const reminder = reminderLine(appt, { ownerTelegramLinked, isOwnCalendar });
          const createdByOther =
            appt.createdBy && appt.createdBy.id !== ownerId
              ? appt.createdBy.name.trim().split(/\s+/)[0]
              : null;

          return (
            <AppointmentRow
              key={appt.id}
              appt={appt}
              isPast={isPast}
              marker={marker}
              reminder={reminder}
              createdByOther={createdByOther}
              onConnectTelegram={onConnectTelegram}
              onOpen={onOpen}
            />
          );
        })}
      </div>

      {renderCancelledSection()}
    </div>
  );
}
