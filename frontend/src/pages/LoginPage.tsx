import React from 'react';
import { Calendar, Loader2, AlertTriangle } from 'lucide-react';

export interface LoginPageProps {
  email: string;
  setEmail: (val: string) => void;
  password: string;
  setPassword: (val: string) => void;
  authError: string | null;
  loading: boolean;
  onLogin: (e?: React.FormEvent, demo?: { email: string; password: string }) => Promise<void>;
}

const DEMO_ACCOUNTS = [
  { name: 'Carlos Silva — Usuário', email: 'carlos@vidaemdia.com.br' },
  { name: 'Dr. João Mendes — Profissional', email: 'dr.joao@vidaemdia.com.br' },
  { name: 'Maria Oliveira — Secretária', email: 'secretaria.maria@vidaemdia.com.br' },
];

export function LoginPage({
  email,
  setEmail,
  password,
  setPassword,
  authError,
  loading,
  onLogin,
}: LoginPageProps) {
  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Marca */}
        <div className="flex flex-col items-center text-center">
          <div className="p-2 bg-brand-700 rounded-md text-white mb-3">
            <Calendar className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-stone-900">VidaEmDia</h1>
          <p className="text-sm text-stone-600 mt-1">Sua agenda com lembretes no Telegram</p>
        </div>

        {/* Card com o formulário */}
        <div className="bg-white rounded-lg border border-stone-200 p-6 mt-6">
          <form onSubmit={(e) => onLogin(e)} noValidate className="space-y-4">
            {authError && (
              <div
                role="alert"
                className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 flex items-center gap-2"
              >
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <div>
              <label htmlFor="login-email" className="block text-sm font-medium text-stone-700 mb-1">
                E-mail
              </label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2 text-base border border-stone-300 rounded-md focus:ring-2 focus:ring-brand-700 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="login-password" className="block text-sm font-medium text-stone-700 mb-1">
                Senha
              </label>
              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
                  <span>Entrando…</span>
                </>
              ) : (
                <span>Entrar</span>
              )}
            </button>
          </form>
        </div>

        {/* Contas de demonstração */}
        <details className="mt-4 text-stone-700">
          <summary className="text-sm font-medium text-stone-600 hover:text-stone-900 cursor-pointer select-none text-center">
            Entrar com uma conta de demonstração
          </summary>
          <div className="mt-3 space-y-2">
            {DEMO_ACCOUNTS.map((acc) => (
              <button
                key={acc.email}
                type="button"
                disabled={loading}
                onClick={() => onLogin(undefined, { email: acc.email, password: '123456' })}
                className="w-full text-left px-3.5 py-2.5 rounded-md border border-stone-200 bg-white hover:bg-stone-50 hover:border-stone-300 transition text-sm font-medium text-stone-800 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {acc.name}
              </button>
            ))}
            <p className="text-xs text-stone-500 text-center pt-1">
              Contas de exemplo para testar o sistema. Senha de todas: 123456
            </p>
          </div>
        </details>
      </div>
    </div>
  );
}
