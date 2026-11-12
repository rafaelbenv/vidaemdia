import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import {
  Appointment,
  Calendar,
  NotificationChannel,
  User,
} from '../types';
import {
  addDays,
  formatLongDate,
  fromDateKey,
  toDateKey,
} from '../lib/dates';
import { WeekStrip } from '../components/agenda/WeekStrip';
import { DayList } from '../components/agenda/DayList';
import { AppointmentForm } from '../components/agenda/AppointmentForm';

export interface AgendaPageProps {
  allAccessibleCalendars: Calendar[];
  selectedCalendarId: string;
  setSelectedCalendarId: (id: string) => void;
  user: User;
  formTitle: string;
  setFormTitle: (val: string) => void;
  formDate: string;
  setFormDate: (val: string) => void;
  formTime: string;
  setFormTime: (val: string) => void;
  dateError: string | null;
  setDateError: (err: string | null) => void;
  formDesc: string;
  setFormDesc: (val: string) => void;
  formChannel: NotificationChannel;
  setFormChannel: (channel: NotificationChannel) => void;
  formReminderMinutes: number;
  setFormReminderMinutes: (mins: number) => void;
  submitting: Record<string, boolean>;
  handleCreateAppointment: (e: React.FormEvent) => Promise<void>;
  activeCalendar?: Calendar;
  loadAppointments?: (calendarId: string) => Promise<void>;
  loadingAppointments: boolean;
  appointments: Appointment[];
  openCancelDialog: (appt: Appointment) => void;
  maxRetries?: number;
  telegramLinked?: boolean;
  onConnectTelegram: () => void;
}

