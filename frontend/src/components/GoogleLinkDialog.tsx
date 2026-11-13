import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, RefreshCw, X } from 'lucide-react';
import { Calendar, GoogleCalendarOption, GoogleStatus } from '../types';
import { getGoogleCalendars, linkCalendarToGoogle, unlinkCalendarFromGoogle } from '../api';
import { useFocusTrap } from '../hooks/useFocusTrap';

export interface GoogleLinkDialogProps {
  calendar: Calendar;
  googleStatus: GoogleStatus;
  token: string;
  onClose: () => void;
  onChanged: (toastMessage?: string) => void | Promise<void>;
  onConnect: () => void | Promise<void>;
  onToast?: (toast: { type: 'success' | 'error'; title: string; detail?: string }) => void;
}

export function GoogleLinkDialog({
  calendar,
  googleStatus,
  token,
  onClose,
  onChanged,
  onConnect,
  onToast,
}: GoogleLinkDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, true);

  const [loadingCalendars, setLoadingCalendars] = useState(false);
  const [googleCalendars, setGoogleCalendars] = useState<GoogleCalendarOption[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedGoogleCalId, setSelectedGoogleCalId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const isLinked = Boolean(calendar.googleCalendarId);
  const isConnected = Boolean(googleStatus.connected);

  // Fecha no Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [submitting, onClose]);

  // Carrega agendas do Google se estiver conectado e a agenda não estiver ligada
  useEffect(() => {
    if (isConnected && !isLinked) {
      let isMounted = true;
      setLoadingCalendars(true);
      setLoadError(null);

      getGoogleCalendars(token)
        .then((items) => {
          if (!isMounted) return;
          const sorted = [...items].sort((a, b) => {
            if (a.primary && !b.primary) return -1;
            if (!a.primary && b.primary) return 1;
            return a.summary.localeCompare(b.summary);
          });
          setGoogleCalendars(sorted);
          if (sorted.length > 0) {
            setSelectedGoogleCalId(sorted[0].id);
          }
        })
        .catch((err: unknown) => {
          if (!isMounted) return;
          const msg = err instanceof Error ? err.message : 'Erro ao carregar agendas do Google';
          setLoadError(msg);
        })
        .finally(() => {
          if (isMounted) setLoadingCalendars(false);
        });

      return () => {
        isMounted = false;
      };
    }
  }, [isConnected, isLinked, token]);

  const handleLink = async () => {
    if (!selectedGoogleCalId || submitting) return;
    setSubmitting(true);
    setActionError(null);
    try {
      await linkCalendarToGoogle(token, calendar.id, selectedGoogleCalId);
      const msg = 'Agenda ligada ao Google Agenda.';
      onToast?.({ type: 'success', title: msg });
      await onChanged(msg);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Não foi possível ligar a agenda ao Google.';
      setActionError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnlink = async () => {
    if (submitting) return;
    setSubmitting(true);
    setActionError(null);
    try {
      await unlinkCalendarFromGoogle(token, calendar.id);
      const msg = 'Sincronização com o Google desligada.';
      onToast?.({ type: 'success', title: msg });
      await onChanged(msg);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Não foi possível desligar a sincronização.';
      setActionError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      onClick={() => {
        if (!submitting) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="google-link-dialog-title"
        className="bg-white rounded-lg shadow-xl max-w-md w-full p-5 sm:p-6 border border-stone-200 text-stone-900 relative my-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 mb-4">
          <h2 id="google-link-dialog-title" className="text-base font-bold text-stone-900">
            Sincronizar com o Google Agenda
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Fechar"
            className="text-stone-400 hover:text-stone-600 p-1 rounded-md hover:bg-stone-100 transition min-h-11 min-w-11 sm:min-h-0 sm:min-w-0 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Não conectado */}
        {!isConnected ? (
          <div className="space-y-4">
            <p className="text-sm text-stone-600 leading-relaxed">
              Conecte sua conta Google para enviar os compromissos desta agenda para o Google Agenda.
            </p>
            <div>
              <button
                type="button"
                onClick={() => {
                  onConnect();
                }}
                disabled={submitting}
                className="w-full sm:w-auto px-4 py-2.5 rounded-md bg-brand-700 hover:bg-brand-800 text-white text-sm font-semibold transition disabled:opacity-60 flex items-center justify-center gap-2 min-h-11"
              >
                Conectar Google Agenda
              </button>
            </div>
          </div>
        ) : isLinked ? (
          /* Conectado e agenda ligada */
          <div className="space-y-4">
            <p className="text-sm text-stone-600 leading-relaxed">
              Esta agenda envia os compromissos para{' '}
              <strong className="font-semibold text-stone-900">
                {calendar.googleCalendarName || 'Google Agenda'}
              </strong>{' '}
              no Google Agenda.
            </p>

            {actionError && (
              <div
                role="alert"
                className="p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-700 flex items-start gap-2"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{actionError}</span>
              </div>
            )}

            <div>
              <button
                type="button"
                onClick={handleUnlink}
                disabled={submitting}
                className="w-full sm:w-auto px-4 py-2 rounded-md bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm font-semibold transition disabled:opacity-60 flex items-center justify-center gap-2 min-h-11"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Desligando…</span>
                  </>
                ) : (
                  'Parar de sincronizar'
                )}
              </button>
            </div>
          </div>
        ) : (
          /* Conectado e agenda não ligada */
          <div className="space-y-4">
            {loadingCalendars ? (
              <div className="py-6 flex flex-col items-center justify-center gap-2 text-stone-500 text-sm">
                <RefreshCw className="w-5 h-5 animate-spin text-brand-600" />
                <span>Carregando suas agendas do Google…</span>
              </div>
            ) : loadError ? (
              <div
                role="alert"
                className="p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-700 flex items-start gap-2"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{loadError}</span>
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <label
                    htmlFor="google-calendar-select"
                    className="block text-xs font-semibold text-stone-700"
                  >
                    Enviar para
                  </label>
                  <select
                    id="google-calendar-select"
                    value={selectedGoogleCalId}
                    onChange={(e) => setSelectedGoogleCalId(e.target.value)}
                    disabled={submitting || googleCalendars.length === 0}
                    className="w-full px-3 py-2 text-sm bg-white border border-stone-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 min-h-11"
                  >
                    {googleCalendars.map((cal) => (
                      <option key={cal.id} value={cal.id}>
                        {cal.summary}
                        {cal.primary ? ' (principal)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <p className="text-xs text-stone-600 leading-relaxed">
                  Os compromissos desta agenda (a partir de ontem) e os próximos que forem criados,
                  alterados ou cancelados aqui vão aparecer nessa agenda do Google. Quem tem acesso a esta
                  agenda no VidaEmDia também vê o que for enviado.
                </p>

                {actionError && (
                  <div
                    role="alert"
                    className="p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-700 flex items-start gap-2"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{actionError}</span>
                  </div>
                )}

                <div>
                  <button
                    type="button"
                    onClick={handleLink}
                    disabled={submitting || !selectedGoogleCalId || googleCalendars.length === 0}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-md bg-brand-700 hover:bg-brand-800 text-white text-sm font-semibold transition disabled:opacity-60 flex items-center justify-center gap-2 min-h-11"
                  >
                    {submitting ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Ligando…</span>
                      </>
                    ) : (
                      'Ligar'
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Rodapé com "Fechar" */}
        <div className="mt-6 pt-4 border-t border-stone-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="w-full sm:w-auto px-4 py-2 rounded-md border border-stone-300 hover:bg-stone-50 text-stone-700 text-xs sm:text-sm font-semibold transition disabled:opacity-60 min-h-11 flex items-center justify-center"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
