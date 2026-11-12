import React from 'react';
import {
  Calendar as CalendarIcon,
  CheckCircle2,
  ShieldCheck,
  Bell,
  Lock,
  AlertTriangle,
} from 'lucide-react';
import { TechTag } from '../components/TechTag';

export interface LoginPageProps {
  email: string;
  setEmail: (val: string) => void;
  password: string;
  setPassword: (val: string) => void;
  authError: string | null;
  loading: boolean;
  onLogin: (e?: React.FormEvent, quickEmail?: string) => Promise<void>;
}

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
    <div className="min-h-screen bg-stone-900 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full grid md:grid-cols-2 bg-white rounded-lg border border-stone-200 overflow-hidden">
        {/* Coluna Esquerda: Apresentação dos 3 Fluxos */}
        <div className="bg-brand-700 p-8 text-white flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 bg-white/20 rounded-md">
                <CalendarIcon className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">VidaEmDia</h1>
                <p className="text-xs text-brand-50">Agenda Pessoal/Profissional & Chatbot Telegram</p>
              </div>
            </div>

            <p className="text-sm text-brand-50 leading-relaxed mb-6">
              Plataforma completa implementando os três fluxos arquiteturais do projeto:
            </p>

            <div className="space-y-4 text-xs">
              <div className="bg-white/10 p-3.5 rounded-md border border-white/15">
                <div className="font-semibold text-white flex items-center gap-2 mb-1 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                  1. Fluxo Principal (Cadastro & JWT)
                </div>
                <p className="text-brand-50 text-xs">
                  Autenticação JWT, agendas pessoal e profissional, validação NestJS e persistência no PostgreSQL.
                </p>
              </div>

              <div className="bg-white/10 p-3.5 rounded-md border border-white/15">
                <div className="font-semibold text-white flex items-center gap-2 mb-1 text-sm">
                  <ShieldCheck className="w-4 h-4 text-amber-300" />
                  2. Fluxo RBAC (Secretária ↔ Profissional)
                </div>
                <p className="text-brand-50 text-xs">
                  Delegação de acesso com dupla checagem RBAC, retorno 403 para agendas não autorizadas e log de auditoria.
                </p>
              </div>

              <div className="bg-white/10 p-3.5 rounded-md border border-white/15">
                <div className="font-semibold text-white flex items-center gap-2 mb-1 text-sm">
                  <Bell className="w-4 h-4 text-emerald-300" />
                  3. Worker Telegram + Chatbot
                </div>
                <p className="text-brand-50 text-xs">
                  Disparo periódico de lembretes com política de Retry (máx. 3 tentativas) e criação de eventos via chat.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-4 border-t border-white/20 text-xs text-brand-50 flex items-center justify-between">
            <span>Segurança: HTTPS · JWT · RBAC · Auditoria</span>
            <TechTag>PostgreSQL 16</TechTag>
          </div>
        </div>

        {/* Coluna Direita: Formulário de Login + Acesso Rápido Demo */}
        <div className="p-8 flex flex-col justify-between">
          <div>
            <h2 className="text-xl font-bold text-stone-900 mb-1">Acessar Sistema Web</h2>
            <p className="text-sm text-stone-500 mb-6">
              Entre com e-mail e senha para gerar seu token JWT ou selecione um perfil de demonstração abaixo.
            </p>

            {authError && (
              <div className="mb-4 p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <form onSubmit={(e) => onLogin(e)} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">E-mail</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2 text-base border border-stone-300 rounded-md focus:ring-2 focus:ring-brand-700 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">Senha</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3.5 py-2 text-base border border-stone-300 rounded-md focus:ring-2 focus:ring-brand-700 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-brand-700 hover:bg-brand-800 text-white font-semibold text-sm rounded-md transition flex items-center justify-center gap-2"
              >
                <Lock className="w-4 h-4" />
                {loading ? 'Validando credenciais...' : 'Entrar (Gerar JWT)'}
              </button>
            </form>

            <div className="mt-6">
              <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-3">
                Perfis Rápidos para Testar os Fluxos (1-Clique):
              </p>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => onLogin(undefined, 'carlos@vidaemdia.com.br')}
                  className="w-full text-left p-2.5 rounded-md border border-stone-200 bg-stone-50 hover:bg-stone-100 transition flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-bold text-stone-900">👤 Carlos Silva (Usuário)</span>
                    <p className="text-stone-600 text-xs">Testa Fluxo Principal (Agenda Pessoal + Telegram)</p>
                  </div>
                  <span className="px-2 py-0.5 bg-stone-200 text-stone-800 rounded-md font-mono text-[11px]">USER</span>
                </button>

                <button
                  type="button"
                  onClick={() => onLogin(undefined, 'dr.joao@vidaemdia.com.br')}
                  className="w-full text-left p-2.5 rounded-md border border-stone-200 bg-stone-50 hover:bg-stone-100 transition flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-bold text-stone-900">🩺 Dr. João Mendes (Profissional)</span>
                    <p className="text-stone-600 text-xs">Agenda Médica + Delegação RBAC para Secretária</p>
                  </div>
                  <span className="px-2 py-0.5 bg-stone-200 text-stone-800 rounded-md font-mono text-[11px]">
                    PROFESSIONAL
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => onLogin(undefined, 'secretaria.maria@vidaemdia.com.br')}
                  className="w-full text-left p-2.5 rounded-md border border-stone-200 bg-stone-50 hover:bg-stone-100 transition flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-bold text-stone-900">🗂️ Maria Oliveira (Secretária)</span>
                    <p className="text-stone-600 text-xs">
                      Testa Fluxo RBAC (Acessa Dr. João ✅ | Bloqueada na Dra. Ana 403 ❌)
                    </p>
                  </div>
                  <span className="px-2 py-0.5 bg-stone-200 text-stone-800 rounded-md font-mono text-[11px]">
                    SECRETARY
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
