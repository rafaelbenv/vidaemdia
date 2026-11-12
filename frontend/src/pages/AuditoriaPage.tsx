import React from 'react';
import { FileText } from 'lucide-react';
import { AuditLogEntry } from '../types';
import { TechTag } from '../components/TechTag';

export interface AuditoriaPageProps {
  auditLogs: AuditLogEntry[];
}

export function AuditoriaPage({ auditLogs }: AuditoriaPageProps) {
  return (
    <div className="bg-white rounded-lg border border-stone-200 p-6">
      <div className="pb-4 mb-4 border-b border-stone-100">
        <h2 className="text-base font-semibold text-stone-900 flex items-center gap-2">
          Logs de Auditoria
          <TechTag>Auditoria, Segurança & DevOps</TechTag>
          <TechTag>audit_logs</TechTag>
        </h2>
        <p className="text-xs text-stone-500 mt-0.5">
          Registro imutável de criações, alterações, cancelamentos, logins e bloqueios RBAC (403)
        </p>
      </div>

      {/* Mobile: Lista de cartões (< md) */}
      <div className="md:hidden space-y-3">
        {auditLogs.length === 0 ? (
          <div className="py-8 px-4 text-center">
            <FileText className="w-8 h-8 text-stone-400 mx-auto mb-2" />
            <p className="text-sm font-semibold text-stone-700">Nenhum registro de auditoria encontrado</p>
            <p className="text-xs text-stone-500 mt-1 max-w-md mx-auto">
              Operações como criar ou cancelar compromissos, conceder permissões e bloqueios RBAC (403) serão registradas automaticamente nesta lista.
            </p>
          </div>
        ) : (
          auditLogs.map((log) => (
            <div key={log.id} className="p-3 bg-stone-50 rounded-lg border border-stone-200 space-y-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[11px] text-stone-500 tabular-nums">
                  {new Date(log.createdAt).toLocaleString('pt-BR')}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-md font-bold text-[11px] font-mono ${
                    log.action === 'ACCESS_DENIED'
                      ? 'bg-red-100 text-red-800'
                      : log.action === 'CREATE'
                      ? 'bg-emerald-100 text-emerald-800'
                      : log.action === 'CANCEL'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-brand-50 text-brand-800'
                  }`}
                >
                  {log.action}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-stone-900">
                  {log.actorUser?.name || 'Sistema'}{' '}
                  {log.actorUser?.role && (
                    <span className="text-[11px] px-1.5 py-0.5 bg-stone-100 rounded-md font-mono text-stone-600">
                      {log.actorUser.role}
                    </span>
                  )}
                </span>
                <span className="text-stone-600 truncate">
                  {log.targetCalendar?.name || '—'}
                </span>
              </div>
              {log.details && (
                <div className="text-xs text-stone-700 pt-1.5 border-t border-stone-200">
                  {log.details}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Desktop: Tabela (>= md) */}
      <div className="hidden md:block overflow-x-auto">
        <table className="hidden md:table w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-stone-200 text-stone-500 uppercase text-xs font-medium">
              <th className="py-2.5 px-3">Data / Hora</th>
              <th className="py-2.5 px-3">Ator (Quem)</th>
              <th className="py-2.5 px-3">Ação</th>
              <th className="py-2.5 px-3">Agenda Alvo</th>
              <th className="py-2.5 px-3">Detalhes da Operação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-200">
            {auditLogs.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 px-4 text-center">
                  <FileText className="w-8 h-8 text-stone-400 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-stone-700">Nenhum registro de auditoria encontrado</p>
                  <p className="text-xs text-stone-500 mt-1 max-w-md mx-auto">
                    Operações como criar ou cancelar compromissos, conceder permissões e bloqueios RBAC (403) serão registradas automaticamente nesta tabela.
                  </p>
                </td>
              </tr>
            ) : (
              auditLogs.map((log) => (
                <tr key={log.id} className="hover:bg-stone-50">
                  <td className="py-2.5 px-3 whitespace-nowrap font-mono text-[11px] text-stone-500 tabular-nums">
                    {new Date(log.createdAt).toLocaleString('pt-BR')}
                  </td>
                  <td className="py-2.5 px-3 font-medium text-stone-900">
                    {log.actorUser?.name || 'Sistema'}{' '}
                    {log.actorUser?.role && (
                      <span className="text-[11px] px-1.5 py-0.5 bg-stone-100 rounded-md font-mono">
                        {log.actorUser.role}
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3">
                    <span
                      className={`px-2 py-0.5 rounded-md font-bold text-[11px] font-mono ${
                        log.action === 'ACCESS_DENIED'
                          ? 'bg-red-100 text-red-800'
                          : log.action === 'CREATE'
                          ? 'bg-emerald-100 text-emerald-800'
                          : log.action === 'CANCEL'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-brand-50 text-brand-800'
                      }`}
                    >
                      {log.action}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-stone-600">
                    {log.targetCalendar?.name || '—'}
                  </td>
                  <td className="py-2.5 px-3 text-stone-700">{log.details}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
