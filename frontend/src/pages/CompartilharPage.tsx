import React from 'react';
import { ArrowLeft, RefreshCw, ShieldCheck } from 'lucide-react';
import { Calendar } from '../types';
import { TechTag } from '../components/TechTag';

export interface CompartilharPageProps {
  onBack: () => void;
  selectedCalendarId: string;
  setSelectedCalendarId: (id: string) => void;
  ownedCalendars: Calendar[];
  secretaryEmailToGrant: string;
  setSecretaryEmailToGrant: (val: string) => void;
  handleGrantSecretaryPermission: (e: React.FormEvent) => Promise<void>;
  submitting: Record<string, boolean>;
}

export function CompartilharPage({
  onBack,
  selectedCalendarId,
  setSelectedCalendarId,
  ownedCalendars,
  secretaryEmailToGrant,
  setSecretaryEmailToGrant,
  handleGrantSecretaryPermission,
  submitting,
}: CompartilharPageProps) {
  return (
    <div className="max-w-3xl mx-auto">
      <button
        type="button"
        onClick={onBack}
        className="text-sm text-stone-600 hover:text-stone-900 mb-4 inline-flex items-center gap-1"
      >
        <ArrowLeft className="w-4 h-4" />
        Voltar para a agenda
      </button>

      <div className="bg-white rounded-lg border border-stone-200 p-6">
        <div className="pb-4 mb-5 border-b border-stone-100">
          <h2 className="text-base font-semibold text-stone-900 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-brand-700" />
            Delegação de Acessos
            <TechTag>Fluxo RBAC</TechTag>
          </h2>
          <p className="text-xs text-stone-500 mt-1">
            Como Profissional (ex.: Dr. João), autorize ou revogue o acesso de uma Secretária à sua agenda selecionada.
          </p>
        </div>

        <form onSubmit={handleGrantSecretaryPermission} className="space-y-4 mb-6">
          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">
              Agenda Selecionada
            </label>
            <select
              value={selectedCalendarId}
              onChange={(e) => setSelectedCalendarId(e.target.value)}
              className="w-full px-3 py-2 text-base border border-stone-300 rounded-md bg-white focus:ring-2 focus:ring-brand-700 focus:outline-none"
            >
              {ownedCalendars.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.type})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">
              E-mail da Secretária
            </label>
            <input
              type="email"
              required
              value={secretaryEmailToGrant}
              onChange={(e) => setSecretaryEmailToGrant(e.target.value)}
              className="w-full px-3 py-2 text-base border border-stone-300 rounded-md focus:ring-2 focus:ring-brand-700 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={ownedCalendars.length === 0 || submitting['grant']}
            className="w-full py-2.5 px-4 bg-brand-700 hover:bg-brand-800 disabled:bg-stone-300 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium text-sm rounded-md transition flex items-center justify-center gap-2"
          >
            {submitting['grant'] ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Concedendo…
              </>
            ) : (
              'Conceder Permissão RBAC (Visualizar, Criar, Alterar, Cancelar)'
            )}
          </button>
        </form>

        <div className="border-t border-stone-100 pt-4">
          <h3 className="text-xs font-bold text-stone-700 uppercase tracking-wider mb-3">
            Secretárias Autorizadas nas Suas Agendas
          </h3>
          {ownedCalendars.flatMap((c) =>
            (c.permissions || []).map((p) => ({ calendar: c, perm: p })),
          ).length === 0 ? (
            <p className="text-xs text-stone-400">
              Nenhuma secretária delegada nas suas agendas próprias.
            </p>
          ) : (
            <div className="space-y-2">
              {ownedCalendars.map((cal) =>
                (cal.permissions || []).map((perm) => (
                  <div
                    key={perm.id}
                    className="p-3 rounded-md bg-stone-50 border border-stone-200 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-bold text-stone-900">
                        {perm.granteeUser?.name} ({perm.granteeUser?.email})
                      </div>
                      <div className="text-xs text-stone-500">
                        Agenda: <span className="font-semibold">{cal.name}</span> · Permissões:
                        VIEW, CREATE, UPDATE, CANCEL
                      </div>
                    </div>
                  </div>
                )),
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
