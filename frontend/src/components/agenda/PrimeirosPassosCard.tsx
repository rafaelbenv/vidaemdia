import React from 'react';
import { CheckCircle2, Circle, Loader2 } from 'lucide-react';

export interface PrimeirosPassosCardProps {
  telegramDone: boolean;
  telegramWaiting: boolean;
  telegramConnecting: boolean;
  onConnectTelegram: () => void;
  appointmentDone: boolean;
  onNewAppointment: () => void;
  showGoogle: boolean;
  googleDone: boolean;
  onConnectGoogle: () => void;
  onDismiss: () => void;
}

export function PrimeirosPassosCard({
  telegramDone,
  telegramWaiting,
  telegramConnecting,
  onConnectTelegram,
  appointmentDone,
  onNewAppointment,
  showGoogle,
  googleDone,
  onConnectGoogle,
  onDismiss,
}: PrimeirosPassosCardProps) {
  return (
    <div
      role="region"
      aria-label="Primeiros passos"
      className="bg-white rounded-lg border border-brand-600/40 p-4 sm:p-5"
    >
      <div>
        <h2 className="text-sm font-semibold text-stone-900">
          Primeiros passos
        </h2>
        <p className="text-sm text-stone-600 mt-0.5">
          {showGoogle
            ? 'Três passos para começar a usar a sua agenda.'
            : 'Dois passos para começar a usar a sua agenda.'}
        </p>
      </div>

      <ol className="mt-4 divide-y divide-stone-100">
        {/* 1. Conectar o Telegram */}
        <li className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 first:pt-0">
          <div className="flex items-start gap-3">
            {telegramDone ? (
              <>
                <CheckCircle2
                  className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <span className="sr-only">(feito)</span>
              </>
            ) : (
              <Circle
                className="w-5 h-5 text-stone-400 shrink-0 mt-0.5"
                aria-hidden="true"
              />
            )}
            <div className={telegramDone ? 'line-through text-stone-500' : ''}>
              <div
                className={`text-sm font-medium ${
                  telegramDone ? 'text-stone-500' : 'text-stone-900'
                }`}
              >
                Conectar o Telegram
              </div>
              <div
                className={`text-sm ${
                  telegramDone ? 'text-stone-500' : 'text-stone-600'
                } mt-0.5`}
              >
                Os lembretes chegam por lá.
              </div>
            </div>
          </div>
          {!telegramDone && (
            <div className="shrink-0 sm:self-center">
              {telegramWaiting ? (
                <span className="text-xs sm:text-sm text-stone-600 inline-flex items-center gap-1.5">
                  Abra o Telegram e toque em Iniciar. Esta tela atualiza sozinha.{' '}
                  <Loader2
                    className="w-4 h-4 animate-spin text-brand-700 shrink-0"
                    aria-hidden="true"
                  />
                </span>
              ) : (
                <button
                  type="button"
                  onClick={onConnectTelegram}
                  disabled={telegramConnecting}
                  className="bg-brand-700 hover:bg-brand-800 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md px-3.5 py-2 text-sm font-medium transition"
                >
                  {telegramConnecting ? 'Conectando…' : 'Conectar Telegram'}
                </button>
              )}
            </div>
          )}
        </li>

        {/* 2. Criar o primeiro compromisso */}
        <li className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            {appointmentDone ? (
              <>
                <CheckCircle2
                  className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <span className="sr-only">(feito)</span>
              </>
            ) : (
              <Circle
                className="w-5 h-5 text-stone-400 shrink-0 mt-0.5"
                aria-hidden="true"
              />
            )}
            <div
              className={appointmentDone ? 'line-through text-stone-500' : ''}
            >
              <div
                className={`text-sm font-medium ${
                  appointmentDone ? 'text-stone-500' : 'text-stone-900'
                }`}
              >
                Criar o primeiro compromisso
              </div>
              <div
                className={`text-sm ${
                  appointmentDone ? 'text-stone-500' : 'text-stone-600'
                } mt-0.5`}
              >
                Toque em &quot;Novo compromisso&quot; e escolha dia e hora.
              </div>
            </div>
          </div>
          {!appointmentDone && (
            <div className="shrink-0 sm:self-center">
              <button
                type="button"
                onClick={onNewAppointment}
                className="bg-brand-700 hover:bg-brand-800 text-white rounded-md px-3.5 py-2 text-sm font-medium transition"
              >
                Novo compromisso
              </button>
            </div>
          )}
        </li>

        {/* 3. Conectar o Google Agenda (opcional) */}
        {showGoogle && (
          <li className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              {googleDone ? (
                <>
                  <CheckCircle2
                    className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <span className="sr-only">(feito)</span>
                </>
              ) : (
                <Circle
                  className="w-5 h-5 text-stone-400 shrink-0 mt-0.5"
                  aria-hidden="true"
                />
              )}
              <div
                className={googleDone ? 'line-through text-stone-500' : ''}
              >
                <div
                  className={`text-sm font-medium ${
                    googleDone ? 'text-stone-500' : 'text-stone-900'
                  }`}
                >
                  Conectar o Google Agenda (opcional)
                </div>
                <div
                  className={`text-sm ${
                    googleDone ? 'text-stone-500' : 'text-stone-600'
                  } mt-0.5`}
                >
                  Seus compromissos aparecem nos dois lugares.
                </div>
              </div>
            </div>
            {!googleDone && (
              <div className="shrink-0 sm:self-center">
                <button
                  type="button"
                  onClick={onConnectGoogle}
                  className="bg-brand-700 hover:bg-brand-800 text-white rounded-md px-3.5 py-2 text-sm font-medium transition"
                >
                  Conectar Google
                </button>
              </div>
            )}
          </li>
        )}
      </ol>

      {/* Rodapé: Dispensar */}
      <div className="mt-4 pt-3 border-t border-stone-100 flex justify-end">
        <button
          type="button"
          onClick={onDismiss}
          className="text-sm text-stone-500 hover:text-stone-800 transition min-h-11 min-w-11 sm:min-h-0 sm:min-w-0 inline-flex items-center justify-center"
        >
          Dispensar
        </button>
      </div>
    </div>
  );
}
