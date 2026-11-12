import React from 'react';
import { ChevronDown, Send, LogOut } from 'lucide-react';
import { User } from '../types';
import { TechTag } from './TechTag';

export interface UserMenuProps {
  user: User;
  userMenuOpen: boolean;
  setUserMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  userMenuRef: React.RefObject<HTMLDivElement>;
  userInitials: string;
  telegramLinked: boolean;
  telegramWaiting: boolean;
  submitting: Record<string, boolean>;
  handleConnectTelegram: () => void | Promise<void>;
  openUnlinkTelegramDialog: () => void;
  openLogoutDialog: () => void;
}

export function UserMenu({
  user,
  userMenuOpen,
  setUserMenuOpen,
  userMenuRef,
  userInitials,
  telegramLinked,
  telegramWaiting,
  submitting,
  handleConnectTelegram,
  openUnlinkTelegramDialog,
  openLogoutDialog,
}: UserMenuProps) {
  return (
    <div className="relative" ref={userMenuRef}>
      <button
        type="button"
        onClick={() => setUserMenuOpen((prev) => !prev)}
        className="flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-stone-800 transition border border-transparent hover:border-stone-700 text-left focus:outline-none focus:ring-2 focus:ring-brand-500"
        aria-expanded={userMenuOpen}
        aria-haspopup="true"
        aria-label="Menu do usuário"
      >
        <div className="w-8 h-8 rounded-full bg-brand-700 text-white font-semibold text-xs flex items-center justify-center border border-brand-500 shadow-sm shrink-0">
          {userInitials}
        </div>
        <div className="hidden sm:block text-left">
          <div className="text-xs font-semibold text-white leading-tight">{user.name}</div>
          <div className="text-[11px] text-stone-400 font-mono">{user.role}</div>
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 text-stone-400 transition-transform ${
            userMenuOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {userMenuOpen && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-72 bg-white rounded-lg shadow-xl border border-stone-200 py-2 z-50 text-stone-900"
        >
          {/* Cabeçalho do Menu: Identificação do Usuário */}
          <div className="px-4 py-2.5 border-b border-stone-100">
            <p className="text-xs font-bold text-stone-900">{user.name}</p>
            <p className="text-xs text-stone-500 truncate">{user.email}</p>
            <div className="flex items-center gap-1.5 mt-1.5">
              <span className="px-1.5 py-0.5 bg-stone-100 text-stone-700 rounded text-[11px] font-mono font-medium">
                {user.role}
              </span>
              <TechTag>JWT Autenticado</TechTag>
            </div>
          </div>

          {/* Seção Telegram: Conexão / Desconexão */}
          <div className="px-4 py-2.5 border-b border-stone-100 space-y-2">
            <div className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider">
              Notificações Telegram
            </div>
            {telegramLinked ? (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Telegram conectado
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setUserMenuOpen(false);
                    openUnlinkTelegramDialog();
                  }}
                  disabled={submitting['telegram']}
                  className="w-full text-left px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded transition flex items-center gap-1.5 disabled:opacity-60"
                >
                  {submitting['telegram'] ? 'Desconectando…' : 'Desconectar Telegram'}
                </button>
              </div>
            ) : (
              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => {
                    handleConnectTelegram();
                  }}
                  disabled={submitting['telegram']}
                  className="w-full text-left px-2.5 py-1.5 text-xs font-semibold bg-sky-50 text-sky-700 hover:bg-sky-100 rounded transition flex items-center gap-1.5 disabled:opacity-60"
                >
                  <Send className="w-3.5 h-3.5" />
                  {submitting['telegram'] ? 'Conectando…' : 'Conectar Telegram'}
                </button>
                {telegramWaiting && (
                  <p className="text-[11px] text-sky-600 animate-pulse">
                    Clique em Iniciar no Telegram e volte aqui
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Ação Sair */}
          <div className="px-2 pt-1.5">
            <button
              type="button"
              onClick={() => {
                setUserMenuOpen(false);
                openLogoutDialog();
              }}
              className="w-full text-left px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 rounded transition flex items-center gap-2"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sair
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
