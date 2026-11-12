import React, { useEffect, useRef } from 'react';
import { RefreshCw } from 'lucide-react';

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  confirmLoadingLabel?: string;
  cancelLabel?: string;
  confirmVariant?: 'danger' | 'primary';
  isLoading?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export interface ConfirmModalProps {
  title: string;
  message: React.ReactNode;
  confirmLabel: string;
  confirmLoadingLabel?: string;
  cancelLabel: string;
  confirmVariant?: 'danger' | 'primary';
  loadingKey?: string;
  onConfirm: () => void | Promise<void>;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirmar',
  confirmLoadingLabel,
  cancelLabel = 'Cancelar',
  confirmVariant = 'danger',
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const safeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => {
      safeButtonRef.current?.focus();
    }, 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) {
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, isLoading, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={() => {
        if (!isLoading) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 border border-stone-200 text-stone-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="confirm-dialog-title" className="text-base font-bold text-stone-900 mb-2">
          {title}
        </h3>
        <div className="text-sm text-stone-600 mb-6 leading-relaxed">
          {message}
        </div>
        <div className="flex items-center justify-end gap-3">
          <button
            ref={safeButtonRef}
            type="button"
            disabled={isLoading}
            onClick={onCancel}
            className="px-4 py-2 rounded-md border border-stone-300 hover:bg-stone-100 text-stone-700 text-xs font-semibold disabled:opacity-60 disabled:cursor-not-allowed transition"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={isLoading}
            onClick={onConfirm}
            className={`px-4 py-2 rounded-md text-xs font-semibold flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed transition ${
              confirmVariant === 'danger'
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-brand-700 hover:bg-brand-800 text-white'
            }`}
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                {confirmLoadingLabel || 'Processando…'}
              </>
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
