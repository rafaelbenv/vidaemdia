import React, { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Calendar, CalendarPermission, User } from '../types';

export interface CompartilharPageProps {
  calendar: Calendar;
  me: User;
  onGrant: (
    email: string,
    caps: { canView: boolean; canCreate: boolean; canUpdate: boolean; canCancel: boolean },
  ) => Promise<string | null>;
  onRevoke: (perm: CalendarPermission) => void;
  onBack: () => void;
}

function formatCapabilities(perm: {
  canView: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canCancel: boolean;
}): string {
  const parts: string[] = [];
  if (perm.canView) parts.push('ver');
  if (perm.canCreate) parts.push('criar');
  if (perm.canUpdate) parts.push('alterar');
  if (perm.canCancel) parts.push('cancelar');
  return parts.length > 0 ? `Pode: ${parts.join(', ')}` : 'Sem permissões';
}

export function CompartilharPage({
  calendar,
  me,
  onGrant,
  onRevoke,
  onBack,
}: CompartilharPageProps) {
  // Estado do formulário "Dar acesso a alguém"
  const [email, setEmail] = useState('');
  const [caps, setCaps] = useState({
    canView: true,
    canCreate: true,
    canUpdate: true,
    canCancel: true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Estado da edição na própria linha em "Quem tem acesso"
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCaps, setEditCaps] = useState({
    canView: true,
    canCreate: true,
    canUpdate: true,
    canCancel: true,
  });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // O aviso de sucesso desaparece após 4 segundos
  useEffect(() => {
    if (!successMsg) return;
    const timer = window.setTimeout(() => {
      setSuccessMsg(null);
    }, 4000);
    return () => window.clearTimeout(timer);
  }, [successMsg]);

  function handleToggleView(checked: boolean) {
    if (!checked) {
      setCaps({
        canView: false,
        canCreate: false,
        canUpdate: false,
        canCancel: false,
      });
    } else {
      setCaps((prev) => ({
        ...prev,
        canView: true,
      }));
    }
  }

  function handleToggleEditView(checked: boolean) {
    if (!checked) {
      setEditCaps({
        canView: false,
        canCreate: false,
        canUpdate: false,
        canCancel: false,
      });
    } else {
      setEditCaps((prev) => ({
        ...prev,
        canView: true,
      }));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const trimmed = email.trim();
    if (!trimmed) {
      setFormError('Informe o e-mail da pessoa.');
      return;
    }

    if (trimmed.toLowerCase() === me.email.trim().toLowerCase()) {
      setFormError('Você já é dono desta agenda.');
      return;
    }

    const existing = (calendar.permissions || []).find(
      (p) => p.granteeUser?.email?.trim().toLowerCase() === trimmed.toLowerCase(),
    );
    if (existing) {
      const nome = existing.granteeUser?.name || existing.granteeUser?.email || trimmed;
      setFormError(`${nome} já tem acesso. Use "Alterar" na lista acima.`);
      return;
    }

    setSubmitting(true);
    try {
      const err = await onGrant(trimmed, caps);
      if (err) {
        setFormError(err);
      } else {
        const grantedEmail = trimmed;
        setEmail('');
        setCaps({ canView: true, canCreate: true, canUpdate: true, canCancel: true });
        setSuccessMsg(`Acesso dado a ${grantedEmail}.`);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveEdit(granteeEmail: string) {
    if (!granteeEmail) return;
    setEditSaving(true);
    setEditError(null);
    try {
      const err = await onGrant(granteeEmail, editCaps);
      if (err) {
        setEditError(err);
      } else {
        setEditingId(null);
      }
    } finally {
      setEditSaving(false);
    }
  }

  const permissions = calendar.permissions || [];

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Topo */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="text-sm font-medium text-stone-600 hover:text-stone-900 inline-flex items-center gap-1 min-h-[44px] py-2 pr-2"
        >
          <span aria-hidden="true" className="text-base font-semibold leading-none">
            ‹
          </span>
          Agenda
        </button>
        <h1 className="text-lg font-semibold text-stone-900 truncate">
          Compartilhar &quot;{calendar.name}&quot;
        </h1>
      </div>

      {/* Card Quem tem acesso */}
      <section className="bg-white rounded-lg border border-stone-200 p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-stone-900 mb-3">Quem tem acesso</h2>

        {permissions.length === 0 ? (
          <p className="text-sm text-stone-600">Só você tem acesso a esta agenda.</p>
        ) : (
          <div>
            {permissions.map((perm, index) => {
              const permKey = perm.id || perm.granteeUser?.id || String(index);
              const isEditing = editingId === permKey;
              const granteeName = perm.granteeUser?.name || 'Usuário';
              const granteeEmail = perm.granteeUser?.email || '';

              if (isEditing) {
                return (
                  <div
                    key={permKey}
                    className="py-3 border-b border-stone-100 last:border-0 space-y-3"
                  >
                    <div className="text-sm">
                      <span className="font-medium text-stone-900">{granteeName}</span>
                      {' · '}
                      <span className="text-stone-500 truncate">{granteeEmail}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                      <label
                        htmlFor={`edit-chk-view-${permKey}`}
                        className="min-h-[44px] inline-flex items-center gap-2 text-sm text-stone-800 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          id={`edit-chk-view-${permKey}`}
                          checked={editCaps.canView}
                          onChange={(e) => handleToggleEditView(e.target.checked)}
                          className="w-4 h-4 rounded border-stone-300 text-brand-700 focus:ring-brand-700"
                        />
                        <span>ver</span>
                      </label>
                      <label
                        htmlFor={`edit-chk-create-${permKey}`}
                        className={`min-h-[44px] inline-flex items-center gap-2 text-sm text-stone-800 ${
                          !editCaps.canView ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                        }`}
                      >
                        <input
                          type="checkbox"
                          id={`edit-chk-create-${permKey}`}
                          disabled={!editCaps.canView}
                          checked={editCaps.canView ? editCaps.canCreate : false}
                          onChange={(e) =>
                            setEditCaps((prev) => ({ ...prev, canCreate: e.target.checked }))
                          }
                          className="w-4 h-4 rounded border-stone-300 text-brand-700 focus:ring-brand-700 disabled:cursor-not-allowed"
                        />
                        <span>criar</span>
                      </label>
                      <label
                        htmlFor={`edit-chk-update-${permKey}`}
                        className={`min-h-[44px] inline-flex items-center gap-2 text-sm text-stone-800 ${
                          !editCaps.canView ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                        }`}
                      >
                        <input
                          type="checkbox"
                          id={`edit-chk-update-${permKey}`}
                          disabled={!editCaps.canView}
                          checked={editCaps.canView ? editCaps.canUpdate : false}
                          onChange={(e) =>
                            setEditCaps((prev) => ({ ...prev, canUpdate: e.target.checked }))
                          }
                          className="w-4 h-4 rounded border-stone-300 text-brand-700 focus:ring-brand-700 disabled:cursor-not-allowed"
                        />
                        <span>alterar</span>
                      </label>
                      <label
                        htmlFor={`edit-chk-cancel-${permKey}`}
                        className={`min-h-[44px] inline-flex items-center gap-2 text-sm text-stone-800 ${
                          !editCaps.canView ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                        }`}
                      >
                        <input
                          type="checkbox"
                          id={`edit-chk-cancel-${permKey}`}
                          disabled={!editCaps.canView}
                          checked={editCaps.canView ? editCaps.canCancel : false}
                          onChange={(e) =>
                            setEditCaps((prev) => ({ ...prev, canCancel: e.target.checked }))
                          }
                          className="w-4 h-4 rounded border-stone-300 text-brand-700 focus:ring-brand-700 disabled:cursor-not-allowed"
                        />
                        <span>cancelar</span>
                      </label>
                    </div>

                    {editError && <p className="text-xs text-red-600">{editError}</p>}

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        disabled={editSaving}
                        onClick={() => handleSaveEdit(granteeEmail)}
                        className="px-3 py-1.5 bg-brand-700 hover:bg-brand-800 disabled:opacity-60 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-md min-h-[44px] transition inline-flex items-center justify-center gap-1.5"
                      >
                        {editSaving ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            Salvando…
                          </>
                        ) : (
                          'Salvar'
                        )}
                      </button>
                      <button
                        type="button"
                        disabled={editSaving}
                        onClick={() => {
                          setEditingId(null);
                          setEditError(null);
                        }}
                        className="px-3 py-1.5 rounded-md border border-stone-300 hover:bg-stone-50 text-stone-700 text-xs font-semibold min-h-[44px] transition"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={permKey}
                  className="py-3 border-b border-stone-100 last:border-0 flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="text-sm">
                      <span className="font-medium text-stone-900">{granteeName}</span>
                      {' · '}
                      <span className="text-stone-500 truncate">{granteeEmail}</span>
                    </div>
                    <div className="text-xs text-stone-500 mt-0.5">
                      {formatCapabilities(perm)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(permKey);
                        setEditCaps({
                          canView: perm.canView,
                          canCreate: perm.canCreate,
                          canUpdate: perm.canUpdate,
                          canCancel: perm.canCancel,
                        });
                        setEditError(null);
                      }}
                      className="text-xs font-medium text-stone-700 hover:text-stone-900 min-h-[44px] px-2 py-1 inline-flex items-center"
                    >
                      Alterar
                    </button>
                    <button
                      type="button"
                      onClick={() => onRevoke(perm)}
                      className="text-xs font-medium text-red-700 hover:text-red-800 min-h-[44px] px-2 py-1 inline-flex items-center"
                    >
                      Remover
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Card Dar acesso a alguém */}
      <section className="bg-white rounded-lg border border-stone-200 p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-stone-900 mb-4">Dar acesso a alguém</h2>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div>
            <label htmlFor="grant-email" className="block text-xs font-medium text-stone-700 mb-1">
              E-mail
            </label>
            <input
              type="email"
              id="grant-email"
              required
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (formError) setFormError(null);
              }}
              aria-describedby={formError ? 'grant-email-error' : undefined}
              className="w-full px-3 py-2 text-base border border-stone-300 rounded-md focus:ring-2 focus:ring-brand-700 focus:outline-none min-h-[44px]"
            />
            {formError && (
              <p id="grant-email-error" className="text-xs text-red-600 mt-1.5">
                {formError}
              </p>
            )}
          </div>

          <div>
            <span className="block text-xs font-medium text-stone-700 mb-1">Pode</span>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <label
                htmlFor="grant-chk-view"
                className="min-h-[44px] inline-flex items-center gap-2 text-sm text-stone-800 cursor-pointer"
              >
                <input
                  type="checkbox"
                  id="grant-chk-view"
                  checked={caps.canView}
                  onChange={(e) => handleToggleView(e.target.checked)}
                  className="w-4 h-4 rounded border-stone-300 text-brand-700 focus:ring-brand-700"
                />
                <span>ver</span>
              </label>
              <label
                htmlFor="grant-chk-create"
                className={`min-h-[44px] inline-flex items-center gap-2 text-sm text-stone-800 ${
                  !caps.canView ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                }`}
              >
                <input
                  type="checkbox"
                  id="grant-chk-create"
                  disabled={!caps.canView}
                  checked={caps.canView ? caps.canCreate : false}
                  onChange={(e) => setCaps((prev) => ({ ...prev, canCreate: e.target.checked }))}
                  className="w-4 h-4 rounded border-stone-300 text-brand-700 focus:ring-brand-700 disabled:cursor-not-allowed"
                />
                <span>criar</span>
              </label>
              <label
                htmlFor="grant-chk-update"
                className={`min-h-[44px] inline-flex items-center gap-2 text-sm text-stone-800 ${
                  !caps.canView ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                }`}
              >
                <input
                  type="checkbox"
                  id="grant-chk-update"
                  disabled={!caps.canView}
                  checked={caps.canView ? caps.canUpdate : false}
                  onChange={(e) => setCaps((prev) => ({ ...prev, canUpdate: e.target.checked }))}
                  className="w-4 h-4 rounded border-stone-300 text-brand-700 focus:ring-brand-700 disabled:cursor-not-allowed"
                />
                <span>alterar</span>
              </label>
              <label
                htmlFor="grant-chk-cancel"
                className={`min-h-[44px] inline-flex items-center gap-2 text-sm text-stone-800 ${
                  !caps.canView ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                }`}
              >
                <input
                  type="checkbox"
                  id="grant-chk-cancel"
                  disabled={!caps.canView}
                  checked={caps.canView ? caps.canCancel : false}
                  onChange={(e) => setCaps((prev) => ({ ...prev, canCancel: e.target.checked }))}
                  className="w-4 h-4 rounded border-stone-300 text-brand-700 focus:ring-brand-700 disabled:cursor-not-allowed"
                />
                <span>cancelar</span>
              </label>
            </div>
          </div>

          <div className="pt-1">
            <button
              type="submit"
              disabled={submitting}
              className="w-full sm:w-auto px-5 py-2.5 bg-brand-700 hover:bg-brand-800 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium text-sm rounded-md transition inline-flex items-center justify-center gap-2 min-h-[44px]"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Dando acesso…
                </>
              ) : (
                'Dar acesso'
              )}
            </button>
            {successMsg && (
              <p className="text-sm text-emerald-700 mt-3" role="status">
                {successMsg}
              </p>
            )}
          </div>
        </form>
      </section>
    </div>
  );
}
