import React, { useState } from 'react';
import { Calendar, Loader2, AlertTriangle } from 'lucide-react';

export interface CriarContaPageProps {
  loading: boolean;
  onRegister: (name: string, email: string, password: string) => Promise<string | null>;
  onGoToLogin: () => void;
}

export function passwordRuleError(password: string): string | null {
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  if (password.length < 8 || password.length > 72 || !hasLetter || !hasNumber) {
    return 'A senha precisa ter de 8 a 72 caracteres, com pelo menos uma letra e um número.';
  }
  return null;
}

export function CriarContaPage({ loading, onRegister, onGoToLogin }: CriarContaPageProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Informe o seu nome.');
      return;
    }

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setError('Informe um e-mail válido.');
      return;
    }

    const pwdErr = passwordRuleError(password);
    if (pwdErr) {
      setError(pwdErr);
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas não são iguais.');
      return;
    }

    const serverError = await onRegister(trimmedName, trimmedEmail, password);
    if (serverError) {
      setError(serverError);
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
          <h2 className="text-xl font-bold text-stone-900 mb-4">Criar conta</h2>
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
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
              <label htmlFor="cadastro-nome" className="block text-sm font-medium text-stone-700 mb-1">
                Nome
              </label>
              <input
                id="cadastro-nome"
                type="text"
                autoComplete="name"
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2 text-base border border-stone-300 rounded-md focus:ring-2 focus:ring-brand-700 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="cadastro-email" className="block text-sm font-medium text-stone-700 mb-1">
                E-mail
              </label>
              <input
                id="cadastro-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2 text-base border border-stone-300 rounded-md focus:ring-2 focus:ring-brand-700 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="cadastro-senha" className="block text-sm font-medium text-stone-700 mb-1">
                Senha
              </label>
              <input
                id="cadastro-senha"
                type="password"
                autoComplete="new-password"
                aria-describedby="cadastro-senha-dica"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3.5 py-2 text-base border border-stone-300 rounded-md focus:ring-2 focus:ring-brand-700 focus:outline-none"
              />
              <p id="cadastro-senha-dica" className="text-xs text-stone-500 mt-1">
                Mínimo de 8 caracteres, com letra e número.
              </p>
            </div>

            <div>
              <label htmlFor="cadastro-confirmar" className="block text-sm font-medium text-stone-700 mb-1">
                Confirmar senha
              </label>
              <input
                id="cadastro-confirmar"
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
                  <span>Criando…</span>
                </>
              ) : (
                <span>Criar conta</span>
              )}
            </button>
          </form>
        </div>

        <div className="text-center mt-4 text-sm text-stone-600">
          <span>Já tem conta? </span>
          <button
            type="button"
            onClick={onGoToLogin}
            className="text-brand-700 font-semibold hover:underline"
          >
            Entrar
          </button>
        </div>
      </div>
    </div>
  );
}
