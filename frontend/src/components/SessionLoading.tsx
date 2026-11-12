import React from 'react';
import { Calendar as CalendarIcon, Loader2 } from 'lucide-react';

export function SessionLoading() {
  return (
    <div className="min-h-screen bg-stone-900 flex items-center justify-center p-4" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-4 text-white">
        <div className="p-3 bg-brand-700 rounded-md">
          <CalendarIcon className="w-8 h-8 text-white" />
        </div>
        <div className="flex items-center gap-2 text-sm text-stone-200">
          <Loader2 className="w-4 h-4 animate-spin" />
          Carregando sua agenda…
        </div>
      </div>
    </div>
  );
}
