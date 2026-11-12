import React from 'react';
import { Activity, Database, ShieldAlert, FileText } from 'lucide-react';
import { AuditLogEntry, HealthData } from '../types';
import { TechTag } from '../components/TechTag';

export interface AuditoriaPageProps {
  healthData: HealthData | null;
  auditLogs: AuditLogEntry[];
}

export function AuditoriaPage({ healthData, auditLogs }: AuditoriaPageProps) {
  return (
    <div role="tabpanel" id="tabpanel-auditoria" aria-labelledby="tab-auditoria">
      <div className="space-y-6">
        {/* Cards de Monitoramento / Healthcheck */}
        {healthData && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-lg border border-stone-200">
              <div className="flex items-center justify-between text-xs text-stone-500 mb-1">
                <span>Status Backend & PostgreSQL</span>
                <Activity className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-lg font-bold text-emerald-600">{healthData.status}</div>
              <div className="text-xs font-mono text-[11px] text-stone-400 mt-1">
                DB: {healthData.services?.postgresql} · Worker: {healthData.services?.notificationWorker}
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg border border-stone-200">
              <div className="flex items-center justify-between text-xs text-stone-500 mb-1">
                <span>Compromissos no Banco</span>
                <Database className="w-4 h-4 text-brand-700" />
              </div>
              <div className="text-lg font-bold text-stone-900 tabular-nums">
                {healthData.databaseStats?.appointmentsCount ?? 0}
              </div>
              <div className="text-xs text-stone-400 mt-1">
                Agendas ativas: {healthData.databaseStats?.calendarsCount ?? 0}
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg border border-stone-200">
              <div className="flex items-center justify-between text-xs text-stone-500 mb-1">
                <span>Bloqueios 403 RBAC</span>
                <ShieldAlert className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-lg font-bold text-amber-600 tabular-nums">
                {healthData.metrics?.rbacAccessDenied ?? 0}
              </div>
              <div className="text-xs text-stone-400 mt-1">
                Tentativas não autorizadas barradas
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg border border-stone-200">
              <div className="flex items-center justify-between text-xs text-stone-500 mb-1">
                <span>Logs de Auditoria Gravados</span>
                <FileText className="w-4 h-4 text-brand-700" />
              </div>
              <div className="text-lg font-bold text-stone-900 tabular-nums">
                {healthData.databaseStats?.auditLogsCount ?? auditLogs.length}
              </div>
              <div className="text-xs text-stone-400 mt-1">
                Rastreabilidade completa (Quem / Quando)
              </div>
            </div>
          </div>
        )}

        {/* Tabela de Logs de Auditoria */}
        <div className="bg-white rounded-lg border border-stone-200 p-6">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-stone-100">
            <div>
              <h2 className="text-base font-semibold text-stone-900 flex items-center gap-2">
                Logs de Auditoria
                <TechTag>Auditoria, Segurança & DevOps</TechTag>
                <TechTag>audit_logs</TechTag>
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">
                Registro imutável de criações, alterações, cancelamentos, logins e bloqueios RBAC (403)
              </p>
            </div>
            <a
              href="http://localhost:3000/metrics"
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 rounded-md bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-mono"
            >
              Abrir /metrics (Prometheus) ↗
            </a>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
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
      </div>
    </div>
  );
}
