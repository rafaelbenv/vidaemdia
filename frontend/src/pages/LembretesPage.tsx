import React from 'react';
import { Bell, RefreshCw, Smartphone } from 'lucide-react';
import { DispatchedMessageLog, Reminder, WorkerStats } from '../types';
import { TechTag } from '../components/TechTag';

export interface LembretesPageProps {
  handleSimulateFailure: () => Promise<void>;
  handleRunWorkerNow: () => Promise<void>;
  submitting: Record<string, boolean>;
  workerStats: WorkerStats | null;
  remindersQueue: Reminder[];
  dispatchedMessages: DispatchedMessageLog[];
  canControlWorker?: boolean;
}

export function LembretesPage({
  handleSimulateFailure,
  handleRunWorkerNow,
  submitting,
  workerStats,
  remindersQueue,
  dispatchedMessages,
  canControlWorker = true,
}: LembretesPageProps) {
  return (
    <div role="tabpanel" id="tabpanel-worker" aria-labelledby="tab-worker">
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Controle do Worker + Fila no PostgreSQL */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-lg border border-stone-200 p-6">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 mb-4 border-b border-stone-100">
              <div>
                <h2 className="text-base font-semibold text-stone-900 flex items-center gap-2">
                  <Bell className="w-5 h-5 text-emerald-600" />
                  Agendador de Notificações
                  <TechTag>Worker Telegram</TechTag>
                </h2>
                <p className="text-xs text-stone-500 mt-0.5">
                  Consulta o PostgreSQL periodicamente, envia lembretes para Telegram e executa Retry de até {workerStats?.maxRetries ?? 3} tentativas.
                </p>
              </div>

              {canControlWorker ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSimulateFailure}
                    className="px-3 py-2 rounded-md border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-semibold transition"
                  >
                    Simular Erro na API (Testar Retry {workerStats?.maxRetries ?? 3}x)
                  </button>

                  <button
                    onClick={handleRunWorkerNow}
                    disabled={submitting['worker']}
                    className="px-4 py-2 rounded-md bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-xs font-semibold shadow flex items-center gap-1.5 transition"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${submitting['worker'] ? 'animate-spin' : ''}`} />
                    {submitting['worker'] ? 'Executando…' : 'Executar Ciclo do Worker Agora'}
                  </button>
                </div>
              ) : (
                <p className="text-xs text-stone-500">Disponível para contas de Profissional.</p>
              )}
            </div>

            {workerStats && (
              <div className="grid grid-cols-3 gap-3 p-3.5 bg-stone-50 rounded-md border border-stone-200 text-xs">
                <div>
                  <span className="text-stone-500 block">Ciclos Executados</span>
                  <span className="font-bold text-stone-900 text-sm tabular-nums">{workerStats.totalCycles}</span>
                </div>
                <div>
                  <span className="text-stone-500 block">Política de Retry</span>
                  <span className="font-bold text-stone-900 text-sm">
                    Máx. {workerStats.maxRetries} tentativas
                  </span>
                </div>
                <div>
                  <span className="text-stone-500 block">Última Verificação</span>
                  <span className="font-bold text-stone-900 text-sm tabular-nums">
                    {workerStats.lastRunAt
                      ? new Date(workerStats.lastRunAt).toLocaleTimeString('pt-BR')
                      : 'Aguardando ciclo'}
                  </span>
                </div>
              </div>
            )}

            <h3 className="text-xs font-bold text-stone-700 uppercase tracking-wider mt-6 mb-3 flex items-center gap-1.5">
              Fila de Lembretes no PostgreSQL (Tabela <TechTag>reminders</TechTag>)
            </h3>
            <p className="text-xs text-stone-500 mb-3">
              Atualiza sozinho a cada 10 segundos.
            </p>

            <div className="space-y-2.5">
              {remindersQueue.length === 0 ? (
                <div className="text-center py-10 px-4 bg-stone-50 rounded-md border border-dashed border-stone-200">
                  <Bell className="w-8 h-8 text-stone-400 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-stone-700">Fila de lembretes vazia</p>
                  <p className="text-xs text-stone-500 mt-1 max-w-md mx-auto">
                    Nenhum lembrete aguardando disparo. Crie um novo compromisso com lembrete na aba Agenda para enfileirar mensagens no PostgreSQL.
                  </p>
                </div>
              ) : (
                remindersQueue.map((rem) => (
                  <div
                    key={rem.id}
                    className="p-3.5 rounded-md border border-stone-200 flex flex-wrap items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="font-bold text-stone-900">
                        {rem.appointment?.title || 'Compromisso'}
                      </div>
                      <div className="text-stone-500 text-xs">
                        Agenda: {rem.appointment?.calendar?.name} · Canal: <b>{rem.channel === 'WHATSAPP' || rem.channel === 'BOTH' ? 'TELEGRAM' : rem.channel}</b> ·
                        Tentativas: <b>{rem.retryCount}/{workerStats?.maxRetries ?? 3}</b>
                      </div>
                      {rem.lastError && (
                        <div className="text-red-600 text-xs mt-1 font-medium">
                          ⚠️ Último erro: {rem.lastError}
                        </div>
                      )}
                    </div>

                    <span
                      className={`px-2.5 py-1 rounded-full text-[11px] font-mono font-bold ${
                        rem.status === 'SENT'
                          ? 'bg-emerald-100 text-emerald-800'
                          : rem.status === 'FAILED'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {rem.status === 'SENT'
                        ? 'ENVIADO NO POSTGRESQL'
                        : rem.status === 'FAILED'
                        ? `FALHOU (MÁX ${workerStats?.maxRetries ?? 3} TENTATIVAS)`
                        : 'PENDENTE NA JANELA'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Simulador de Celular Telegram recebendo os Lembretes */}
        <div className="bg-stone-900 rounded-lg p-5 text-white border border-stone-800 flex flex-col">
          <div className="flex items-center gap-2.5 pb-3 mb-4 border-b border-stone-800">
            <Smartphone className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="text-sm font-semibold">Celular do Usuário (Telegram)</h3>
              <p className="text-xs text-stone-400">
                Notificações entregues pelo Telegram Bot
              </p>
            </div>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto max-h-[460px] pr-1">
            {dispatchedMessages.length === 0 ? (
              <div className="text-center py-12 text-stone-500 text-xs">
                Nenhuma mensagem disparada ainda. Clique em{' '}
                <b className="text-emerald-400">"Executar Ciclo do Worker Agora"</b> ao lado para enviar os lembretes pendentes!
              </div>
            ) : (
              dispatchedMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`p-3.5 rounded-md border text-xs ${
                    msg.success
                      ? 'bg-emerald-950/70 border-emerald-700/60 text-emerald-100'
                      : 'bg-red-950/70 border-red-700/60 text-red-200'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs opacity-75 mb-1.5">
                    <span className="font-bold">
                      ✈️ Telegram → {msg.recipientName} ({msg.recipient})
                    </span>
                    <span className="font-mono text-[11px] tabular-nums">
                      {new Date(msg.timestamp).toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </span>
                  </div>
                  <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed">
                    {msg.message}
                  </pre>
                  {!msg.success && (
                    <div className="mt-2 pt-1.5 border-t border-red-800 text-xs text-red-300 font-semibold">
                      ❌ Falha simulada: {msg.error} (Agendado Retry)
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