export function AgendaPage({
  allAccessibleCalendars,
  selectedCalendarId,
  setSelectedCalendarId,
  user,
  formTitle,
  setFormTitle,
  formDate,
  setFormDate,
  formTime,
  setFormTime,
  dateError,
  setDateError,
  formDesc,
  setFormDesc,
  formChannel,
  setFormChannel,
  formReminderMinutes,
  setFormReminderMinutes,
  submitting,
  handleCreateAppointment,
  activeCalendar,
  loadingAppointments,
  appointments,
  openCancelDialog,
  telegramLinked,
  onConnectTelegram,
}: AgendaPageProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [showForm, setShowForm] = useState(false);
  const [now, setNow] = useState(() => new Date());

  // now: estado atualizado a cada 60 s para os marcadores
  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(new Date());
    }, 60000);
    return () => window.clearInterval(interval);
  }, []);

  const diaParam = searchParams.get('dia');
  const selectedDate = useMemo(() => {
    return diaParam ? fromDateKey(diaParam) : fromDateKey(toDateKey(new Date()));
  }, [diaParam]);

  const changeDate = (d: Date) => {
    setSearchParams({ dia: toDateKey(d) }, { replace: true });
  };

  const handleOpenNew = () => {
    setFormDate(toDateKey(selectedDate));
    setShowForm(true);
  };

  // Fecha o formulário automaticamente após salvar com sucesso
  const isSaving = Boolean(submitting['saveAppt']);
  const prevSavingRef = useRef(false);

  useEffect(() => {
    if (prevSavingRef.current && !isSaving && !dateError && formTitle === '') {
      setShowForm(false);
    }
    prevSavingRef.current = isSaving;
  }, [isSaving, dateError, formTitle]);

  const ownedCalendars = useMemo(
    () => allAccessibleCalendars.filter((c) => c.ownerId === user.id),
    [allAccessibleCalendars, user.id],
  );
  const delegatedCalendars = useMemo(
    () => allAccessibleCalendars.filter((c) => c.ownerId !== user.id),
    [allAccessibleCalendars, user.id],
  );

  const isOwnCalendar = activeCalendar ? activeCalendar.ownerId === user.id : true;
  const ownerTelegramLinked = isOwnCalendar
    ? Boolean(telegramLinked)
    : appointments.length === 0
    ? true
    : Boolean(appointments[0]?.calendar?.owner?.telegramChatId);

  // Contagens só de ativos por toDateKey(startTime)
  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const appt of appointments) {
      if (appt.status !== 'CANCELLED') {
        const key = toDateKey(new Date(appt.startTime));
        map[key] = (map[key] ?? 0) + 1;
      }
    }
    return map;
  }, [appointments]);

  // Compromissos do dia selecionado
  const selectedDayKey = toDateKey(selectedDate);
  const dayAppointments = useMemo(() => {
    return appointments.filter(
      (appt) => toDateKey(new Date(appt.startTime)) === selectedDayKey,
    );
  }, [appointments, selectedDayKey]);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
      {/* 1. Seletor de agenda */}
      <div className="flex items-center gap-3 min-w-0">
        <label
          htmlFor="calendar-select"
          className="text-sm font-medium text-stone-700 shrink-0"
        >
          Agenda
        </label>
        <div className="flex items-center gap-2 min-w-0">
          <select
            id="calendar-select"
            value={selectedCalendarId}
            onChange={(e) => setSelectedCalendarId(e.target.value)}
            className="min-w-0 flex-1 sm:flex-none sm:max-w-sm truncate border border-stone-300 rounded-md px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-brand-700 focus:outline-none"
          >
            <optgroup label="Minhas agendas">
              {ownedCalendars.map((cal) => (
                <option key={cal.id} value={cal.id}>
                  {cal.name}
                </option>
              ))}
            </optgroup>
            {delegatedCalendars.length > 0 && (
              <optgroup label="Agendas que gerencio">
                {delegatedCalendars.map((cal) => (
                  <option key={cal.id} value={cal.id}>
                    {cal.name} ({cal.owner?.name ?? 'Outro'})
                  </option>
                ))}
              </optgroup>
            )}
          </select>
          {activeCalendar?.color && (
            <span
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: activeCalendar.color }}
              aria-hidden="true"
            />
          )}
        </div>
      </div>

      {/* 2. Cabeçalho do dia */}
      <div className="flex flex-wrap items-center justify-between gap-3 mt-6">
        <h1 className="text-xl font-semibold text-stone-900">
          {formatLongDate(selectedDate)}
        </h1>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => changeDate(new Date())}
            className="border border-stone-300 rounded-md px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 transition"
          >
            Hoje
          </button>
          <button
            type="button"
            onClick={() => changeDate(addDays(selectedDate, -7))}
            aria-label="Semana anterior"
            className="p-2 border border-stone-300 rounded-md hover:bg-stone-50 text-stone-600 transition flex items-center justify-center"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => changeDate(addDays(selectedDate, 7))}
            aria-label="Próxima semana"
            className="p-2 border border-stone-300 rounded-md hover:bg-stone-50 text-stone-600 transition flex items-center justify-center"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleOpenNew}
            className="hidden sm:inline-flex items-center gap-1.5 bg-brand-700 hover:bg-brand-800 text-white rounded-md px-3 py-2 text-sm font-medium transition"
          >
            + Novo compromisso
          </button>
        </div>
      </div>

      {/* 3. Tira da semana */}
      <div className="mt-4">
        <WeekStrip
          selected={selectedDate}
          counts={counts}
          onSelect={changeDate}
        />
      </div>

      {/* 4. Formulário (temporário) */}
      {showForm && (
        <div className="mt-4">
          <AppointmentForm
            formTitle={formTitle}
            setFormTitle={setFormTitle}
            formDate={formDate}
            setFormDate={setFormDate}
            formTime={formTime}
            setFormTime={setFormTime}
            dateError={dateError}
            setDateError={setDateError}
            formDesc={formDesc}
            setFormDesc={setFormDesc}
            formChannel={formChannel}
            setFormChannel={setFormChannel}
            formReminderMinutes={formReminderMinutes}
            setFormReminderMinutes={setFormReminderMinutes}
            submitting={submitting}
            handleCreateAppointment={handleCreateAppointment}
            onClose={() => setShowForm(false)}
          />
        </div>
      )}

      {/* 5. Lista do dia */}
      <div className="bg-white rounded-lg border border-stone-200 px-4 mt-4">
        {loadingAppointments ? (
          <div className="py-6 text-center text-sm text-stone-500">
            Carregando…
          </div>
        ) : (
          <DayList
            day={selectedDate}
            appointments={dayAppointments}
            now={now}
            ownerId={activeCalendar?.ownerId ?? user.id}
            ownerTelegramLinked={ownerTelegramLinked}
            isOwnCalendar={isOwnCalendar}
            onConnectTelegram={onConnectTelegram}
            onCancel={openCancelDialog}
            submitting={submitting}
            onNew={handleOpenNew}
          />
        )}
      </div>

      {/* 6. Celular: botão flutuante */}
      <button
        type="button"
        onClick={handleOpenNew}
        aria-label="Novo compromisso"
        className="sm:hidden fixed bottom-5 right-5 w-14 h-14 rounded-full bg-brand-700 hover:bg-brand-800 text-white shadow-lg flex items-center justify-center transition z-20"
      >
        <Plus className="w-6 h-6" />
      </button>
    </div>
  );
}
