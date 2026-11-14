import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Appointment } from '../../types';
import { formatTime } from '../../lib/dates';
import { reminderLine } from '../../lib/reminderText';

export interface AppointmentRowProps {
  appt: Appointment;
  isPast: boolean;
  marker: string | null;
  reminder: ReturnType<typeof reminderLine>;
  createdByOther: string | null;
  isOwner?: boolean;
  onConnectTelegram: () => void;
  onOpen: (appt: Appointment) => void;
}

export function AppointmentRow({
  appt,
  isPast,
  marker,
  reminder,
  createdByOther,
  isOwner = true,
  onConnectTelegram,
  onOpen,
}: AppointmentRowProps) {
  const isCancelled = appt.status === 'CANCELLED';

  const timeClass =
    isCancelled || isPast
      ? `${appt.allDay ? 'text-xs' : 'text-sm'} font-semibold tabular-nums text-stone-500`
      : `${appt.allDay ? 'text-xs' : 'text-sm'} font-semibold tabular-nums text-stone-900`;

  const titleClass = isCancelled
    ? 'text-sm font-medium line-through text-stone-500 truncate'
    : isPast
    ? 'text-sm font-medium text-stone-500 truncate'
    : 'text-sm font-medium text-stone-900 truncate';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(appt)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen(appt);
        }
      }}
      className="w-full text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 rounded-md py-3 px-2 -mx-2 border-b border-stone-100 last:border-0 hover:bg-stone-50/70 transition-colors flex gap-4 items-center"
    >
      {/* Esquerda */}
      <div className="w-14 shrink-0">
        <span className={timeClass}>
          {appt.allDay ? 'Dia inteiro' : formatTime(appt.startTime)}
        </span>
      </div>

      {/* Centro */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={titleClass}>{appt.title}</span>
          {marker && !isCancelled && (
            <span className="text-[11px] font-semibold text-brand-800 bg-brand-50 rounded px-1.5 py-0.5 shrink-0">
              {marker}
            </span>
          )}
          {!isCancelled && appt.hasConflict && (
            <span className="text-[11px] font-semibold rounded px-1.5 py-0.5 shrink-0 text-amber-800 bg-amber-50 inline-flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>Conflito de horário</span>
            </span>
          )}
          {!isCancelled && appt.createdVia === 'GOOGLE' && (
            <span className="text-[11px] font-semibold rounded px-1.5 py-0.5 shrink-0 text-stone-600 bg-stone-100">
              Google
            </span>
          )}
          {!isCancelled && appt.isPrivate && isOwner && (
            <span className="text-[11px] font-semibold rounded px-1.5 py-0.5 shrink-0 text-stone-600 bg-stone-100">
              Privado
            </span>
          )}
        </div>

        {isCancelled ? (
          <div className="text-xs text-stone-500 mt-0.5 flex flex-wrap items-center gap-x-1.5">
            <span>Cancelado</span>
            {appt.googleSyncError && (
              <>
                <span>·</span>
                <span
                  className="text-red-600 inline-flex items-center gap-1"
                  title={appt.googleSyncError}
                >
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>Não foi para o Google</span>
                </span>
              </>
            )}
          </div>
        ) : (
          <div className="text-xs text-stone-500 mt-0.5 flex flex-wrap items-center gap-x-1.5">
            {appt.description && (
              <span className="truncate max-w-xs">{appt.description}</span>
            )}
            {appt.description && reminder && <span>·</span>}
            {reminder && (
              <span className="inline-flex items-center gap-1">
                {reminder.tone === 'danger' && (
                  <span className="text-red-600 inline-flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    {reminder.text}
                  </span>
                )}
                {reminder.tone === 'action' && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onConnectTelegram();
                    }}
                    className="text-brand-700 underline hover:text-brand-800 cursor-pointer text-left"
                  >
                    {reminder.text}
                  </button>
                )}
                {reminder.tone === 'muted' && <span>{reminder.text}</span>}
              </span>
            )}
            {appt.googleSyncError && (
              <>
                {(appt.description || reminder) && <span>·</span>}
                <span
                  className="text-red-600 inline-flex items-center gap-1"
                  title={appt.googleSyncError}
                >
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>Não foi para o Google</span>
                </span>
              </>
            )}
            {createdByOther && (
              <>
                {(appt.description || reminder || appt.googleSyncError) && <span>·</span>}
                <span>por {createdByOther}</span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
