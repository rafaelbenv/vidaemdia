import React from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { Appointment } from '../../types';
import { formatTime } from '../../lib/dates';
import { reminderLine } from '../../lib/reminderText';

export interface AppointmentRowProps {
  appt: Appointment;
  isPast: boolean;
  marker: string | null;
  reminder: ReturnType<typeof reminderLine>;
  createdByOther: string | null;
  onConnectTelegram: () => void;
  onCancel: () => void;
  cancelling: boolean;
}

export function AppointmentRow({
  appt,
  isPast,
  marker,
  reminder,
  createdByOther,
  onConnectTelegram,
  onCancel,
  cancelling,
}: AppointmentRowProps) {
  const isCancelled = appt.status === 'CANCELLED';

  const timeClass =
    isCancelled || isPast
      ? 'text-sm font-semibold tabular-nums text-stone-400'
      : 'text-sm font-semibold tabular-nums text-stone-900';

  const titleClass = isCancelled
    ? 'text-sm font-medium line-through text-stone-400 truncate'
    : isPast
    ? 'text-sm font-medium text-stone-400 truncate'
    : 'text-sm font-medium text-stone-900 truncate';

  return (
    <div className="flex gap-4 py-3 border-b border-stone-100 last:border-0 items-center">
      {/* Esquerda */}
      <div className="w-14 shrink-0">
        <span className={timeClass}>{formatTime(appt.startTime)}</span>
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
        </div>

        {isCancelled ? (
          <div className="text-xs text-stone-500 mt-0.5">Cancelado</div>
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
                    onClick={onConnectTelegram}
                    className="text-brand-700 underline hover:text-brand-800 cursor-pointer text-left"
                  >
                    {reminder.text}
                  </button>
                )}
                {reminder.tone === 'muted' && <span>{reminder.text}</span>}
              </span>
            )}
            {createdByOther && (
              <>
                {(appt.description || reminder) && <span>·</span>}
                <span>por {createdByOther}</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Direita */}
      {!isCancelled && (
        <button
          type="button"
          onClick={onCancel}
          disabled={cancelling}
          aria-label="Cancelar compromisso"
          className="text-stone-400 hover:text-red-600 p-2 rounded-md transition disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
