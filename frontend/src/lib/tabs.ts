import React from 'react';
import {
  Calendar as CalendarIcon,
  Users,
  Bell,
  MessageSquare,
  FileText,
} from 'lucide-react';
import { UserRole } from '../types';

export type TabId = 'agenda' | 'rbac' | 'worker' | 'chatbot' | 'auditoria';

export interface TabDefinition {
  id: TabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const TAB_DEFINITIONS: TabDefinition[] = [
  { id: 'agenda', label: 'Agenda', icon: CalendarIcon },
  { id: 'rbac', label: 'Acessos', icon: Users },
  { id: 'worker', label: 'Lembretes', icon: Bell },
  { id: 'chatbot', label: 'Assistente', icon: MessageSquare },
  { id: 'auditoria', label: 'Auditoria', icon: FileText },
];

export function getVisibleTabs(role?: UserRole): TabId[] {
  if (!role) return ['agenda'];
  switch (role) {
    case 'USER':
      return ['agenda', 'chatbot'];
    case 'SECRETARY':
      return ['agenda', 'rbac', 'chatbot'];
    case 'PROFESSIONAL':
      // O seed não tem ADMIN, então o profissional vê todas as abas (inclui Auditoria)
      return ['agenda', 'rbac', 'worker', 'chatbot', 'auditoria'];
    case 'ADMIN':
      return ['agenda', 'rbac', 'worker', 'chatbot', 'auditoria'];
    default:
      return ['agenda', 'chatbot'];
  }
}

export const LOGIN_PATH = '/entrar';
export const TAB_PATHS: Record<TabId, string> = {
  agenda: '/agenda',
  rbac: '/agenda/compartilhar',
  worker: '/bastidores/lembretes',
  chatbot: '/bastidores/assistente',
  auditoria: '/bastidores/auditoria',
};
export function tabFromPath(pathname: string): TabId | null {
  const clean = pathname.replace(/\/+$/, '') || '/';
  const entry = (Object.entries(TAB_PATHS) as [TabId, string][]).find(([, p]) => p === clean);
  return entry ? entry[0] : null;
}

