import React, { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle, X } from 'lucide-react';

export interface ToastData {
  type: 'success' | 'error';
  title: string;
  detail?: string;
}

export interface ToastProps {
  toast: ToastData | null;
  onClose: () => void;
}

export function Toast({ toast, onClose }: ToastProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (toast) {
      const frame = requestAnimationFrame(() => setVisible(true));
      return () => {
        cancelAnimationFrame(frame);
        setVisible(false);
      };
    } else {
      setVisible(false);
    }
  }, [toast]);

  useEffect(() => {
    if (toast?.type === 'success') {
      const timer = window.setTimeout(() => {
        onClose();
      }, 4000);
      return () => window.clearTimeout(timer);
    }
  }, [toast, onClose]);

  if (!toast) {
    return null;
  }

  const isSuccess = toast.type === 'success';

  return (
    <div
      role={isSuccess ? 'status' : 'alert'}
      aria-live={isSuccess ? 'polite' : 'assertive'}
      className={`fixed z-50 bottom-24 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 sm:w-96 rounded-lg shadow-lg border px-4 py-3 flex gap-3 items-start bg-white transition-all duration-200 motion-reduce:transition-none ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
      } ${isSuccess ? 'border-emerald-200' : 'border-red-200'}`}
    >
      {isSuccess ? (
        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
      ) : (
        <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
      )}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-stone-900">{toast.title}</div>
        {toast.detail && (
          <div className="text-xs text-stone-600 mt-0.5">{toast.detail}</div>
        )}
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Fechar aviso"
        className="text-stone-400 hover:text-stone-600 transition-colors p-1 -mr-1 -mt-0.5 rounded focus:outline-none focus:ring-2 focus:ring-stone-400 shrink-0 min-h-11 min-w-11 sm:min-h-0 sm:min-w-0 flex items-center justify-center"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
