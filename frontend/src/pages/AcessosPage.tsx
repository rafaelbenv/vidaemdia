import React from 'react';
import { UserCheck, ShieldCheck, ShieldAlert, RefreshCw } from 'lucide-react';
import { Calendar, ProfessionalDirectoryEntry, User } from '../types';
import { TechTag } from '../components/TechTag';

export interface AcessosPageProps {
  isSinglePanel: boolean;
  showSecretaryPanel: boolean;
  showProfessionalPanel: boolean;
  professionals: ProfessionalDirectoryEntry[];
  user: User;
  handleSelectProfessionalCalendar: (calendarId: string, profName: string) => Promise<void>;
  handleGrantSecretaryPermission: (e: React.FormEvent) => Promise<void>;
  selectedCalendarId: string;
  setSelectedCalendarId: (id: string) => void;
  ownedCalendars: Calendar[];
  secretaryEmailToGrant: string;
  setSecretaryEmailToGrant: (val: string) => void;
  submitting: Record<string, boolean>;
}

export function AcessosPage({
  isSinglePanel,
  showSecretaryPanel,
  showProfessionalPanel,
  professionals,
  user,
  handleSelectProfessionalCalendar,
  handleGrantSecretaryPermission,
  selectedCalendarId,
  setSelectedCalendarId,
  ownedCalendars,
  secretaryEmailToGrant,
  setSecretaryEmailToGrant,
  submitting,
}: AcessosPageProps) {
  return (
    <div role="tabpanel" id="tabpanel-rbac" aria-labelledby="tab-rbac">
      <div className={isSinglePanel ? 'max-w-3xl mx-auto space-y-6' : 'grid lg:grid-cols-2 gap-6'}>
        {/* Painel da Secretária: Selecionar Profissional ("Agendas que gerencio") */}
        {showSecretaryPanel && (
          <div className="bg-white rounded-lg border border-stone-200 p-6">
            <div className="flex items-center gap-2.5 pb-4 mb-4 border-b border-stone-100">
              <div className="p-2 bg-amber-100 text-amber-800 rounded-md">
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-stone-900 flex items-center gap-2">
                  Agendas que gerencio
                  <TechTag>Fluxo RBAC</TechTag>
                </h2>
                <p className="text-xs text-stone-500">
                  Selecione o profissional cuja agenda deseja gerenciar (testa autorização 200 OK vs. 403 Acesso Negado)
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-4">
              {professionals.map((prof) => (
                <div
                  key={prof.id}
                  className="p-4 rounded-md border border-stone-200 bg-stone-50/50 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-stone-900">{prof.name}</h3>
                      <p className="text-xs text-stone-500">{prof.email}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {prof.calendars.map((cal) => (
                      <div
                        key={cal.id}
                        className="p-3 bg-white rounded-md border border-stone-200 flex flex-wrap items-center justify-between gap-3"
                      >
                        <div>
                          <div className="text-xs font-bold text-stone-800">{cal.name}</div>
                          <div className="text-xs text-stone-500">{cal.description}</div>
                          <div className="mt-1">
                            {cal.hasRbacAuthorization || prof.id === user.id ? (
                              <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-semibold">
                                <ShieldCheck className="w-3.5 h-3.5" />
                                Possui autorização RBAC ativa
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs text-red-600 font-semibold">
                                <ShieldAlert className="w-3.5 h-3.5" />
                                Sem delegação RBAC (Retornará 403 Forbidden)
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          onClick={() => handleSelectProfessionalCalendar(cal.id, prof.name)}
                          className={`px-3.5 py-2 rounded-md text-xs font-semibold transition ${
                            cal.hasRbacAuthorization || prof.id === user.id
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                              : 'bg-white hover:bg-red-50 text-red-600 border border-red-500'
                          }`}
                        >
                          {cal.hasRbacAuthorization || prof.id === user.id
                            ? 'Acessar Agenda (Autorizado)'
                            : 'Tentar Acesso (Testar 403)'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Painel do Profissional: Delegar Acesso RBAC a uma Secretária */}
        {showProfessionalPanel && (
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
        )}
      </div>
    </div>
  );
}
