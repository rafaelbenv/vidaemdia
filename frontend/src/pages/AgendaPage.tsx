import React from 'react';
import {
  Calendar as CalendarIcon,
  Plus,
  AlertTriangle,
  RefreshCw,
  Clock,
  Bell,
  Trash2,
} from 'lucide-react';
import {
  Appointment,
  Calendar,
  NotificationChannel,
  User,
} from '../types';
import { checkIsPast, todayStr } from '../lib/format';
import { TechTag } from '../components/TechTag';

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
  loadAppointments: (calendarId: string) => Promise<void>;
  loadingAppointments: boolean;
  appointments: Appointment[];
  openCancelDialog: (appt: Appointment) => void;
  maxRetries?: number;
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
  loadAppointments,
  loadingAppointments,
  appointments,
  openCancelDialog,
  maxRetries = 3,
}: AgendaPageProps) {
  return (
    <div role="tabpanel" id="tabpanel-agenda" aria-labelledby="tab-agenda">
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Coluna Esquerda: Seletor de Agenda + Formulário de Novo Compromisso */}
        <div className="space-y-6">
          {/* Seleção da Agenda Ativa */}
          <div className="bg-white rounded-lg border border-stone-200 p-5">
            <div className="pb-3 mb-4 border-b border-stone-100 flex items-center justify-between">
              <h3 className="text-base font-semibold text-stone-900 flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-brand-700" />
                Agendas Autorizadas (Pessoal / Profissional)
                <TechTag>Fluxo Principal</TechTag>
              </h3>
            </div>

            <div className="space-y-2">
              {allAccessibleCalendars.map((cal) => {
                const isDelegated = cal.ownerId !== user.id;
                const isSelected = cal.id === selectedCalendarId;
                return (
                  <button
                    key={cal.id}
                    onClick={() => setSelectedCalendarId(cal.id)}
                    className={`w-full text-left p-3 rounded-md border transition flex items-center justify-between ${
                      isSelected
                        ? 'border-brand-700 bg-brand-50 ring-1 ring-brand-700'
                        : 'border-stone-200 hover:bg-stone-50'
                    }`}
                  >
                    <div>
                      <div className="text-sm font-semibold text-stone-900 flex items-center gap-1.5">
                        <span
                          className="w-2.5 h-2.5 rounded-full inline-block"
                          style={{ backgroundColor: cal.color }}
                        />
                        {cal.name}
                      </div>
                      <div className="text-xs text-stone-500 mt-0.5">
                        {isDelegated
                          ? `Delegada via RBAC (${cal.owner?.name})`
                          : `Tipo: ${cal.type === 'PROFESSIONAL' ? 'Profissional' : 'Pessoal'}`}
                      </div>
                    </div>
                    <span
                      className={`text-[11px] font-mono px-2 py-0.5 rounded-md font-semibold ${
                        isDelegated
                          ? 'bg-amber-100 text-amber-800'
                          : cal.type === 'PROFESSIONAL'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-stone-100 text-stone-800'
                      }`}
                    >
                      {isDelegated ? 'RBAC' : cal.type}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Formulário de Novo Compromisso (Etapa 3 e 4 do Fluxo Principal) */}
          <div className="bg-white rounded-lg border border-stone-200 p-5">
            <div className="pb-3 mb-4 border-b border-stone-100">
              <h3 className="text-base font-semibold text-stone-900 flex items-center gap-2">
                <Plus className="w-4 h-4 text-brand-700" />
                Novo Compromisso
              </h3>
              <p className="text-xs text-stone-500 mt-1">
                Preenche Título · Data · Horário · Descrição · Lembrete →{' '}
                <TechTag>POST /compromissos</TechTag>
              </p>
            </div>

            <form onSubmit={handleCreateAppointment} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  Título do Compromisso *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex.: Consulta médica hoje às 08:00"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-3 py-2 text-base border border-stone-300 rounded-md focus:ring-2 focus:ring-brand-700 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">Data *</label>
                  <input
                    type="date"
                    required
                    min={todayStr}
                    value={formDate}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormDate(val);
                      if (val && formTime) {
                        if (checkIsPast(val, formTime)) {
                          setDateError('A data e horário do compromisso não podem estar no passado.');
                        } else {
                          setDateError(null);
                        }
                      }
                    }}
                    className={`w-full px-3 py-2 text-base border rounded-md focus:ring-2 focus:ring-brand-700 focus:outline-none ${
                      dateError ? 'border-red-500' : 'border-stone-300'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">Horário *</label>
                  <input
                    type="time"
                    required
                    value={formTime}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormTime(val);
                      if (formDate && val) {
                        if (checkIsPast(formDate, val)) {
                          setDateError('A data e horário do compromisso não podem estar no passado.');
                        } else {
                          setDateError(null);
                        }
                      }
                    }}
                    className={`w-full px-3 py-2 text-base border rounded-md focus:ring-2 focus:ring-brand-700 focus:outline-none ${
                      dateError ? 'border-red-500' : 'border-stone-300'
                    }`}
                  />
                </div>
              </div>

              {dateError && (
                <p className="text-xs text-red-600 flex items-center gap-1 font-medium mt-1">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  {dateError}
                </p>
              )}

              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">Descrição</label>
                <textarea
                  rows={2}
                  placeholder="Observações, link da reunião ou preparo de consulta..."
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  className="w-full px-3 py-2 text-base border border-stone-300 rounded-md focus:ring-2 focus:ring-brand-700 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    Canal do Lembrete
                  </label>
                  <select
                    value={formChannel}
                    onChange={(e) => setFormChannel(e.target.value as NotificationChannel)}
                    className="w-full px-3 py-2 text-base border border-stone-300 rounded-md bg-white focus:ring-2 focus:ring-brand-700 focus:outline-none"
                  >
                    <option value="TELEGRAM">Telegram</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    Disparo do Lembrete
                  </label>
                  <select
                    value={formReminderMinutes}
                    onChange={(e) => setFormReminderMinutes(Number(e.target.value))}
                    className="w-full px-3 py-2 text-base border border-stone-300 rounded-md bg-white focus:ring-2 focus:ring-brand-700 focus:outline-none"
                  >
                    <option value={0}>Imediato (Próx. ciclo Worker)</option>
                    <option value={15}>15 min antes</option>
                    <option value={30}>30 min antes</option>
                    <option value={60}>1 hora antes</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting['saveAppt']}
                className="w-full py-2.5 px-4 bg-brand-700 hover:bg-brand-800 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium text-sm rounded-md transition flex items-center justify-center gap-2"
              >
                {submitting['saveAppt'] ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Salvando…
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Salvar Compromisso na Agenda
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Coluna Direita (2 cols): Calendário / Lista de Compromissos */}
        <div className="lg:col-span-2 bg-white rounded-lg border border-stone-200 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 mb-5 border-b border-stone-100">
            <div>
              <h2 className="text-base font-semibold text-stone-900 flex items-center gap-2">
                {activeCalendar ? activeCalendar.name : 'Selecione uma Agenda'}
                {activeCalendar && activeCalendar.ownerId !== user.id && (
                  <span className="text-xs px-2.5 py-0.5 bg-amber-100 text-amber-900 rounded-full font-semibold">
                    Modo Secretária (RBAC Autorizado)
                  </span>
                )}
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">
                {activeCalendar?.description || 'Compromissos sincronizados com o PostgreSQL'}
              </p>
            </div>

            <button
              onClick={() => selectedCalendarId && loadAppointments(selectedCalendarId)}
              className="px-3 py-1.5 rounded-md border border-stone-300 hover:bg-stone-50 text-xs font-medium flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Atualizar Agenda
            </button>
          </div>

          {loadingAppointments ? (
            <div className="space-y-3">
              <div className="h-20 bg-stone-100 animate-pulse rounded" />
              <div className="h-20 bg-stone-100 animate-pulse rounded" />
              <div className="h-20 bg-stone-100 animate-pulse rounded" />
            </div>
          ) : appointments.length === 0 ? (
            <div className="text-center py-12 px-4 bg-stone-50 rounded-md border border-dashed border-stone-200">
              <CalendarIcon className="w-8 h-8 text-stone-400 mx-auto mb-2" />
              <p className="text-sm font-semibold text-stone-700">Nenhum compromisso cadastrado nesta agenda</p>
              <p className="text-xs text-stone-500 mt-1">
                Utilize o formulário ao lado para agendar um novo compromisso nesta agenda.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {appointments.map((appt) => {
                const start = new Date(appt.startTime);
                const reminder = appt.reminders?.[0];
                return (
                  <div
                    key={appt.id}
                    className={`p-4 rounded-md border transition flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                      appt.status === 'CANCELLED'
                        ? 'bg-stone-50 border-stone-200 opacity-60'
                        : 'bg-white border-stone-200 hover:border-brand-700'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`font-semibold text-sm ${
                            appt.status === 'CANCELLED' ? 'line-through text-stone-500' : 'text-stone-900'
                          }`}
                        >
                          {appt.title}
                        </span>

                        <span
                          className={`text-[11px] font-mono px-2 py-0.5 rounded-full font-semibold ${
                            appt.status === 'SCHEDULED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {appt.status === 'SCHEDULED' ? 'AGENDADO' : 'CANCELADO'}
                        </span>

                        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-stone-100 text-stone-700">
                          Origem: {appt.createdVia === 'WHATSAPP' ? 'TELEGRAM' : appt.createdVia}
                        </span>
                      </div>

                      {appt.description && (
                        <p className="text-xs text-stone-600">{appt.description}</p>
                      )}

                      <div className="flex flex-wrap items-center gap-4 text-xs text-stone-500 pt-1">
                        <span className="flex items-center gap-1 font-medium text-stone-700">
                          <Clock className="w-3.5 h-3.5 text-brand-700" />
                          {start.toLocaleDateString('pt-BR')} às{' '}
                          {start.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>

                        <span>Criado por: {appt.createdBy?.name || 'Usuário'}</span>

                        {reminder && (
                          <span
                            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-semibold ${
                              reminder.status === 'SENT'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : reminder.status === 'FAILED'
                                ? 'bg-red-50 text-red-700 border border-red-200'
                                : 'bg-amber-50 text-amber-800 border border-amber-200'
                            }`}
                          >
                            <Bell className="w-3 h-3" />
                            Lembrete Telegram:{' '}
                            {reminder.status === 'SENT'
                              ? 'ENVIADO ✅'
                              : reminder.status === 'FAILED'
                              ? `FALHOU (${reminder.retryCount}/${maxRetries}) ❌`
                              : `PENDENTE (Tentativas: ${reminder.retryCount}/${maxRetries})`}
                          </span>
                        )}
                      </div>
                    </div>

                    {appt.status === 'SCHEDULED' && (
                      <button
                        onClick={() => openCancelDialog(appt)}
                        disabled={submitting[`cancelAppt:${appt.id}`]}
                        className="self-start sm:self-center px-3 py-1.5 rounded-md border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-60 disabled:cursor-not-allowed text-xs font-medium flex items-center gap-1.5 shrink-0"
                      >
                        {submitting[`cancelAppt:${appt.id}`] ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            Cancelando…
                          </>
                        ) : (
                          <>
                            <Trash2 className="w-3.5 h-3.5" />
                            Cancelar
                          </>
                        )}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
