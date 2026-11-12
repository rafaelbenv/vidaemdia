import React from 'react';
import { UserCheck, ShieldCheck, ShieldAlert } from 'lucide-react';
import { ProfessionalDirectoryEntry, User } from '../types';
import { TechTag } from '../components/TechTag';

export interface TesteAcessoPageProps {
  professionals: ProfessionalDirectoryEntry[];
  user: User;
  handleSelectProfessionalCalendar: (calendarId: string, profName: string) => Promise<void>;
}

export function TesteAcessoPage({
  professionals,
  user,
  handleSelectProfessionalCalendar,
}: TesteAcessoPageProps) {
  return (
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
  );
}
