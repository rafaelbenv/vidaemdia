import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { GoogleStatus, User } from '../types';
import { changePassword, errorMessage, updateProfile } from '../api';

export interface MinhaContaPageProps {
  user: User;
  token: string;
  onUserUpdated: (user: User) => void;
  onBack: () => void;
  telegramLinked?: boolean;
  telegramWaiting?: boolean;
  telegramConnecting?: boolean;
  onConnectTelegram: () => void | Promise<void>;
  onUnlinkTelegram: () => void;
  googleStatus?: GoogleStatus | null;
  onConnectGoogle?: () => void | Promise<void>;
  onDisconnectGoogle?: () => void;
}

export function MinhaContaPage({
  user,
  token,
  onUserUpdated,
  onBack,
  telegramLinked = false,
  telegramWaiting = false,
  telegramConnecting = false,
  onConnectTelegram,
  onUnlinkTelegram,
  googleStatus,
  onConnectGoogle,
  onDisconnectGoogle,
}: MinhaContaPageProps) {
  // Estado Dados
  const [name, setName] = useState(user.name);
  const [nameLoading, setNameLoading] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameSuccess, setNameSuccess] = useState(false);

  useEffect(() => {
    setName(user.name);
  }, [user.name]);

  // Estado Senha
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault();
    setNameError(null);
    setNameSuccess(false);

    const trimmed = name.trim();
    if (!trimmed || trimmed === user.name) return;

    try {
      setNameLoading(true);
      const updated = await updateProfile(token, trimmed);
      onUserUpdated(updated);
      setName(updated.name);
      setNameSuccess(true);
    } catch (err: unknown) {
      setNameError(errorMessage(err, 'Não foi possível atualizar o nome.'));
    } finally {
      setNameLoading(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);

    if (!currentPassword) {
      setPasswordError('Informe a senha atual.');
      return;
    }

    const hasLetter = /[a-zA-Z]/.test(newPassword);
    const hasNumber = /\d/.test(newPassword);
    if (newPassword.length < 8 || newPassword.length > 72 || !hasLetter || !hasNumber) {
      setPasswordError('A senha precisa ter de 8 a 72 caracteres, com pelo menos uma letra e um número.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('As senhas não são iguais.');
      return;
    }

    try {
      setPasswordLoading(true);
      await changePassword(token, currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordSuccess(true);
    } catch (err: unknown) {
      setPasswordError(errorMessage(err, 'Não foi possível alterar a senha.'));
    } finally {
      setPasswordLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Topo */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h1 className="text-2xl font-bold text-stone-900">Minha conta</h1>
        <button
          type="button"
          onClick={onBack}
          className="text-sm font-medium text-stone-600 hover:text-stone-900 inline-flex items-center gap-1 min-h-[44px] py-2 self-start sm:self-auto"
        >
          ← Voltar para a agenda
        </button>
      </div>

      {/* Card 1: Dados */}
      <section className="bg-white rounded-lg border border-stone-200 p-5">
        <h2 className="text-lg font-semibold text-stone-900 mb-4">Dados</h2>
        <form onSubmit={handleSaveName} noValidate className="space-y-4">
          {nameError && (
            <div
              role="alert"
              className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 flex items-center gap-2"
            >
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{nameError}</span>
            </div>
          )}

          {nameSuccess && (
            <div
              role="status"
              className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2 flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>Nome atualizado.</span>
            </div>
          )}

          <div>
            <label htmlFor="conta-nome" className="block text-sm font-medium text-stone-700 mb-1">
              Nome
            </label>
            <input
              id="conta-nome"
              type="text"
              autoComplete="name"
              maxLength={80}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (nameSuccess) setNameSuccess(false);
              }}
              className="w-full px-3.5 py-2 text-base border border-stone-300 rounded-md focus:ring-2 focus:ring-brand-700 focus:outline-none"
            />
          </div>

          <div>
            <span className="block text-sm font-medium text-stone-700 mb-1">E-mail</span>
            <p className="text-base text-stone-900">{user.email}</p>
            <p className="text-xs text-stone-500 mt-1">O e-mail não pode ser alterado.</p>
          </div>

          <div>
            <button
              type="submit"
              disabled={!name.trim() || name.trim() === user.name || nameLoading}
              className="py-2 px-4 bg-brand-700 hover:bg-brand-800 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-md transition inline-flex items-center justify-center gap-2"
            >
              {nameLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Salvando…</span>
                </>
              ) : (
                <span>Salvar nome</span>
              )}
            </button>
          </div>
        </form>
      </section>

      {/* Card 2: Senha */}
      <section className="bg-white rounded-lg border border-stone-200 p-5">
        <h2 className="text-lg font-semibold text-stone-900 mb-4">Senha</h2>
        <form onSubmit={handleChangePassword} noValidate className="space-y-4">
          {passwordError && (
            <div
              role="alert"
              className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 flex items-center gap-2"
            >
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{passwordError}</span>
            </div>
          )}

          {passwordSuccess && (
            <div
              role="status"
              className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2 flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>Senha alterada.</span>
            </div>
          )}

          <div>
            <label htmlFor="conta-senha-atual" className="block text-sm font-medium text-stone-700 mb-1">
              Senha atual
            </label>
            <input
              id="conta-senha-atual"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => {
                setCurrentPassword(e.target.value);
                if (passwordSuccess) setPasswordSuccess(false);
              }}
              className="w-full px-3.5 py-2 text-base border border-stone-300 rounded-md focus:ring-2 focus:ring-brand-700 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="conta-nova-senha" className="block text-sm font-medium text-stone-700 mb-1">
              Nova senha
            </label>
            <input
              id="conta-nova-senha"
              type="password"
              autoComplete="new-password"
              aria-describedby="conta-senha-dica"
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value);
                if (passwordSuccess) setPasswordSuccess(false);
              }}
              className="w-full px-3.5 py-2 text-base border border-stone-300 rounded-md focus:ring-2 focus:ring-brand-700 focus:outline-none"
            />
            <p id="conta-senha-dica" className="text-xs text-stone-500 mt-1">
              Mínimo de 8 caracteres, com letra e número.
            </p>
          </div>

          <div>
            <label htmlFor="conta-confirmar-senha" className="block text-sm font-medium text-stone-700 mb-1">
              Confirmar nova senha
            </label>
            <input
              id="conta-confirmar-senha"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (passwordSuccess) setPasswordSuccess(false);
              }}
              className="w-full px-3.5 py-2 text-base border border-stone-300 rounded-md focus:ring-2 focus:ring-brand-700 focus:outline-none"
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={passwordLoading}
              className="py-2 px-4 bg-brand-700 hover:bg-brand-800 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-md transition inline-flex items-center justify-center gap-2"
            >
              {passwordLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Trocando…</span>
                </>
              ) : (
                <span>Trocar senha</span>
              )}
            </button>
          </div>
        </form>
      </section>

      {/* Card 3: Conexões */}
      <section className="bg-white rounded-lg border border-stone-200 p-5">
        <h2 className="text-lg font-semibold text-stone-900 mb-4">Conexões</h2>
        <div className="space-y-4 divide-y divide-stone-100">
          {/* Telegram */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 first:pt-0">
            <div>
              <span className="block text-sm font-medium text-stone-900">Telegram</span>
              <span className="text-sm text-stone-600">
                {telegramLinked ? 'Conectado' : 'Não conectado'}
              </span>
              {!telegramLinked && telegramWaiting && (
                <p className="text-xs text-sky-600 mt-1 inline-flex items-center gap-1.5">
                  Abra o Telegram e toque em Iniciar. Esta tela atualiza sozinha.{' '}
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-600 shrink-0" aria-hidden="true" />
                </p>
              )}
            </div>
            <div className="shrink-0">
              {telegramLinked ? (
                <button
                  type="button"
                  onClick={onUnlinkTelegram}
                  className="text-red-600 hover:text-red-700 hover:underline text-sm font-medium min-h-11 min-w-11 sm:min-h-0 sm:min-w-0 inline-flex items-center justify-center"
                >
                  Desconectar
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onConnectTelegram}
                  disabled={telegramConnecting || telegramWaiting}
                  className="bg-brand-700 hover:bg-brand-800 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md px-3.5 py-2 text-sm font-medium transition"
                >
                  {telegramConnecting ? 'Conectando…' : 'Conectar Telegram'}
                </button>
              )}
            </div>
          </div>

          {/* Google Agenda */}
          {googleStatus?.configured && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4">
              <div>
                <span className="block text-sm font-medium text-stone-900">Google Agenda</span>
                <span className="text-sm text-stone-600">
                  {googleStatus.connected
                    ? googleStatus.email
                      ? `Conectado como ${googleStatus.email}`
                      : 'Conectado'
                    : 'Não conectado'}
                </span>
              </div>
              <div className="shrink-0">
                {googleStatus.connected ? (
                  <button
                    type="button"
                    onClick={onDisconnectGoogle}
                    className="text-red-600 hover:text-red-700 hover:underline text-sm font-medium min-h-11 min-w-11 sm:min-h-0 sm:min-w-0 inline-flex items-center justify-center"
                  >
                    Desconectar
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onConnectGoogle}
                    className="bg-brand-700 hover:bg-brand-800 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md px-3.5 py-2 text-sm font-medium transition"
                  >
                    Conectar Google
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
