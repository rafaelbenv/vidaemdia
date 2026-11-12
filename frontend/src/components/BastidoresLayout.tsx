import React from 'react';
import { Link } from 'react-router-dom';
import { Wrench, ArrowLeft } from 'lucide-react';
import { BASTIDORES_SECTIONS, BastidoresSection, bastidoresPath } from '../lib/routes';

export interface BastidoresLayoutProps {
  section: BastidoresSection;
  userName: string;
  onBack: () => void;
  children: React.ReactNode;
  feedbackBanner?: React.ReactNode;
}

export function BastidoresLayout({
  section,
  userName: _userName,
  onBack,
  children,
  feedbackBanner,
}: BastidoresLayoutProps) {
  const currentSection = BASTIDORES_SECTIONS.find((s) => s.id === section);

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      {/* Cabeçalho Escuro */}
      <header className="bg-stone-950 text-white border-b border-stone-800 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Wrench className="w-5 h-5 text-stone-300" />
            <div>
              <div className="font-semibold text-white leading-tight">Bastidores</div>
              <p className="text-xs text-stone-400">Área técnica — demonstração do trabalho</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onBack}
            className="text-sm text-stone-200 hover:text-white transition inline-flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500 rounded"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar para a agenda</span>
          </button>
        </div>
      </header>

      {feedbackBanner}

      {/* Corpo */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 grid lg:grid-cols-[220px_1fr] gap-6 flex-1">
        {/* Menu Lateral */}
        <nav
          aria-label="Seções dos bastidores"
          className="flex lg:flex-col overflow-x-auto gap-1 pb-2 lg:pb-0"
        >
          {BASTIDORES_SECTIONS.map((item) => {
            const Icon = item.icon;
            const isActive = item.id === section;
            return (
              <Link
                key={item.id}
                to={bastidoresPath(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`rounded-md px-3 py-2 text-sm flex items-center gap-2 transition whitespace-nowrap ${
                  isActive
                    ? 'bg-brand-50 text-brand-800 font-semibold'
                    : 'text-stone-700 hover:bg-stone-100'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Conteúdo */}
        <div>
          {currentSection && (
            <>
              <h1 className="text-lg font-semibold text-stone-900">{currentSection.label}</h1>
              <p className="text-sm text-stone-600 mt-1 mb-5 max-w-3xl">{currentSection.intro}</p>
            </>
          )}
          {children}
        </div>
      </div>

      {/* Rodapé de Segurança */}
      <footer className="bg-stone-900 text-stone-400 text-xs py-3 px-4 border-t border-stone-800 text-center">
        <strong className="text-stone-200">SEGURANÇA VIDAEMDIA</strong> — HTTPS em todas as
        comunicações · JWT para autenticação · RBAC para controle de acesso · Credenciais em
        variáveis de ambiente · Logs de auditoria · Backup periódico do PostgreSQL
      </footer>
    </div>
  );
}
