import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, Loader2, X } from 'lucide-react';
import { Appointment, Calendar } from '../../types';
import { checkIsPast, todayStr } from '../../lib/format';
import { formatTime, toDateKey } from '../../lib/dates';

export interface AppointmentFormValues {
  title: string;
  date: string;
  time: string;
  endTime: string;
  description: string;
  reminder: 'none' | number;
}

export interface AppointmentPanelProps {
  mode: 'create' | 'edit';
  appointment?: Appointment;
  calendar: Calendar;
  defaultDate: string;
  canEdit: boolean;
  canCancel: boolean;
  saving: boolean;
  serverError: string | null;
  onClose: () => void;
  onSubmit: (values: AppointmentFormValues) => void;
  onRequestCancel: () => void;
}

const STANDARD_REMINDER_OPTIONS: Array<{ value: 'none' | number; label: string }> = [
  { value: 'none', label: 'Sem lembrete' },
  { value: 0, label: 'Na hora' },
  { value: 15, label: '15 minutos antes' },
  { value: 30, label: '30 minutos antes' },
  { value: 60, label: '1 hora antes' },
  { value: 1440, label: '1 dia antes' },
];

export function AppointmentPanel({
  mode,
  appointment,
  calendar,
  defaultDate,
  canEdit,
  canCancel,
  saving,
  serverError,
  onClose,
  onSubmit,
  onRequestCancel,
}: AppointmentPanelProps) {
  const isEdit = mode === 'edit' && Boolean(appointment);
  const isCancelled = appointment?.status === 'CANCELLED';

  const isOneHour = useMemo(() => {
    if (!isEdit || !appointment?.endTime) return true;
    const startMs = new Date(appointment.startTime).getTime();
    const endMs = new Date(appointment.endTime).getTime();
    return Math.round((endMs - startMs) / 60000) === 60;
  }, [isEdit, appointment]);

  const [title, setTitle] = useState(() => (isEdit && appointment ? appointment.title : ''));
  const [date, setDate] = useState(() => {
    if (isEdit && appointment) {
      return toDateKey(new Date(appointment.startTime));
    }
    return defaultDate || todayStr;
  });
  const [time, setTime] = useState(() => {
    if (isEdit && appointment) {
      return formatTime(appointment.startTime);
    }
    return '08:00';
  });
  const [endTime, setEndTime] = useState(() => {
    if (isEdit && appointment?.endTime) {
      return isOneHour ? '' : formatTime(appointment.endTime);
    }
    return '';
  });
  const [description, setDescription] = useState(() => {
    return isEdit && appointment?.description ? appointment.description : '';
  });

  const [reminder, setReminder] = useState<'none' | number>(() => {
    if (isEdit && appointment) {
      const hasActiveReminder = appointment.reminders?.some(
        (r) => r.status === 'PENDING' || r.status === 'SENT' || r.status === 'FAILED',
      );
      if (!hasActiveReminder) {
        return 'none';
      }
      return appointment.reminderMinutesBefore ?? 30;
    }
    return 30;
  });

  const [showMoreOptions, setShowMoreOptions] = useState(() => {
    if (isEdit && appointment) {
      const hasDescription = Boolean(appointment.description?.trim());
      return hasDescription || !isOneHour;
    }
    return false;
  });

  const [errors, setErrors] = useState<{
    title?: string;
    dateTime?: string;
    endTime?: string;
  }>({});

  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleInputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const reminderOptions = useMemo(() => {
    const options = [...STANDARD_REMINDER_OPTIONS];
    if (
      typeof reminder === 'number' &&
      !STANDARD_REMINDER_OPTIONS.some((opt) => opt.value === reminder)
    ) {
      options.push({ value: reminder, label: `${reminder} minutos antes` });
    }
    return options;
  }, [reminder]);

  const disabled = isCancelled || !canEdit || saving;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (disabled) return;

    const newErrors: {
      title?: string;
      dateTime?: string;
      endTime?: string;
    } = {};

    if (!title.trim()) {
      newErrors.title = 'Diga o que é o compromisso.';
    }

    if (!date || !time) {
      newErrors.dateTime = 'Escolha o dia e o horário.';
    } else if (mode === 'create' && checkIsPast(date, time)) {
      newErrors.dateTime = 'Escolha um horário a partir de agora.';
    }

    if (time && endTime) {
      const [startH, startM] = time.split(':').map(Number);
      const [endH, endM] = endTime.split(':').map(Number);
      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;
      if (endMinutes <= startMinutes) {
        newErrors.endTime = 'O término deve ser depois do início.';
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    onSubmit({
      title,
      date,
      time,
      endTime,
      description,
      reminder,
    });
  };

  return (
    <>
      {/* Fundo */}
      <div
        className="fixed inset-0 bg-stone-900/30 z-30 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Painel lateral / tela cheia no celular */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="painel-titulo"
        className="fixed inset-y-0 right-0 z-40 w-full sm:w-[420px] bg-white border-l border-stone-200 shadow-xl flex flex-col"
      >
        <form onSubmit={handleSubmit} noValidate className="flex flex-col h-full min-h-0">
          {/* Cabeçalho */}
          <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between">
            <h2 id="painel-titulo" className="text-base font-semibold text-stone-900">
              {mode === 'create' ? 'Novo compromisso' : 'Editar compromisso'}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="p-1.5 rounded-md text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Corpo rolável */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {/* Linha da agenda */}
            <div className="flex items-center gap-2 text-sm text-stone-600">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: calendar.color }}
                aria-hidden="true"
              />
              <span>{calendar.name}</span>
            </div>

            {/* Alerta de erro do servidor */}
            {serverError && (
              <div
                role="alert"
                className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2"
              >
                {serverError}
              </div>
            )}

            {/* Aviso de cancelado */}
            {isCancelled && (
              <div className="text-sm text-stone-600 bg-stone-100 rounded-md px-3 py-2">
                Este compromisso foi cancelado.
              </div>
            )}

            {/* Aviso de somente leitura */}
            {!canEdit && !isCancelled && (
              <div className="text-sm text-stone-600 bg-stone-100 rounded-md px-3 py-2">
                Você pode ver este compromisso, mas não alterá-lo.
              </div>
            )}

            {/* Campo 1: O que é? */}
            <div>
              <label htmlFor="appt-title" className="block text-sm font-medium text-stone-700 mb-1">
                O que é?
              </label>
              <input
                ref={titleInputRef}
                id="appt-title"
                type="text"
                disabled={disabled}
                placeholder="Consulta com Dr. João"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (errors.title) setErrors((prev) => ({ ...prev, title: undefined }));
                }}
                aria-describedby={errors.title ? 'appt-title-error' : undefined}
                className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm min-h-[44px] focus:ring-2 focus:ring-brand-700 focus:outline-none disabled:bg-stone-100 disabled:text-stone-500"
              />
              {errors.title && (
                <p id="appt-title-error" className="text-xs text-red-600 mt-1">
                  {errors.title}
                </p>
              )}
            </div>

            {/* Campo 2: Dia e Horário */}
            <div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="appt-date" className="block text-sm font-medium text-stone-700 mb-1">
                    Dia
                  </label>
                  <input
                    id="appt-date"
                    type="date"
                    disabled={disabled}
                    value={date}
                    onChange={(e) => {
                      setDate(e.target.value);
                      if (errors.dateTime) setErrors((prev) => ({ ...prev, dateTime: undefined }));
                    }}
                    aria-describedby={errors.dateTime ? 'appt-datetime-error' : undefined}
                    className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm min-h-[44px] focus:ring-2 focus:ring-brand-700 focus:outline-none disabled:bg-stone-100 disabled:text-stone-500"
                  />
                </div>
                <div>
                  <label htmlFor="appt-time" className="block text-sm font-medium text-stone-700 mb-1">
                    Horário
                  </label>
                  <input
                    id="appt-time"
                    type="time"
                    disabled={disabled}
                    value={time}
                    onChange={(e) => {
                      setTime(e.target.value);
                      if (errors.dateTime) setErrors((prev) => ({ ...prev, dateTime: undefined }));
                    }}
                    aria-describedby={errors.dateTime ? 'appt-datetime-error' : undefined}
                    className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm min-h-[44px] focus:ring-2 focus:ring-brand-700 focus:outline-none disabled:bg-stone-100 disabled:text-stone-500"
                  />
                </div>
              </div>
              {errors.dateTime && (
                <p id="appt-datetime-error" className="text-xs text-red-600 mt-1">
                  {errors.dateTime}
                </p>
              )}
            </div>

            {/* Campo 3: Lembrete no Telegram */}
            <div>
              <label htmlFor="appt-reminder" className="block text-sm font-medium text-stone-700 mb-1">
                Lembrete no Telegram
              </label>
              <select
                id="appt-reminder"
                disabled={disabled}
                value={String(reminder)}
                onChange={(e) => {
                  const val = e.target.value;
                  setReminder(val === 'none' ? 'none' : Number(val));
                }}
                className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm min-h-[44px] bg-white focus:ring-2 focus:ring-brand-700 focus:outline-none disabled:bg-stone-100 disabled:text-stone-500"
              >
                {reminderOptions.map((opt) => (
                  <option key={String(opt.value)} value={String(opt.value)}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Campo 4: Mais opções (Término e Descrição) */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowMoreOptions((prev) => !prev)}
                aria-expanded={showMoreOptions}
                className="flex items-center gap-1.5 text-sm font-medium text-stone-700 hover:text-stone-900 focus:outline-none"
              >
                <ChevronRight
                  className={`w-4 h-4 text-stone-500 transition-transform duration-200 ${
                    showMoreOptions ? 'rotate-90' : ''
                  }`}
                />
                <span>Mais opções</span>
              </button>

              {showMoreOptions && (
                <div className="mt-3 space-y-4 pl-1">
                  <div>
                    <label
                      htmlFor="appt-endtime"
                      className="block text-sm font-medium text-stone-700 mb-1"
                    >
                      Término
                    </label>
                    <input
                      id="appt-endtime"
                      type="time"
                      disabled={disabled}
                      value={endTime}
                      onChange={(e) => {
                        setEndTime(e.target.value);
                        if (errors.endTime) setErrors((prev) => ({ ...prev, endTime: undefined }));
                      }}
                      aria-describedby={errors.endTime ? 'appt-endtime-error' : undefined}
                      className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm min-h-[44px] focus:ring-2 focus:ring-brand-700 focus:outline-none disabled:bg-stone-100 disabled:text-stone-500"
                    />
                    {errors.endTime && (
                      <p id="appt-endtime-error" className="text-xs text-red-600 mt-1">
                        {errors.endTime}
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="appt-desc"
                      className="block text-sm font-medium text-stone-700 mb-1"
                    >
                      Descrição
                    </label>
                    <textarea
                      id="appt-desc"
                      rows={3}
                      disabled={disabled}
                      placeholder="Observações, link da reunião ou preparo..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-brand-700 focus:outline-none disabled:bg-stone-100 disabled:text-stone-500"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Rodapé */}
          <div className="px-5 py-4 border-t border-stone-200 flex items-center justify-between gap-3">
            <div>
              {mode === 'edit' && canCancel && !isCancelled && (
                <button
                  type="button"
                  onClick={onRequestCancel}
                  disabled={saving}
                  className="text-sm font-medium text-red-700 hover:bg-red-50 px-3 py-2 rounded-md transition disabled:opacity-50"
                >
                  Cancelar compromisso
                </button>
              )}
            </div>
            <div>
              {canEdit && !isCancelled && (
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-brand-700 hover:bg-brand-800 text-white min-h-[44px] px-4 py-2 rounded-md text-sm font-medium transition flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Salvando…</span>
                    </>
                  ) : (
                    <span>Salvar</span>
                  )}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </>
  );
}
