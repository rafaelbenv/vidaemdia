import React, { useState, useEffect } from 'react';
import { Calendar, Loader2, AlertTriangle } from 'lucide-react';
import { passwordRuleError } from './CriarContaPage';
import { requestPasswordCode, resetPassword, errorMessage } from '../api';

export interface EsqueciSenhaPageProps {
  onGoToLogin: (email?: string) => void;
}

export function EsqueciSenhaPage({ onGoToLogin }: EsqueciSenhaPageProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [resendCountdown, setResendCountdown] = useState(0);

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const interval = window.setInterval(() => {
      setResendCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [resendCountdown]);

  async function handleSubmitEmail(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setError('Informe um e-mail válido.');
      return;
    }

    setLoading(true);
    try {
      const res = await requestPasswordCode(trimmedEmail);
      setEmail(trimmedEmail);
      setStep(2);
      setStatusMessage(res.message);
      setResendCountdown(60);
    } catch (err: unknown) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleResendCode() {
    setError(null);
    setLoading(true);
    try {
      const res = await requestPasswordCode(email);
      setStatusMessage(res.message);
      setResendCountdown(60);
    } catch (err: unknown) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmitReset(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedCode = code.trim();
    if (!/^\d{6}$/.test(trimmedCode)) {
      setError('O código tem 6 números.');
      return;
    }

    const pwdErr = passwordRuleError(newPassword);
    if (pwdErr) {
      setError(pwdErr);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('As senhas não são iguais.');
      return;
    }

    setLoading(true);
    try {
      await resetPassword(email, trimmedCode, newPassword);
      onGoToLogin(email);
    } catch (err: unknown) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Marca */}
        <div className="flex flex-col items-center text-center">
          <div className="p-2 bg-brand-700 rounded-md text-white mb-3">
            <Calendar className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-stone-900">VidaEmDia</h1>
          <p className="text-sm text-stone-600 mt-1">Crie sua agenda pessoal com lembretes no Telegram</p>
        </div>

        {/* Card com o formulário */}
        <div className="bg-white rounded-lg border border-stone-200 p-6 mt-6">
          <h2 className="text-xl font-bold text-stone-900 mb-4">Recuperar a senha</h2>

          {step === 1 ? (
            <form onSubmit={handleSubmitEmail} noValidate className="space-y-4">
              <p className="text-sm text-stone-600">
                Enviaremos um código pelo Telegram vinculado à sua conta.
              </p>

              {error && (
                <div
                  role="alert"
                  className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 flex items-center gap-2"
                >
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label htmlFor="recuperar-email" className="block text-sm font-medium text-stone-700 mb-1">
                  E-mail
                </label>
                <input
                  id="recuperar-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2 text-base border border-stone-300 rounded-md focus:ring-2 focus:ring-brand-700 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-brand-700 hover:bg-brand-800 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-md transition flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Enviando…</span>
                  </>
                ) : (
                  <span>Enviar código</span>
                )}
              </button>

              <p className="text-xs text-stone-500 mt-4 text-center">
                Sem o Telegram vinculado não é possível recuperar a senha por aqui. Fale com quem administra o VidaEmDia.
              </p>
            </form>
          ) : (
            <form onSubmit={handleSubmitReset} noValidate className="space-y-4">
              {statusMessage && (
                <div
                  role="status"
                  className="text-sm text-stone-800 bg-stone-100 border border-stone-200 rounded-md px-3 py-2"
                >
                  {statusMessage}
                </div>
              )}

              {error && (
                <div
                  role="alert"
                  className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 flex items-center gap-2"
                >
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <p className="text-sm text-stone-600">
                Código enviado para o Telegram da conta {email}.{' '}
                <button
                  type="button"
                  onClick={() => {
                    setStep(1);
                    setError(null);
                    setStatusMessage(null);
                  }}
                  className="text-brand-700 font-semibold hover:underline"
                >
                  Usar outro e-mail
                </button>
              </p>

              <div>
                <label htmlFor="recuperar-codigo" className="block text-sm font-medium text-stone-700 mb-1">
                  Código
                </label>
                <input
                  id="recuperar-codigo"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full px-3.5 py-2 text-base border border-stone-300 rounded-md focus:ring-2 focus:ring-brand-700 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="recuperar-senha" className="block text-sm font-medium text-stone-700 mb-1">
                  Nova senha
                </label>
                <input
                  id="recuperar-senha"
                  type="password"
                  autoComplete="new-password"
                  aria-describedby="recuperar-senha-dica"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3.5 py-2 text-base border border-stone-300 rounded-md focus:ring-2 focus:ring-brand-700 focus:outline-none"
                />
                <p id="recuperar-senha-dica" className="text-xs text-stone-500 mt-1">
                  Mínimo de 8 caracteres, com letra e número.
                </p>
              </div>

              <div>
                <label htmlFor="recuperar-confirmar" className="block text-sm font-medium text-stone-700 mb-1">
                  Confirmar nova senha
                </label>
                <input
                  id="recuperar-confirmar"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3.5 py-2 text-base border border-stone-300 rounded-md focus:ring-2 focus:ring-brand-700 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-brand-700 hover:bg-brand-800 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-md transition flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Salvando…</span>
                  </>
                ) : (
                  <span>Criar senha nova</span>
                )}
              </button>

              <div className="text-center pt-1">
                <button
                  type="button"
                  disabled={loading || resendCountdown > 0}
                  onClick={handleResendCode}
                  className="text-sm text-brand-700 font-semibold hover:underline disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {resendCountdown > 0 ? `Reenviar código (${resendCountdown}s)` : 'Reenviar código'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Rodapé das duas etapas */}
        <div className="text-center mt-4 text-sm text-stone-600">
          <span>Lembrou a senha? </span>
          <button
            type="button"
            onClick={() => onGoToLogin()}
            className="text-brand-700 font-semibold hover:underline"
          >
            Entrar
          </button>
        </div>
      </div>
    </div>
  );
}
