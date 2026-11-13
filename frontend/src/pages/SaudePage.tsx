import React from 'react';
import { Activity, Database, ShieldAlert, FileText } from 'lucide-react';
import { HealthData } from '../types';
import { API_BASE_URL } from '../api';

export interface SaudePageProps {
  healthData: HealthData | null;
  auditLogsCount?: number;
}

export function SaudePage({ healthData, auditLogsCount = 0 }: SaudePageProps) {
  return (
    <div className="space-y-6">
      <div className="flex justify-end gap-2">
        <a
          href="/grafana/"
          target="_blank"
          rel="noreferrer"
          className="px-3 py-1.5 rounded-md bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-mono"
        >
          Abrir Grafana ↗
        </a>
        <a
          href={`${API_BASE_URL}/metrics`}
          target="_blank"
          rel="noreferrer"
          className="px-3 py-1.5 rounded-md bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-mono"
        >
          Abrir /metrics (Prometheus) ↗
        </a>
      </div>

      {healthData && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg border border-stone-200">
            <div className="flex items-center justify-between text-xs text-stone-500 mb-1">
              <span>Status Backend & PostgreSQL</span>
              <Activity className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-lg font-bold text-emerald-600">{healthData.status}</div>
            <div className="text-xs font-mono text-[11px] text-stone-500 mt-1">
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
            <div className="text-xs text-stone-500 mt-1">
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
            <div className="text-xs text-stone-500 mt-1">
              Tentativas não autorizadas barradas
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg border border-stone-200">
            <div className="flex items-center justify-between text-xs text-stone-500 mb-1">
              <span>Logs de Auditoria Gravados</span>
              <FileText className="w-4 h-4 text-brand-700" />
            </div>
            <div className="text-lg font-bold text-stone-900 tabular-nums">
              {healthData.databaseStats?.auditLogsCount ?? auditLogsCount}
            </div>
            <div className="text-xs text-stone-500 mt-1">
              Rastreabilidade completa (Quem / Quando)
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
