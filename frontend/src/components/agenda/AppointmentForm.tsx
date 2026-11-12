import React from 'react';
import { Plus, AlertTriangle, RefreshCw } from 'lucide-react';
import { NotificationChannel } from '../../types';
import { checkIsPast, todayStr } from '../../lib/format';

export interface AppointmentFormProps {
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
  onClose?: () => void;
}

export function AppointmentForm({
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
  onClose,
}: AppointmentFormProps) {
  return (
    <div className="bg-white rounded-lg border border-stone-200 p-5">
      <div className="pb-3 mb-4 border-b border-stone-100 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-stone-900 flex items-center gap-2">
            <Plus className="w-4 h-4 text-brand-700" />
            Novo Compromisso
          </h3>
          <p className="text-xs text-stone-500 mt-1">
            Preenche Título · Data · Horário · Descrição · Lembrete
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-stone-600 hover:text-stone-900 px-2.5 py-1 rounded border border-stone-300 hover:bg-stone-50 transition"
          >
            Fechar
          </button>
        )}
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
  );
}
