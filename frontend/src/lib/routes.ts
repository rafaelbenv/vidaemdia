import {
  Bell,
  MessageSquare,
  ShieldCheck,
  FileText,
  Activity,
} from 'lucide-react';

export type LucideIcon = typeof Bell;

export const LOGIN_PATH = '/entrar';
export const AGENDA_PATH = '/agenda';
export const COMPARTILHAR_PATH = '/agenda/compartilhar';
export const HISTORICO_PATH = '/agenda/historico';
export const SHOW_BASTIDORES = import.meta.env.VITE_SHOW_BASTIDORES !== 'false';
export type BastidoresSection = 'lembretes' | 'assistente' | 'acesso' | 'auditoria' | 'saude';

export const BASTIDORES_SECTIONS: {
  id: BastidoresSection;
  label: string;
  intro: string;
  icon: LucideIcon;
}[] = [
  {
    id: 'lembretes',
    label: '1. Envio de lembretes',
    icon: Bell,
    intro:
      'Worker que consulta o PostgreSQL a cada minuto e envia os lembretes pelo Telegram, com até 3 tentativas. Cobre o Fluxo 3 do diagrama.',
  },
  {
    id: 'assistente',
    label: '2. Assistente',
    icon: MessageSquare,
    intro:
      'Simulador do bot do Telegram: o texto passa pelo mesmo webhook e cria compromissos de verdade. Cobre o Fluxo 3 (chatbot).',
  },
  {
    id: 'acesso',
    label: '3. Controle de acesso',
    icon: ShieldCheck,
    intro:
      'Teste do RBAC: acessar a agenda de um profissional devolve 200 com autorização e 403 sem ela. Cobre o Fluxo 2 do diagrama.',
  },
  {
    id: 'auditoria',
    label: '4. Auditoria',
    icon: FileText,
    intro:
      'Registro imutável de quem criou, alterou, cancelou ou teve o acesso negado, gravado no PostgreSQL.',
  },
  {
    id: 'saude',
    label: '5. Saúde do sistema',
    icon: Activity,
    intro:
      'Estado do backend, do banco e do worker, e as métricas expostas para o Prometheus e o Grafana.',
  },
];

export const bastidoresPath = (s: BastidoresSection) => `/bastidores/${s}`;

export function sectionFromPath(pathname: string): BastidoresSection | null {
  const clean = pathname.replace(/\/+$/, '') || '/';
  const prefix = '/bastidores/';
  if (!clean.startsWith(prefix)) return null;
  const sectionId = clean.slice(prefix.length) as BastidoresSection;
  const valid = BASTIDORES_SECTIONS.some((s) => s.id === sectionId);
  return valid ? sectionId : null;
}
