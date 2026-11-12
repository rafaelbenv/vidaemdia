import React from 'react';
import { ChevronDown, LogOut, Wrench } from 'lucide-react';
import { User } from '../types';
import { firstName, roleLabel } from '../lib/format';

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
  showBastidores: boolean;
  onOpenBastidores: () => void;
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
  showBastidores,
  onOpenBastidores,
}: UserMenuProps) {
  const userFirstName = firstName(user.name);

  return (
    <div className="relative" ref={userMenuRef}>
      <button
        type="button"
        onClick={() => setUserMenuOpen((prev) => !prev)}
        className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-stone-800 transition border border-transparent hover:border-stone-700 text-left focus:outline-none focus:ring-2 focus:ring-brand-500 focus-visible:outline-white min-h-[44px]"
        aria-expanded={userMenuOpen}
        aria-haspopup="menu"
        aria-label="Menu do usuário"
      >
        <div className="w-8 h-8 rounded-full bg-brand-700 text-white font-semibold text-xs flex items-center justify-center border border-brand-500 shadow-sm shrink-0">
          {userInitials}
        </div>
        {userFirstName && (
          <span className="hidden sm:inline text-sm font-medium text-white">
            {userFirstName}
          </span>
        )}
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
            <p className="text-sm font-medium text-stone-900">{user.name}</p>
            <p className="text-xs text-stone-500 truncate">{user.email}</p>
            <p className="text-xs text-stone-500 mt-0.5">{roleLabel(user.role)}</p>
          </div>

          {/* Seção Telegram: Conexão / Desconexão */}
          <div className="px-4 py-2.5 border-b border-stone-100">
            {telegramLinked ? (
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="text-stone-700">Telegram: conectado</span>
                <button
                  type="button"
                  onClick={() => {
                    setUserMenuOpen(false);
                    openUnlinkTelegramDialog();
                  }}
                  disabled={submitting['telegram']}
                  className="text-red-600 hover:text-red-700 hover:underline font-medium disabled:opacity-60 min-h-11 min-w-11 sm:min-h-0 sm:min-w-0 inline-flex items-center justify-center"
                >
                  {submitting['telegram'] ? 'Desconectando…' : 'Desconectar'}
                </button>
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-stone-700">Telegram: não conectado</span>
                  <button
                    type="button"
                    onClick={() => {
                      handleConnectTelegram();
                    }}
                    disabled={submitting['telegram']}
                    className="text-brand-700 hover:text-brand-800 hover:underline font-semibold disabled:opacity-60 min-h-11 min-w-11 sm:min-h-0 sm:min-w-0 inline-flex items-center justify-center"
                  >
                    {submitting['telegram'] ? 'Conectando…' : 'Conectar'}
                  </button>
                </div>
                {telegramWaiting && (
                  <p className="text-[11px] text-sky-600 animate-pulse">
                    Abra o Telegram e toque em Iniciar
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Bastidores (área técnica) */}
          {showBastidores && (
            <div className="px-2 py-1.5 border-b border-stone-100">
              <button
                type="button"
                onClick={() => {
                  setUserMenuOpen(false);
                  onOpenBastidores();
                }}
                className="w-full text-left px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-100 rounded transition flex items-center gap-2 min-h-11 min-w-11 sm:min-h-[40px] sm:min-w-0"
              >
                <Wrench className="w-3.5 h-3.5 text-stone-500" />
                Bastidores (área técnica)
              </button>
            </div>
          )}

          {/* Ação Sair */}
          <div className="px-2 pt-1.5">
            <button
              type="button"
              onClick={() => {
                setUserMenuOpen(false);
                openLogoutDialog();
              }}
              className="w-full text-left px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 rounded transition flex items-center gap-2 min-h-11 min-w-11 sm:min-h-[40px] sm:min-w-0"
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
