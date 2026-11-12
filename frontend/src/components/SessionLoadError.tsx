import React from 'react';
import { CloudOff, Loader2 } from 'lucide-react';

export interface SessionLoadErrorProps {
  message: string;
  retrying: boolean;
  onRetry: () => void;
  onLogout: () => void;
}

export function SessionLoadError({
  message,
  retrying,
  onRetry,
  onLogout,
}: SessionLoadErrorProps) {
  return (
    <div className="min-h-screen bg-stone-900 flex items-center justify-center p-4">
      <div
        role="alert"
        className="bg-white rounded-lg border border-stone-200 p-6 max-w-sm w-full text-center"
      >
        <CloudOff className="w-8 h-8 text-stone-400 mx-auto mb-3" />
        <h1 className="text-lg font-semibold text-stone-900">
          Não foi possível carregar sua agenda
        </h1>
        <p className="text-sm text-stone-600 mt-1">{message}</p>
        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={onRetry}
            disabled={retrying}
            className="w-full bg-brand-700 hover:bg-brand-800 text-white text-sm font-medium py-2.5 rounded-md disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {retrying ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Tentando…</span>
              </>
            ) : (
              'Tentar de novo'
            )}
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="w-full text-sm text-stone-600 hover:text-stone-900 py-2"
          >
            Sair
          </button>
        </div>
      </div>
    </div>
  );
}
