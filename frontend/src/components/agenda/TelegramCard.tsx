import React from 'react';
import { Loader2, Send } from 'lucide-react';

export interface TelegramCardProps {
  waiting: boolean;
  connecting: boolean;
  onConnect: () => void;
  onDismiss: () => void;
}

export function TelegramCard({
  waiting,
  connecting,
  onConnect,
  onDismiss,
}: TelegramCardProps) {
  return (
    <div
      role="region"
      aria-label="Conectar o Telegram"
      className="bg-white rounded-lg border border-brand-600/40 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between"
    >
      {/* Esquerda */}
      <div className="flex items-start sm:items-center gap-3">
        <Send className="w-5 h-5 text-brand-700 shrink-0 mt-0.5 sm:mt-0" aria-hidden="true" />
        <div>
          <h2 className="text-sm font-semibold text-stone-900">
            Receba seus lembretes no Telegram
          </h2>
          <p className="text-sm text-stone-600 mt-0.5">
            {waiting ? (
              <>
                Abra o Telegram e toque em Iniciar. Esta tela atualiza sozinha.{' '}
                <Loader2 className="w-4 h-4 animate-spin text-brand-700 inline-block align-middle ml-1" aria-hidden="true" />
              </>
            ) : (
              'Sem conectar, os compromissos ficam salvos mas nenhum lembrete é enviado.'
            )}
          </p>
        </div>
      </div>

      {/* Direita */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={onConnect}
          disabled={connecting || waiting}
          className="bg-brand-700 hover:bg-brand-800 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md px-3.5 py-2 text-sm font-medium transition"
        >
          {connecting ? 'Conectando…' : 'Conectar Telegram'}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="text-sm text-stone-500 hover:text-stone-800 transition min-h-11 min-w-11 sm:min-h-0 sm:min-w-0 inline-flex items-center justify-center"
        >
          Agora não
        </button>
      </div>
    </div>
  );
}
