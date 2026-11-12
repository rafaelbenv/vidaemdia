import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import {
  Appointment,
  Calendar,
  User,
} from '../types';
import {
  addDays,
  addMonths,
  formatLongDate,
  formatMonthYear,
  fromDateKey,
  toDateKey,
} from '../lib/dates';
import { WeekStrip } from '../components/agenda/WeekStrip';
import { DayList } from '../components/agenda/DayList';
import { MonthGrid } from '../components/agenda/MonthGrid';

export interface AgendaPageProps {
  allAccessibleCalendars: Calendar[];
  selectedCalendarId: string;
  setSelectedCalendarId: (id: string) => void;
  user: User;
  activeCalendar?: Calendar;
  canCreate: boolean;
  loadingAppointments: boolean;
  appointments: Appointment[];
  onOpenAppointment: (appt: Appointment) => void;
  onNewAppointment: (date?: string) => void;
  telegramLinked?: boolean;
  onConnectTelegram: () => void;
}

export function AgendaPage({
  allAccessibleCalendars,
  selectedCalendarId,
  setSelectedCalendarId,
  user,
  activeCalendar,
  canCreate,
  loadingAppointments,
  appointments,
  onOpenAppointment,
  onNewAppointment,
  telegramLinked,
  onConnectTelegram,
}: AgendaPageProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [now, setNow] = useState(() => new Date());

  // now: estado atualizado a cada 60 s para os marcadores
  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(new Date());
    }, 60000);
    return () => window.clearInterval(interval);
  }, []);

  const diaParam = searchParams.get('dia');
  const visaoParam = searchParams.get('visao');
  const isMonthView = visaoParam === 'mes';

  const selectedDate = useMemo(() => {
    return diaParam ? fromDateKey(diaParam) : fromDateKey(toDateKey(new Date()));
  }, [diaParam]);

  const changeDate = (d: Date) => {
    setSearchParams({ dia: toDateKey(d) }, { replace: true });
  };

  const handleViewChange = (newView: 'dia' | 'mes') => {
    if (newView === 'mes') {
      setSearchParams(
        { visao: 'mes', dia: toDateKey(selectedDate) },
        { replace: true },
      );
    } else {
      setSearchParams({ dia: toDateKey(selectedDate) }, { replace: true });
    }
  };

  const handleSelectMonthDay = (d: Date) => {
    const isSm =
      typeof window !== 'undefined' &&
      window.matchMedia('(min-width: 640px)').matches;
    if (isSm) {
      setSearchParams({ dia: toDateKey(d) }, { replace: true });
    } else {
      setSearchParams({ visao: 'mes', dia: toDateKey(d) }, { replace: true });
    }
  };

  const handleToday = () => {
    if (isMonthView) {
      setSearchParams(
        { visao: 'mes', dia: toDateKey(new Date()) },
        { replace: true },
      );
    } else {
      changeDate(new Date());
    }
  };

  const handlePrev = () => {
    if (isMonthView) {
      setSearchParams(
        { visao: 'mes', dia: toDateKey(addMonths(selectedDate, -1)) },
        { replace: true },
      );
    } else {
      changeDate(addDays(selectedDate, -7));
    }
  };

  const handleNext = () => {
    if (isMonthView) {
      setSearchParams(
        { visao: 'mes', dia: toDateKey(addMonths(selectedDate, 1)) },
        { replace: true },
      );
    } else {
      changeDate(addDays(selectedDate, 7));
    }
  };

  const handleOpenNew = () => {
    onNewAppointment(toDateKey(selectedDate));
  };

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

  // failed = dias com algum compromisso ativo cujo reminders[0].status === 'FAILED'
  const failed = useMemo(() => {
    const set = new Set<string>();
    for (const appt of appointments) {
      if (
        appt.status !== 'CANCELLED' &&
        appt.reminders?.[0]?.status === 'FAILED'
      ) {
        set.add(toDateKey(new Date(appt.startTime)));
      }
    }
    return set;
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

      {/* 2. Cabeçalho da data e controles */}
      <div className="flex flex-wrap items-center justify-between gap-3 mt-6">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-stone-900">
            {isMonthView ? formatMonthYear(selectedDate) : formatLongDate(selectedDate)}
          </h1>

          {/* Seletor segmentado "Dia | Mês" */}
          <div
            role="group"
            aria-label="Visão"
            className="bg-stone-100 rounded-md p-0.5 inline-flex"
          >
            <button
              type="button"
              onClick={() => handleViewChange('dia')}
              aria-pressed={!isMonthView}
              className={`px-3 py-1.5 rounded text-xs sm:text-sm font-medium transition ${
                !isMonthView
                  ? 'bg-white shadow-sm text-stone-900'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Dia
            </button>
            <button
              type="button"
              onClick={() => handleViewChange('mes')}
              aria-pressed={isMonthView}
              className={`px-3 py-1.5 rounded text-xs sm:text-sm font-medium transition ${
                isMonthView
                  ? 'bg-white shadow-sm text-stone-900'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Mês
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleToday}
            className="border border-stone-300 rounded-md px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 transition"
          >
            Hoje
          </button>
          <button
            type="button"
            onClick={handlePrev}
            aria-label={isMonthView ? 'Mês anterior' : 'Semana anterior'}
            className="p-2 border border-stone-300 rounded-md hover:bg-stone-50 text-stone-600 transition flex items-center justify-center"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleNext}
            aria-label={isMonthView ? 'Próximo mês' : 'Próxima semana'}
            className="p-2 border border-stone-300 rounded-md hover:bg-stone-50 text-stone-600 transition flex items-center justify-center"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          {canCreate && (
            <button
              type="button"
              onClick={handleOpenNew}
              className="hidden sm:inline-flex items-center gap-1.5 bg-brand-700 hover:bg-brand-800 text-white rounded-md px-3 py-2 text-sm font-medium transition"
            >
              + Novo compromisso
            </button>
          )}
        </div>
      </div>

      {/* 3. Conteúdo principal: Mês ou Dia */}
      {isMonthView ? (
        <div className="mt-4">
          <MonthGrid
            month={selectedDate}
            selected={selectedDate}
            today={now}
            counts={counts}
            failed={failed}
            onSelect={handleSelectMonthDay}
          />

          {/* Celular: lista do dia abaixo da grade */}
          <div className="sm:hidden mt-4">
            <h2 className="text-sm font-semibold mt-4 text-stone-900">
              {formatLongDate(selectedDate)}
            </h2>
            <div className="bg-white rounded-lg border border-stone-200 px-4 mt-2">
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
                  canCreate={canCreate}
                  onConnectTelegram={onConnectTelegram}
                  onOpen={onOpenAppointment}
                  onNew={handleOpenNew}
                />
              )}
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Tira da semana */}
          <div className="mt-4">
            <WeekStrip
              selected={selectedDate}
              counts={counts}
              onSelect={changeDate}
            />
          </div>

          {/* Lista do dia */}
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
                canCreate={canCreate}
                onConnectTelegram={onConnectTelegram}
                onOpen={onOpenAppointment}
                onNew={handleOpenNew}
              />
            )}
          </div>
        </>
      )}

      {/* 4. Celular: botão flutuante */}
      {canCreate && (
        <button
          type="button"
          onClick={handleOpenNew}
          aria-label="Novo compromisso"
          className="sm:hidden fixed bottom-5 right-5 w-14 h-14 rounded-full bg-brand-700 hover:bg-brand-800 text-white shadow-lg flex items-center justify-center transition z-20"
        >
          <Plus className="w-6 h-6" />
        </button>
      )}
    </div>
  );
}
