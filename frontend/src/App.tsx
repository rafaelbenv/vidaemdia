import React, { useEffect, useRef, useState } from 'react';
import {
  Calendar as CalendarIcon,
  Clock,
  ShieldCheck,
  ShieldAlert,
  Bell,
  MessageSquare,
  Send,
  UserCheck,
  Lock,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Activity,
  Database,
  LogOut,
  FileText,
  Smartphone,
  ChevronDown,
} from 'lucide-react';
import {
  cancelAppointment,
  createAppointment,
  createTelegramLink,
  getAppointments,
  getAuditLogs,
  getCalendars,
  getHealth,
  getMe,
  getNotificationsStatus,
  getProfessionals,
  getTelegramStatus,
  grantPermission,
  login,
  runWorkerNow,
  setUnauthorizedHandler,
  simulateFailure,
  sendBotMessage,
  unlinkTelegram,
  verifyCalendarAccess,
} from './api';
import {
  Appointment,
  AuditLogEntry,
  Calendar,
  DispatchedMessageLog,
  NotificationChannel,
  ProfessionalDirectoryEntry,
  Reminder,
  User,
} from './types';
import {
  checkIsPast,
  formatApptDateTime,
  getErrorMessageByStatus,
  sanitizeTelegramHtml,
  todayStr,
} from './lib/format';
import { getVisibleTabs, TAB_DEFINITIONS, TabId } from './lib/tabs';
import { ConfirmDialog, ConfirmModalProps } from './components/ConfirmDialog';
import { TechTag } from './components/TechTag';

export function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('vidaemdia_jwt'));
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('agenda');
  const [userMenuOpen, setUserMenuOpen] = useState<boolean>(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Fecha menu do avatar com clique fora ou tecla Esc
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setUserMenuOpen(false);
      }
    }
    if (userMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [userMenuOpen]);

  // Se a aba ativa sumir ao trocar de conta, volta para "Agenda"
  useEffect(() => {
    if (user) {
      const visible = getVisibleTabs(user.role);
      if (!visible.includes(activeTab)) {
        setActiveTab('agenda');
      }
    }
  }, [user, activeTab]);

  // Navegação acessível por teclado na barra de abas (setas ← / →, Home e End)
  const handleTabKeyDown = (e: React.KeyboardEvent, currentTabId: TabId) => {
    const visibleTabIds = getVisibleTabs(user?.role);
    const currentIndex = visibleTabIds.indexOf(currentTabId);
    if (currentIndex === -1) return;

    let nextIndex = -1;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      nextIndex = (currentIndex + 1) % visibleTabIds.length;
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      nextIndex = (currentIndex - 1 + visibleTabIds.length) % visibleTabIds.length;
    } else if (e.key === 'Home') {
      e.preventDefault();
      nextIndex = 0;
    } else if (e.key === 'End') {
      e.preventDefault();
      nextIndex = visibleTabIds.length - 1;
    }

    if (nextIndex !== -1) {
      const nextTabId = visibleTabIds[nextIndex];
      setActiveTab(nextTabId);
      setTimeout(() => {
        document.getElementById(`tab-${nextTabId}`)?.focus();
      }, 0);
    }
  };

  // Telegram Integration State
  const [telegramLinked, setTelegramLinked] = useState<boolean>(false);
  const [telegramWaiting, setTelegramWaiting] = useState<boolean>(false);
  const pollingRef = useRef<number | null>(null);
  const pollingTimeoutRef = useRef<number | null>(null);

  const stopPolling = () => {
    if (pollingRef.current !== null) {
      window.clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    if (pollingTimeoutRef.current !== null) {
      window.clearTimeout(pollingTimeoutRef.current);
      pollingTimeoutRef.current = null;
    }
    setTelegramWaiting(false);
  };

  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, []);

  // Login State
  const [email, setEmail] = useState('dr.joao@vidaemdia.com.br');
  const [password, setPassword] = useState('123456');
  const [authError, setAuthError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Data State
  const [ownedCalendars, setOwnedCalendars] = useState<Calendar[]>([]);
  const [delegatedCalendars, setDelegatedCalendars] = useState<Calendar[]>([]);
  const [selectedCalendarId, setSelectedCalendarId] = useState<string>('');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loadingAppointments, setLoadingAppointments] = useState<boolean>(false);
  const [professionals, setProfessionals] = useState<ProfessionalDirectoryEntry[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);

  // Submitting State com chaves: saveAppt, cancelAppt:<id>, grant, worker, chat, telegram
  const [submitting, setSubmitting] = useState<Record<string, boolean>>({});
  const setSubmittingKey = (key: string, value: boolean) => {
    setSubmitting((prev) => ({ ...prev, [key]: value }));
  };

  // Diálogo de Confirmação Acessível
  const [confirmModal, setConfirmModal] = useState<ConfirmModalProps | null>(null);

  function openCancelDialog(appt: Appointment) {
    const { date, time } = formatApptDateTime(appt.startTime);
    const key = `cancelAppt:${appt.id}`;
    setConfirmModal({
      title: 'Cancelar compromisso',
      message: `Cancelar '${appt.title}' de ${date} às ${time}?`,
      confirmLabel: 'Cancelar compromisso',
      confirmLoadingLabel: 'Cancelando…',
      cancelLabel: 'Manter',
      confirmVariant: 'danger',
      loadingKey: key,
      onConfirm: async () => {
        await handleCancelAppointment(appt.id);
        setConfirmModal(null);
      },
    });
  }

  function openUnlinkTelegramDialog() {
    setConfirmModal({
      title: 'Desconectar Telegram',
      message: 'Deseja realmente desconectar o Telegram? Você deixará de receber notificações de compromissos.',
      confirmLabel: 'Desconectar',
      confirmLoadingLabel: 'Desconectando…',
      cancelLabel: 'Manter',
      confirmVariant: 'danger',
      loadingKey: 'telegram',
      onConfirm: async () => {
        await handleUnlinkTelegram();
        setConfirmModal(null);
      },
    });
  }

  function openLogoutDialog() {
    setConfirmModal({
      title: 'Sair do sistema',
      message: 'Deseja realmente sair da sua conta?',
      confirmLabel: 'Sair',
      cancelLabel: 'Cancelar',
      confirmVariant: 'danger',
      onConfirm: () => {
        handleLogout();
        setConfirmModal(null);
      },
    });
  }

  // Worker & Notification State
  const [workerStats, setWorkerStats] = useState<any>(null);
  const [remindersQueue, setRemindersQueue] = useState<Reminder[]>([]);
  const [dispatchedMessages, setDispatchedMessages] = useState<DispatchedMessageLog[]>([]);
  const [healthData, setHealthData] = useState<any>(null);

  // Form State (Fluxo Principal - Etapa 3)
  const [formTitle, setFormTitle] = useState('');
  const [formDate, setFormDate] = useState(() => todayStr);
  const [formTime, setFormTime] = useState('08:00');
  const [formDesc, setFormDesc] = useState('');
  const [formReminderMinutes, setFormReminderMinutes] = useState<number>(0);
  const [formChannel, setFormChannel] = useState<NotificationChannel>('TELEGRAM');
  const [dateError, setDateError] = useState<string | null>(null);
  const [feedbackBanner, setFeedbackBanner] = useState<{
    type: 'success' | 'error';
    title: string;
    detail?: string;
  } | null>(null);

  useEffect(() => {
    if (feedbackBanner?.type === 'success') {
      const timer = window.setTimeout(() => {
        setFeedbackBanner(null);
      }, 5000);
      return () => window.clearTimeout(timer);
    }
  }, [feedbackBanner]);

  // Grant RBAC Permission Form (Profissional -> Secretária)
  const [secretaryEmailToGrant, setSecretaryEmailToGrant] = useState('secretaria.maria@vidaemdia.com.br');

  // Chatbot Interactive State
  const [botInput, setBotInput] = useState('Marcar Consulta médica hoje às 08:00');
  const [chatHistory, setChatHistory] = useState<
    Array<{ sender: 'USER' | 'BOT'; text: string; time: string; channel: string }>
  >([
    {
      sender: 'BOT',
      text: '👋 Olá! Sou o assistente inteligente do <b>VidaEmDia</b>.\nEnvie <code>agenda</code> para ver seus compromissos ou escreva por exemplo:\n<b>"Marcar Reunião de Equipe amanhã às 14:30"</b> para agendar automaticamente!',
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      channel: 'TELEGRAM',
    },
  ]);

  useEffect(() => {
    if (token) {
      loadInitialData(token);
    }
  }, [token]);

  useEffect(() => {
    if (token && selectedCalendarId) {
      loadAppointments(selectedCalendarId);
    }
  }, [selectedCalendarId, token]);

  async function loadInitialData(jwt: string) {
    try {
      setLoading(true);
      const [me, calData, profs, audits, notifStatus, health] = await Promise.all([
        getMe(jwt),
        getCalendars(jwt),
        getProfessionals(jwt),
        getAuditLogs(jwt),
        getNotificationsStatus(jwt),
        getHealth(jwt),
      ]);

      setUser(me);
      setOwnedCalendars(calData.owned);
      setDelegatedCalendars(calData.delegated);
      setProfessionals(profs);
      setAuditLogs(audits);
      setWorkerStats(notifStatus.worker);
      setRemindersQueue(notifStatus.reminders);
      setDispatchedMessages(notifStatus.dispatchedMessages);
      setHealthData(health);

      let isTgLinked = Boolean((me as any).telegramLinked);
      try {
        const tgStatus = await getTelegramStatus(jwt);
        isTgLinked = tgStatus.linked;
      } catch {
        // Fallback para me.telegramLinked
      }
      setTelegramLinked(isTgLinked);
      if (isTgLinked) {
        stopPolling();
      }

      const firstCal = calData.owned[0]?.id || calData.delegated[0]?.id || '';
      if (firstCal && !selectedCalendarId) {
        setSelectedCalendarId(firstCal);
      }
    } catch (err: any) {
      if (err.status === 401) {
        handleLogout();
      }
    } finally {
      setLoading(false);
    }
  }

  async function loadAppointments(calendarId: string) {
    if (!token) return;
    setLoadingAppointments(true);
    try {
      const list = await getAppointments(token, calendarId);
      setAppointments(list);
    } catch (err: any) {
      const status = err.status || 500;
      setFeedbackBanner({
        type: 'error',
        title: getErrorMessageByStatus(err.status),
        detail: `${status} — ${err.message || 'Erro ao carregar compromissos desta agenda'}`,
      });
    } finally {
      setLoadingAppointments(false);
    }
  }

  async function handleLogin(e?: React.FormEvent, quickEmail?: string) {
    if (e) e.preventDefault();
    setAuthError(null);
    const loginEmail = quickEmail || email;
    try {
      setLoading(true);
      const res = await login(loginEmail, password);
      localStorage.setItem('vidaemdia_jwt', res.accessToken);
      setSelectedCalendarId('');
      setToken(res.accessToken);
      setUser(res.user);
      setActiveTab('agenda');
      setUserMenuOpen(false);
      setFeedbackBanner({
        type: 'success',
        title: `Bem-vindo, ${res.user.name}!`,
        detail: `Autenticado com sucesso via JWT como ${res.user.name} (${res.user.role})`,
      });
    } catch (err: any) {
      setAuthError(err.message || 'Falha na autenticação');
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    stopPolling();
    setTelegramLinked(false);
    setTelegramWaiting(false);
    localStorage.removeItem('vidaemdia_jwt');
    setToken(null);
    setUser(null);
    setSelectedCalendarId('');
    setAppointments([]);
    setActiveTab('agenda');
    setUserMenuOpen(false);
  }

  useEffect(() => {
    setUnauthorizedHandler(() => handleLogout());
    return () => setUnauthorizedHandler(null);
  }, []);

  async function handleConnectTelegram() {
    if (!token || submitting['telegram']) return;
    setFeedbackBanner(null);
    stopPolling();
    setSubmittingKey('telegram', true);

    try {
      const res = await createTelegramLink(token);
      window.open(res.url, '_blank', 'noopener');
      setTelegramWaiting(true);

      const startTime = Date.now();
      const maxDuration = 10 * 60 * 1000; // 10 minutos

      pollingRef.current = window.setInterval(async () => {
        try {
          const status = await getTelegramStatus(token);
          if (status.linked) {
            setTelegramLinked(true);
            stopPolling();
            setFeedbackBanner({
              type: 'success',
              title: 'Telegram conectado com sucesso!',
            });
            await loadInitialData(token);
          }
        } catch {
          // Ignora erros transitórios no polling
        }

        if (Date.now() - startTime >= maxDuration) {
          stopPolling();
        }
      }, 3000);

      pollingTimeoutRef.current = window.setTimeout(() => {
        stopPolling();
      }, maxDuration);
    } catch (err: any) {
      setFeedbackBanner({
        type: 'error',
        title: 'Não foi possível conectar o Telegram.',
        detail: `${err.status || 500} — ${err.message || 'Erro ao gerar link de conexão do Telegram'}`,
      });
    } finally {
      setSubmittingKey('telegram', false);
    }
  }

  async function handleUnlinkTelegram() {
    if (!token || submitting['telegram']) return;
    stopPolling();
    setFeedbackBanner(null);
    setSubmittingKey('telegram', true);

    try {
      await unlinkTelegram(token);
      setTelegramLinked(false);
      setTelegramWaiting(false);
      setFeedbackBanner({
        type: 'success',
        title: 'Telegram desconectado com sucesso!',
      });
      await loadInitialData(token);
    } catch (err: any) {
      setFeedbackBanner({
        type: 'error',
        title: 'Não foi possível desconectar o Telegram.',
        detail: `${err.status || 500} — ${err.message || 'Erro ao desconectar Telegram'}`,
      });
    } finally {
      setSubmittingKey('telegram', false);
    }
  }

  // Etapa 4 do Fluxo Principal: Submete formulário -> POST /compromissos (com JWT no header)
  async function handleCreateAppointment(e: React.FormEvent) {
    e.preventDefault();
    if (submitting['saveAppt']) return;
    if (!token || !selectedCalendarId) return;

    if (checkIsPast(formDate, formTime)) {
      setDateError('A data e horário do compromisso não podem estar no passado.');
      return;
    }

    setFeedbackBanner(null);
    setSubmittingKey('saveAppt', true);

    try {
      const startIso = new Date(`${formDate}T${formTime}:00`).toISOString();
      await createAppointment(
        token,
        {
          calendarId: selectedCalendarId,
          title: formTitle,
          description: formDesc || undefined,
          startTime: startIso,
          reminderMinutesBefore: Number(formReminderMinutes),
          reminderChannel: formChannel,
        },
      );

      setFormTitle('');
      setFormDesc('');
      setDateError(null);
      setFeedbackBanner({
        type: 'success',
        title: 'Compromisso salvo. Lembrete no Telegram 15 min antes.',
        detail: '201 Created — PostgreSQL',
      });

      await loadAppointments(selectedCalendarId);
      await loadInitialData(token);
    } catch (err: any) {
      const status = err.status;
      setFeedbackBanner({
        type: 'error',
        title: getErrorMessageByStatus(status),
        detail: `${status || 400} — ${err.message}`,
      });
      if (token) {
        const audits = await getAuditLogs(token);
        setAuditLogs(audits);
      }
    } finally {
      setSubmittingKey('saveAppt', false);
    }
  }

  async function handleCancelAppointment(id: string) {
    if (!token) return;
    const key = `cancelAppt:${id}`;
    if (submitting[key]) return;
    setFeedbackBanner(null);
    setSubmittingKey(key, true);

    try {
      await cancelAppointment(token, id);
      setFeedbackBanner({
        type: 'success',
        title: 'Compromisso cancelado com sucesso.',
        detail: '200 OK — log de auditoria gravado',
      });
      await loadAppointments(selectedCalendarId);
      await loadInitialData(token);
    } catch (err: any) {
      const status = err.status;
      setFeedbackBanner({
        type: 'error',
        title: getErrorMessageByStatus(status),
        detail: `${status || 403} — ${err.message}`,
      });
    } finally {
      setSubmittingKey(key, false);
    }
  }

  // Fluxo RBAC: Secretária seleciona agenda de um Profissional
  async function handleSelectProfessionalCalendar(calendarId: string, profName: string) {
    if (!token) return;
    setFeedbackBanner(null);
    try {
      await verifyCalendarAccess(token, calendarId);
      setSelectedCalendarId(calendarId);
      setActiveTab('agenda');
      setFeedbackBanner({
        type: 'success',
        title: `Acessando agenda de ${profName}.`,
        detail: 'Autorização RBAC validada',
      });
    } catch (err: any) {
      const status = err.status || 403;
      setFeedbackBanner({
        type: 'error',
        title: getErrorMessageByStatus(status),
        detail: `${status} — ${err.message || '403 Acesso negado: Secretária não tem autorização para esta agenda.'}`,
      });
      // Atualiza logs de auditoria para mostrar o bloqueio 403 gravado
      const audits = await getAuditLogs(token);
      setAuditLogs(audits);
    }
  }

  async function handleGrantSecretaryPermission(e: React.FormEvent) {
    e.preventDefault();
    if (submitting['grant']) return;
    if (!token || !selectedCalendarId) return;
    setSubmittingKey('grant', true);

    try {
      await grantPermission(
        token,
        selectedCalendarId,
        {
          secretaryEmail: secretaryEmailToGrant,
          canView: true,
          canCreate: true,
          canUpdate: true,
          canCancel: true,
        },
      );
      setFeedbackBanner({
        type: 'success',
        title: `Permissão concedida para ${secretaryEmailToGrant}!`,
        detail: '200 OK — Permissão RBAC concedida',
      });
      await loadInitialData(token);
    } catch (err: any) {
      const status = err.status;
      setFeedbackBanner({
        type: 'error',
        title: getErrorMessageByStatus(status),
        detail: `${status || 400} — ${err.message}`,
      });
    } finally {
      setSubmittingKey('grant', false);
    }
  }

  // Fluxo de Notificação: Executa Ciclo do Worker manualmente
  async function handleRunWorkerNow() {
    if (!token || submitting['worker']) return;
    setSubmittingKey('worker', true);
    try {
      const res = await runWorkerNow(token);
      setFeedbackBanner({
        type: 'success',
        title: 'Ciclo de notificações executado com sucesso.',
        detail: `Worker Executado: ${res.message}`,
      });
      await loadInitialData(token);
    } catch (err: any) {
      setFeedbackBanner({
        type: 'error',
        title: getErrorMessageByStatus(err.status),
        detail: `${err.status || 500} — ${err.message}`,
      });
    } finally {
      setSubmittingKey('worker', false);
    }
  }

  async function handleSimulateFailure() {
    if (!token) return;
    try {
      await simulateFailure(token, { failCount: 1 });
      setFeedbackBanner({
        type: 'error',
        title: 'Simulação de falha ativada! O próximo envio ao Telegram falhará.',
        detail: 'Fila de Retry: máx. 3 tentativas no PostgreSQL',
      });
    } catch (err: any) {
      setFeedbackBanner({
        type: 'error',
        title: getErrorMessageByStatus(err.status),
        detail: `${err.status || 500} — ${err.message}`,
      });
    }
  }

  // Chatbot Webhook (Telegram)
  async function handleSendBotMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!botInput.trim() || !user || !token || submitting['chat']) return;

    const msgText = botInput;
    const nowTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    setChatHistory((prev) => [
      ...prev,
      { sender: 'USER', text: msgText, time: nowTime, channel: 'TELEGRAM' },
    ]);
    setBotInput('');
    setSubmittingKey('chat', true);

    try {
      const res = await sendBotMessage(token, { text: msgText });

      setChatHistory((prev) => [
        ...prev,
        {
          sender: 'BOT',
          text: res.botReply,
          time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          channel: 'TELEGRAM',
        },
      ]);

      if (token) {
        await loadInitialData(token);
        if (selectedCalendarId) await loadAppointments(selectedCalendarId);
      }
    } catch (err: any) {
      setChatHistory((prev) => [
        ...prev,
        {
          sender: 'BOT',
          text: `❌ Erro ao processar comando: ${err.message}`,
          time: nowTime,
          channel: 'TELEGRAM',
        },
      ]);
    } finally {
      setSubmittingKey('chat', false);
    }
  }

  // ==========================================
  // TELA DE LOGIN (Fluxo Principal - Etapa 1 e 2)
  // ==========================================
  if (!token || !user) {
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

              <form onSubmit={(e) => handleLogin(e)} className="space-y-4">
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
                    onClick={() => handleLogin(undefined, 'carlos@vidaemdia.com.br')}
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
                    onClick={() => handleLogin(undefined, 'dr.joao@vidaemdia.com.br')}
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
                    onClick={() => handleLogin(undefined, 'secretaria.maria@vidaemdia.com.br')}
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

  const allAccessibleCalendars = [...ownedCalendars, ...delegatedCalendars];
  const activeCalendar = allAccessibleCalendars.find((c) => c.id === selectedCalendarId);
  const showSecretaryPanel = user?.role === 'SECRETARY' || user?.role === 'ADMIN';
  const showProfessionalPanel = user?.role === 'PROFESSIONAL' || user?.role === 'ADMIN';
  const isSinglePanel = (showSecretaryPanel && !showProfessionalPanel) || (!showSecretaryPanel && showProfessionalPanel);
  const pendingRemindersCount = remindersQueue.filter((r) => r.status === 'PENDING').length;
  const visibleTabIds = getVisibleTabs(user?.role);
  const visibleTabs = TAB_DEFINITIONS.filter((t) => visibleTabIds.includes(t.id));

  const userInitials = user.name
    ? user.name
        .split(' ')
        .map((part) => part[0])
        .filter(Boolean)
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'U';

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      {/* Top Navbar */}
      <header className="bg-stone-900 text-white border-b border-stone-800 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand-700 rounded-md">
              <CalendarIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg">VidaEmDia</span>
              </div>
              <p className="text-xs text-stone-400">
                Controle de Agenda Pessoal & Profissional · RBAC · Worker Telegram
              </p>
            </div>
          </div>

          {/* Menu do Avatar (agrupa Telegram, Informações do Usuário e Sair) */}
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
        </div>

        {/* Sub-barra de Navegação dos Fluxos / Abas */}
        <div className="relative bg-stone-800/90 border-t border-stone-800">
          {/* Gradiente nas bordas da barra indicando que há rolagem no mobile (<sm) */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-stone-900 to-transparent z-10 sm:hidden"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-stone-900 to-transparent z-10 sm:hidden"
          />

          <div
            role="tablist"
            aria-label="Navegação de abas"
            className="max-w-7xl mx-auto px-4 flex overflow-x-auto gap-1 py-1.5 scrollbar-none"
          >
            {visibleTabs.map((tab) => {
              const Icon = tab.icon;
              const isSelected = activeTab === tab.id;
              const badgeCount = tab.id === 'worker' ? pendingRemindersCount : undefined;

              return (
                <button
                  key={tab.id}
                  id={`tab-${tab.id}`}
                  role="tab"
                  aria-selected={isSelected}
                  aria-controls={`tabpanel-${tab.id}`}
                  tabIndex={isSelected ? 0 : -1}
                  onClick={() => setActiveTab(tab.id)}
                  onKeyDown={(e) => handleTabKeyDown(e, tab.id)}
                  className={`px-3.5 py-2 rounded-md text-xs font-semibold flex items-center gap-2 transition whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                    isSelected
                      ? 'bg-brand-50 text-brand-800 border-b-2 border-brand-700'
                      : 'text-stone-300 hover:bg-stone-700/60 hover:text-white border-b-2 border-transparent'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{tab.label}</span>
                  {Boolean(badgeCount && badgeCount > 0) && (
                    <span className="px-1.5 py-0.2 bg-brand-700 text-white rounded-full font-mono text-[11px] font-bold">
                      {badgeCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Banner de Feedback de Operações (201 Created, 400 Bad Request, 403 Forbidden RBAC) */}
      {feedbackBanner && (
        <div className="max-w-7xl mx-auto w-full px-4 pt-4">
          <div
            role={feedbackBanner.type === 'success' ? 'status' : 'alert'}
            className={`p-3.5 rounded-lg border flex items-start justify-between text-sm font-medium ${
              feedbackBanner.type === 'success'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                : 'bg-red-50 border-red-300 text-red-900'
            }`}
          >
            <div className="flex items-start gap-2.5">
              {feedbackBanner.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <ShieldAlert className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                <div>{feedbackBanner.title}</div>
                {feedbackBanner.detail && (
                  <div>
                    <TechTag>{feedbackBanner.detail}</TechTag>
                  </div>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setFeedbackBanner(null)}
              aria-label="Fechar aviso"
              className="text-stone-500 hover:text-stone-800 font-bold ml-4 p-1 leading-none"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Conteúdo Principal */}
      <main className="max-w-7xl mx-auto w-full px-4 py-6 flex-1">
        {/* =========================================================
            ABA 1: FLUXO PRINCIPAL — CADASTRO E VISUALIZAÇÃO DE AGENDA
           ========================================================= */}
        {activeTab === 'agenda' && (
          <div role="tabpanel" id="tabpanel-agenda" aria-labelledby="tab-agenda">
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Coluna Esquerda: Seletor de Agenda + Formulário de Novo Compromisso */}
              <div className="space-y-6">
                {/* Seleção da Agenda Ativa */}
                <div className="bg-white rounded-lg border border-stone-200 p-5">
                  <div className="pb-3 mb-4 border-b border-stone-100 flex items-center justify-between">
                    <h3 className="text-base font-semibold text-stone-900 flex items-center gap-2">
                      <CalendarIcon className="w-4 h-4 text-brand-700" />
                      Agendas Autorizadas (Pessoal / Profissional)
                      <TechTag>Fluxo Principal</TechTag>
                    </h3>
                  </div>

                <div className="space-y-2">
                  {allAccessibleCalendars.map((cal) => {
                    const isDelegated = cal.ownerId !== user.id;
                    const isSelected = cal.id === selectedCalendarId;
                    return (
                      <button
                        key={cal.id}
                        onClick={() => setSelectedCalendarId(cal.id)}
                        className={`w-full text-left p-3 rounded-md border transition flex items-center justify-between ${
                          isSelected
                            ? 'border-brand-700 bg-brand-50 ring-1 ring-brand-700'
                            : 'border-stone-200 hover:bg-stone-50'
                        }`}
                      >
                        <div>
                          <div className="text-sm font-semibold text-stone-900 flex items-center gap-1.5">
                            <span
                              className="w-2.5 h-2.5 rounded-full inline-block"
                              style={{ backgroundColor: cal.color }}
                            />
                            {cal.name}
                          </div>
                          <div className="text-xs text-stone-500 mt-0.5">
                            {isDelegated
                              ? `Delegada via RBAC (${cal.owner?.name})`
                              : `Tipo: ${cal.type === 'PROFESSIONAL' ? 'Profissional' : 'Pessoal'}`}
                          </div>
                        </div>
                        <span
                          className={`text-[11px] font-mono px-2 py-0.5 rounded-md font-semibold ${
                            isDelegated
                              ? 'bg-amber-100 text-amber-800'
                              : cal.type === 'PROFESSIONAL'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-stone-100 text-stone-800'
                          }`}
                        >
                          {isDelegated ? 'RBAC' : cal.type}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Formulário de Novo Compromisso (Etapa 3 e 4 do Fluxo Principal) */}
              <div className="bg-white rounded-lg border border-stone-200 p-5">
                <div className="pb-3 mb-4 border-b border-stone-100">
                  <h3 className="text-base font-semibold text-stone-900 flex items-center gap-2">
                    <Plus className="w-4 h-4 text-brand-700" />
                    Novo Compromisso
                  </h3>
                  <p className="text-xs text-stone-500 mt-1">
                    Preenche Título · Data · Horário · Descrição · Lembrete →{' '}
                    <TechTag>POST /compromissos</TechTag>
                  </p>
                </div>

                <form onSubmit={handleCreateAppointment} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Título do Compromisso *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex.: Consulta médica hoje às 08:00"
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      className="w-full px-3 py-2 text-base border border-stone-300 rounded-md focus:ring-2 focus:ring-brand-700 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-stone-700 mb-1">Data *</label>
                      <input
                        type="date"
                        required
                        min={todayStr}
                        value={formDate}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormDate(val);
                          if (val && formTime) {
                            if (checkIsPast(val, formTime)) {
                              setDateError('A data e horário do compromisso não podem estar no passado.');
                            } else {
                              setDateError(null);
                            }
                          }
                        }}
                        className={`w-full px-3 py-2 text-base border rounded-md focus:ring-2 focus:ring-brand-700 focus:outline-none ${
                          dateError ? 'border-red-500' : 'border-stone-300'
                        }`}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-stone-700 mb-1">Horário *</label>
                      <input
                        type="time"
                        required
                        value={formTime}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormTime(val);
                          if (formDate && val) {
                            if (checkIsPast(formDate, val)) {
                              setDateError('A data e horário do compromisso não podem estar no passado.');
                            } else {
                              setDateError(null);
                            }
                          }
                        }}
                        className={`w-full px-3 py-2 text-base border rounded-md focus:ring-2 focus:ring-brand-700 focus:outline-none ${
                          dateError ? 'border-red-500' : 'border-stone-300'
                        }`}
                      />
                    </div>
                  </div>

                  {dateError && (
                    <p className="text-xs text-red-600 flex items-center gap-1 font-medium mt-1">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      {dateError}
                    </p>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">Descrição</label>
                    <textarea
                      rows={2}
                      placeholder="Observações, link da reunião ou preparo de consulta..."
                      value={formDesc}
                      onChange={(e) => setFormDesc(e.target.value)}
                      className="w-full px-3 py-2 text-base border border-stone-300 rounded-md focus:ring-2 focus:ring-brand-700 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-stone-700 mb-1">
                        Canal do Lembrete
                      </label>
                      <select
                        value={formChannel}
                        onChange={(e) => setFormChannel(e.target.value as NotificationChannel)}
                        className="w-full px-3 py-2 text-base border border-stone-300 rounded-md bg-white focus:ring-2 focus:ring-brand-700 focus:outline-none"
                      >
                        <option value="TELEGRAM">Telegram</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-stone-700 mb-1">
                        Disparo do Lembrete
                      </label>
                      <select
                        value={formReminderMinutes}
                        onChange={(e) => setFormReminderMinutes(Number(e.target.value))}
                        className="w-full px-3 py-2 text-base border border-stone-300 rounded-md bg-white focus:ring-2 focus:ring-brand-700 focus:outline-none"
                      >
                        <option value={0}>Imediato (Próx. ciclo Worker)</option>
                        <option value={15}>15 min antes</option>
                        <option value={30}>30 min antes</option>
                        <option value={60}>1 hora antes</option>
                      </select>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting['saveAppt']}
                    className="w-full py-2.5 px-4 bg-brand-700 hover:bg-brand-800 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium text-sm rounded-md transition flex items-center justify-center gap-2"
                  >
                    {submitting['saveAppt'] ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Salvando…
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        Salvar Compromisso na Agenda
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>

            {/* Coluna Direita (2 cols): Calendário / Lista de Compromissos */}
            <div className="lg:col-span-2 bg-white rounded-lg border border-stone-200 p-6">
              <div className="flex flex-wrap items-center justify-between gap-4 pb-4 mb-5 border-b border-stone-100">
                <div>
                  <h2 className="text-base font-semibold text-stone-900 flex items-center gap-2">
                    {activeCalendar ? activeCalendar.name : 'Selecione uma Agenda'}
                    {activeCalendar && activeCalendar.ownerId !== user.id && (
                      <span className="text-xs px-2.5 py-0.5 bg-amber-100 text-amber-900 rounded-full font-semibold">
                        Modo Secretária (RBAC Autorizado)
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-stone-500 mt-0.5">
                    {activeCalendar?.description || 'Compromissos sincronizados com o PostgreSQL'}
                  </p>
                </div>

                <button
                  onClick={() => selectedCalendarId && loadAppointments(selectedCalendarId)}
                  className="px-3 py-1.5 rounded-md border border-stone-300 hover:bg-stone-50 text-xs font-medium flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Atualizar Agenda
                </button>
              </div>

              {loadingAppointments ? (
                <div className="space-y-3">
                  <div className="h-20 bg-stone-100 animate-pulse rounded" />
                  <div className="h-20 bg-stone-100 animate-pulse rounded" />
                  <div className="h-20 bg-stone-100 animate-pulse rounded" />
                </div>
              ) : appointments.length === 0 ? (
                <div className="text-center py-12 px-4 bg-stone-50 rounded-md border border-dashed border-stone-200">
                  <CalendarIcon className="w-8 h-8 text-stone-400 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-stone-700">Nenhum compromisso cadastrado nesta agenda</p>
                  <p className="text-xs text-stone-500 mt-1">
                    Utilize o formulário ao lado para agendar um novo compromisso nesta agenda.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {appointments.map((appt) => {
                    const start = new Date(appt.startTime);
                    const reminder = appt.reminders?.[0];
                    return (
                      <div
                        key={appt.id}
                        className={`p-4 rounded-md border transition flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                          appt.status === 'CANCELLED'
                            ? 'bg-stone-50 border-stone-200 opacity-60'
                            : 'bg-white border-stone-200 hover:border-brand-700'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`font-semibold text-sm ${
                                appt.status === 'CANCELLED' ? 'line-through text-stone-500' : 'text-stone-900'
                              }`}
                            >
                              {appt.title}
                            </span>

                            <span
                              className={`text-[11px] font-mono px-2 py-0.5 rounded-full font-semibold ${
                                appt.status === 'SCHEDULED'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {appt.status === 'SCHEDULED' ? 'AGENDADO' : 'CANCELADO'}
                            </span>

                            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-stone-100 text-stone-700">
                              Origem: {appt.createdVia === 'WHATSAPP' ? 'TELEGRAM' : appt.createdVia}
                            </span>
                          </div>

                          {appt.description && (
                            <p className="text-xs text-stone-600">{appt.description}</p>
                          )}

                          <div className="flex flex-wrap items-center gap-4 text-xs text-stone-500 pt-1">
                            <span className="flex items-center gap-1 font-medium text-stone-700">
                              <Clock className="w-3.5 h-3.5 text-brand-700" />
                              {start.toLocaleDateString('pt-BR')} às{' '}
                              {start.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>

                            <span>Criado por: {appt.createdBy?.name || 'Usuário'}</span>

                            {reminder && (
                              <span
                                className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-semibold ${
                                  reminder.status === 'SENT'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : reminder.status === 'FAILED'
                                    ? 'bg-red-50 text-red-700 border border-red-200'
                                    : 'bg-amber-50 text-amber-800 border border-amber-200'
                                }`}
                              >
                                <Bell className="w-3 h-3" />
                                Lembrete Telegram:{' '}
                                {reminder.status === 'SENT'
                                  ? 'ENVIADO ✅'
                                  : reminder.status === 'FAILED'
                                  ? `FALHOU (${reminder.retryCount}/3) ❌`
                                  : `PENDENTE (Tentativas: ${reminder.retryCount}/3)`}
                              </span>
                            )}
                          </div>
                        </div>

                        {appt.status === 'SCHEDULED' && (
                          <button
                            onClick={() => openCancelDialog(appt)}
                            disabled={submitting[`cancelAppt:${appt.id}`]}
                            className="self-start sm:self-center px-3 py-1.5 rounded-md border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-60 disabled:cursor-not-allowed text-xs font-medium flex items-center gap-1.5 shrink-0"
                          >
                            {submitting[`cancelAppt:${appt.id}`] ? (
                              <>
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                Cancelando…
                              </>
                            ) : (
                              <>
                                <Trash2 className="w-3.5 h-3.5" />
                                Cancelar
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

        {/* =========================================================
            ABA 2: FLUXO RBAC — SECRETÁRIA ACESSANDO AGENDA DE PROFISSIONAL
           ========================================================= */}
        {activeTab === 'rbac' && (
          <div role="tabpanel" id="tabpanel-rbac" aria-labelledby="tab-rbac">
            <div className={isSinglePanel ? 'max-w-3xl mx-auto space-y-6' : 'grid lg:grid-cols-2 gap-6'}>
              {/* Painel da Secretária: Selecionar Profissional ("Agendas que gerencio") */}
              {showSecretaryPanel && (
                <div className="bg-white rounded-lg border border-stone-200 p-6">
                  <div className="flex items-center gap-2.5 pb-4 mb-4 border-b border-stone-100">
                    <div className="p-2 bg-amber-100 text-amber-800 rounded-md">
                      <UserCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-base font-semibold text-stone-900 flex items-center gap-2">
                        Agendas que gerencio
                        <TechTag>Fluxo RBAC</TechTag>
                      </h2>
                      <p className="text-xs text-stone-500">
                        Selecione o profissional cuja agenda deseja gerenciar (testa autorização 200 OK vs. 403 Acesso Negado)
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-4">
                    {professionals.map((prof) => (
                      <div
                        key={prof.id}
                        className="p-4 rounded-md border border-stone-200 bg-stone-50/50 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-sm font-bold text-stone-900">{prof.name}</h3>
                            <p className="text-xs text-stone-500">{prof.email}</p>
                          </div>
                        </div>

                        <div className="space-y-2">
                          {prof.calendars.map((cal) => (
                            <div
                              key={cal.id}
                              className="p-3 bg-white rounded-md border border-stone-200 flex flex-wrap items-center justify-between gap-3"
                            >
                              <div>
                                <div className="text-xs font-bold text-stone-800">{cal.name}</div>
                                <div className="text-xs text-stone-500">{cal.description}</div>
                                <div className="mt-1">
                                  {cal.hasRbacAuthorization || prof.id === user.id ? (
                                    <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-semibold">
                                      <ShieldCheck className="w-3.5 h-3.5" />
                                      Possui autorização RBAC ativa
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-xs text-red-600 font-semibold">
                                      <ShieldAlert className="w-3.5 h-3.5" />
                                      Sem delegação RBAC (Retornará 403 Forbidden)
                                    </span>
                                  )}
                                </div>
                              </div>

                              <button
                                onClick={() => handleSelectProfessionalCalendar(cal.id, prof.name)}
                                className={`px-3.5 py-2 rounded-md text-xs font-semibold transition ${
                                  cal.hasRbacAuthorization || prof.id === user.id
                                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                    : 'bg-white hover:bg-red-50 text-red-600 border border-red-500'
                                }`}
                              >
                                {cal.hasRbacAuthorization || prof.id === user.id
                                  ? 'Acessar Agenda (Autorizado)'
                                  : 'Tentar Acesso (Testar 403)'}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Painel do Profissional: Delegar Acesso RBAC a uma Secretária */}
              {showProfessionalPanel && (
                <div className="bg-white rounded-lg border border-stone-200 p-6">
                  <div className="pb-4 mb-5 border-b border-stone-100">
                    <h2 className="text-base font-semibold text-stone-900 flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-brand-700" />
                      Delegação de Acessos
                      <TechTag>Fluxo RBAC</TechTag>
                    </h2>
                    <p className="text-xs text-stone-500 mt-1">
                      Como Profissional (ex.: Dr. João), autorize ou revogue o acesso de uma Secretária à sua agenda selecionada.
                    </p>
                  </div>

                  <form onSubmit={handleGrantSecretaryPermission} className="space-y-4 mb-6">
                    <div>
                      <label className="block text-xs font-medium text-stone-700 mb-1">
                        Agenda Selecionada
                      </label>
                      <select
                        value={selectedCalendarId}
                        onChange={(e) => setSelectedCalendarId(e.target.value)}
                        className="w-full px-3 py-2 text-base border border-stone-300 rounded-md bg-white focus:ring-2 focus:ring-brand-700 focus:outline-none"
                      >
                        {ownedCalendars.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.type})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-stone-700 mb-1">
                        E-mail da Secretária
                      </label>
                      <input
                        type="email"
                        required
                        value={secretaryEmailToGrant}
                        onChange={(e) => setSecretaryEmailToGrant(e.target.value)}
                        className="w-full px-3 py-2 text-base border border-stone-300 rounded-md focus:ring-2 focus:ring-brand-700 focus:outline-none"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={ownedCalendars.length === 0 || submitting['grant']}
                      className="w-full py-2.5 px-4 bg-brand-700 hover:bg-brand-800 disabled:bg-stone-300 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium text-sm rounded-md transition flex items-center justify-center gap-2"
                    >
                      {submitting['grant'] ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Concedendo…
                        </>
                      ) : (
                        'Conceder Permissão RBAC (Visualizar, Criar, Alterar, Cancelar)'
                      )}
                    </button>
                  </form>

                  <div className="border-t border-stone-100 pt-4">
                    <h3 className="text-xs font-bold text-stone-700 uppercase tracking-wider mb-3">
                      Secretárias Autorizadas nas Suas Agendas
                    </h3>
                    {ownedCalendars.flatMap((c) =>
                      (c.permissions || []).map((p) => ({ calendar: c, perm: p })),
                    ).length === 0 ? (
                      <p className="text-xs text-stone-400">
                        Nenhuma secretária delegada nas suas agendas próprias.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {ownedCalendars.map((cal) =>
                          (cal.permissions || []).map((perm) => (
                            <div
                              key={perm.id}
                              className="p-3 rounded-md bg-stone-50 border border-stone-200 flex items-center justify-between text-xs"
                            >
                              <div>
                                <div className="font-bold text-stone-900">
                                  {perm.granteeUser?.name} ({perm.granteeUser?.email})
                                </div>
                                <div className="text-xs text-stone-500">
                                  Agenda: <span className="font-semibold">{cal.name}</span> · Permissões:
                                  VIEW, CREATE, UPDATE, CANCEL
                                </div>
                              </div>
                            </div>
                          )),
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* =========================================================
            ABA 3: FLUXO DE NOTIFICAÇÃO — WORKER + TELEGRAM
           ========================================================= */}
        {activeTab === 'worker' && (
          <div role="tabpanel" id="tabpanel-worker" aria-labelledby="tab-worker">
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Controle do Worker + Fila no PostgreSQL */}
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-white rounded-lg border border-stone-200 p-6">
                  <div className="flex flex-wrap items-center justify-between gap-4 pb-4 mb-4 border-b border-stone-100">
                    <div>
                      <h2 className="text-base font-semibold text-stone-900 flex items-center gap-2">
                        <Bell className="w-5 h-5 text-emerald-600" />
                        Agendador de Notificações
                        <TechTag>Worker Telegram</TechTag>
                      </h2>
                      <p className="text-xs text-stone-500 mt-0.5">
                        Consulta o PostgreSQL periodicamente, envia lembretes para Telegram e executa Retry de até 3 tentativas.
                      </p>
                    </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSimulateFailure}
                      className="px-3 py-2 rounded-md border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-semibold transition"
                    >
                      Simular Erro na API (Testar Retry 3x)
                    </button>

                    <button
                      onClick={handleRunWorkerNow}
                      disabled={submitting['worker']}
                      className="px-4 py-2 rounded-md bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-xs font-semibold shadow flex items-center gap-1.5 transition"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${submitting['worker'] ? 'animate-spin' : ''}`} />
                      {submitting['worker'] ? 'Executando…' : 'Executar Ciclo do Worker Agora'}
                    </button>
                  </div>
                </div>

                {workerStats && (
                  <div className="grid grid-cols-3 gap-3 p-3.5 bg-stone-50 rounded-md border border-stone-200 text-xs">
                    <div>
                      <span className="text-stone-500 block">Ciclos Executados</span>
                      <span className="font-bold text-stone-900 text-sm tabular-nums">{workerStats.totalCycles}</span>
                    </div>
                    <div>
                      <span className="text-stone-500 block">Política de Retry</span>
                      <span className="font-bold text-stone-900 text-sm">
                        Máx. {workerStats.maxRetries} tentativas
                      </span>
                    </div>
                    <div>
                      <span className="text-stone-500 block">Última Verificação</span>
                      <span className="font-bold text-stone-900 text-sm tabular-nums">
                        {workerStats.lastRunAt
                          ? new Date(workerStats.lastRunAt).toLocaleTimeString('pt-BR')
                          : 'Aguardando ciclo'}
                      </span>
                    </div>
                  </div>
                )}

                <h3 className="text-xs font-bold text-stone-700 uppercase tracking-wider mt-6 mb-3 flex items-center gap-1.5">
                  Fila de Lembretes no PostgreSQL (Tabela <TechTag>reminders</TechTag>)
                </h3>

                <div className="space-y-2.5">
                  {remindersQueue.length === 0 ? (
                    <div className="text-center py-10 px-4 bg-stone-50 rounded-md border border-dashed border-stone-200">
                      <Bell className="w-8 h-8 text-stone-400 mx-auto mb-2" />
                      <p className="text-sm font-semibold text-stone-700">Fila de lembretes vazia</p>
                      <p className="text-xs text-stone-500 mt-1 max-w-md mx-auto">
                        Nenhum lembrete aguardando disparo. Crie um novo compromisso com lembrete na aba Agenda para enfileirar mensagens no PostgreSQL.
                      </p>
                    </div>
                  ) : (
                    remindersQueue.map((rem) => (
                      <div
                        key={rem.id}
                        className="p-3.5 rounded-md border border-stone-200 flex flex-wrap items-center justify-between gap-3 text-xs"
                      >
                        <div>
                          <div className="font-bold text-stone-900">
                            {rem.appointment?.title || 'Compromisso'}
                          </div>
                          <div className="text-stone-500 text-xs">
                            Agenda: {rem.appointment?.calendar?.name} · Canal: <b>{rem.channel === 'WHATSAPP' || rem.channel === 'BOTH' ? 'TELEGRAM' : rem.channel}</b> ·
                            Tentativas: <b>{rem.retryCount}/3</b>
                          </div>
                          {rem.lastError && (
                            <div className="text-red-600 text-xs mt-1 font-medium">
                              ⚠️ Último erro: {rem.lastError}
                            </div>
                          )}
                        </div>

                        <span
                          className={`px-2.5 py-1 rounded-full text-[11px] font-mono font-bold ${
                            rem.status === 'SENT'
                              ? 'bg-emerald-100 text-emerald-800'
                              : rem.status === 'FAILED'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {rem.status === 'SENT'
                            ? 'ENVIADO NO POSTGRESQL'
                            : rem.status === 'FAILED'
                            ? 'FALHOU (MÁX 3 TENTATIVAS)'
                            : 'PENDENTE NA JANELA'}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Simulador de Celular Telegram recebendo os Lembretes */}
            <div className="bg-stone-900 rounded-lg p-5 text-white border border-stone-800 flex flex-col">
              <div className="flex items-center gap-2.5 pb-3 mb-4 border-b border-stone-800">
                <Smartphone className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="text-sm font-semibold">Celular do Usuário (Telegram)</h3>
                  <p className="text-xs text-stone-400">
                    Notificações entregues pelo Telegram Bot
                  </p>
                </div>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto max-h-[460px] pr-1">
                {dispatchedMessages.length === 0 ? (
                  <div className="text-center py-12 text-stone-500 text-xs">
                    Nenhuma mensagem disparada ainda. Clique em{' '}
                    <b className="text-emerald-400">"Executar Ciclo do Worker Agora"</b> ao lado para enviar os lembretes pendentes!
                  </div>
                ) : (
                  dispatchedMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`p-3.5 rounded-md border text-xs ${
                        msg.success
                          ? 'bg-emerald-950/70 border-emerald-700/60 text-emerald-100'
                          : 'bg-red-950/70 border-red-700/60 text-red-200'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs opacity-75 mb-1.5">
                        <span className="font-bold">
                          ✈️ Telegram → {msg.recipientName} ({msg.recipient})
                        </span>
                        <span className="font-mono text-[11px] tabular-nums">
                          {new Date(msg.timestamp).toLocaleTimeString('pt-BR', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </span>
                      </div>
                      <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed">
                        {msg.message}
                      </pre>
                      {!msg.success && (
                        <div className="mt-2 pt-1.5 border-t border-red-800 text-xs text-red-300 font-semibold">
                          ❌ Falha simulada: {msg.error} (Agendado Retry)
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

        {/* =========================================================
            ABA 4: CHATBOT TELEGRAM (VISÃO 100% CONVERSACIONAL)
           ========================================================= */}
        {activeTab === 'chatbot' && (
          <div role="tabpanel" id="tabpanel-chatbot" aria-labelledby="tab-chatbot">
            <div className="max-w-3xl mx-auto bg-white rounded-lg border border-stone-200 overflow-hidden">
              <div className="bg-brand-700 text-white p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <MessageSquare className="w-6 h-6" />
                  <div>
                    <h2 className="text-sm font-semibold flex items-center gap-2">
                      Assistente VidaEmDia
                      <TechTag>Chatbot Telegram (Webhook)</TechTag>
                    </h2>
                    <p className="text-xs text-brand-50">
                      Envie uma mensagem para criar ou consultar eventos na sua agenda automaticamente
                    </p>
                  </div>
                </div>
              </div>

            {/* Histórico de Mensagens */}
            <div className="p-5 bg-stone-100 h-96 overflow-y-auto space-y-3">
              {chatHistory.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-stone-400">
                  <MessageSquare className="w-8 h-8 text-stone-400 mb-2" />
                  <p className="text-sm font-semibold text-stone-700">Histórico do chat vazio</p>
                  <p className="text-xs text-stone-500 mt-1 max-w-sm">
                    Nenhuma mensagem trocada ainda. Envie uma mensagem pelo campo abaixo ou use um dos exemplos rápidos para interagir com o bot.
                  </p>
                </div>
              ) : (
                chatHistory.map((item, idx) => (
                  <div
                    key={idx}
                    className={`flex ${item.sender === 'USER' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-md p-3.5 rounded-lg text-xs ${
                        item.sender === 'USER'
                          ? 'bg-brand-700 text-white rounded-br-none'
                          : 'bg-white text-stone-800 border border-stone-200 rounded-bl-none'
                      }`}
                    >
                      {item.sender === 'USER' ? (
                        <pre className="whitespace-pre-wrap font-sans leading-relaxed text-xs">{item.text}</pre>
                      ) : (
                        <div
                          className="whitespace-pre-wrap font-sans leading-relaxed text-xs"
                          dangerouslySetInnerHTML={{ __html: sanitizeTelegramHtml(item.text) }}
                        />
                      )}
                      <div
                        className={`text-xs mt-1 text-right font-mono text-[11px] tabular-nums ${
                          item.sender === 'USER' ? 'text-brand-50/80' : 'text-stone-400'
                        }`}
                      >
                        {item.time}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Sugestões Rápidas */}
            <div className="px-4 py-2 bg-stone-50 border-t border-stone-200 flex flex-wrap gap-2 items-center">
              <span className="text-xs text-stone-500 font-semibold">Exemplos rápidos:</span>
              <button
                type="button"
                onClick={() => setBotInput('agenda')}
                className="text-xs px-2.5 py-1 bg-white border border-stone-300 rounded-md hover:bg-stone-100"
              >
                "agenda"
              </button>
              <button
                type="button"
                onClick={() => setBotInput('Marcar Consulta médica hoje às 08:00')}
                className="text-xs px-2.5 py-1 bg-white border border-stone-300 rounded-md hover:bg-stone-100"
              >
                "Marcar Consulta médica hoje às 08:00"
              </button>
              <button
                type="button"
                onClick={() => setBotInput('Agendar Reunião de Alinhamento amanhã às 15:00')}
                className="text-xs px-2.5 py-1 bg-white border border-stone-300 rounded-md hover:bg-stone-100"
              >
                "Agendar Reunião de Alinhamento amanhã às 15:00"
              </button>
            </div>

            {/* Input do Chat */}
            <form
              onSubmit={handleSendBotMessage}
              className="p-4 bg-white border-t border-stone-200 flex gap-2"
            >
              <input
                type="text"
                value={botInput}
                onChange={(e) => setBotInput(e.target.value)}
                placeholder="Digite uma mensagem para o bot (ex.: Marcar Dentista amanhã às 10:00)..."
                className="flex-1 px-4 py-2.5 text-base border border-stone-300 rounded-md focus:ring-2 focus:ring-brand-700 focus:outline-none"
              />
              <button
                type="submit"
                disabled={submitting['chat']}
                className="px-5 py-2.5 bg-brand-700 hover:bg-brand-800 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium rounded-md flex items-center gap-1.5 transition"
              >
                {submitting['chat'] ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Enviando…
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Enviar
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

        {/* =========================================================
            ABA 5: AUDITORIA, SEGURANÇA & MONITORAMENTO DEVOPS
           ========================================================= */}
        {activeTab === 'auditoria' && (
          <div role="tabpanel" id="tabpanel-auditoria" aria-labelledby="tab-auditoria">
            <div className="space-y-6">
              {/* Cards de Monitoramento / Healthcheck */}
              {healthData && (
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white p-4 rounded-lg border border-stone-200">
                    <div className="flex items-center justify-between text-xs text-stone-500 mb-1">
                      <span>Status Backend & PostgreSQL</span>
                      <Activity className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div className="text-lg font-bold text-emerald-600">{healthData.status}</div>
                    <div className="text-xs font-mono text-[11px] text-stone-400 mt-1">
                      DB: {healthData.services?.postgresql} · Worker: {healthData.services?.notificationWorker}
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-lg border border-stone-200">
                    <div className="flex items-center justify-between text-xs text-stone-500 mb-1">
                      <span>Compromissos no Banco</span>
                      <Database className="w-4 h-4 text-brand-700" />
                    </div>
                    <div className="text-lg font-bold text-stone-900 tabular-nums">
                      {healthData.databaseStats?.appointmentsCount ?? 0}
                    </div>
                    <div className="text-xs text-stone-400 mt-1">
                      Agendas ativas: {healthData.databaseStats?.calendarsCount ?? 0}
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-lg border border-stone-200">
                    <div className="flex items-center justify-between text-xs text-stone-500 mb-1">
                      <span>Bloqueios 403 RBAC</span>
                      <ShieldAlert className="w-4 h-4 text-amber-600" />
                    </div>
                    <div className="text-lg font-bold text-amber-600 tabular-nums">
                      {healthData.metrics?.rbacAccessDenied ?? 0}
                    </div>
                    <div className="text-xs text-stone-400 mt-1">
                      Tentativas não autorizadas barradas
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-lg border border-stone-200">
                    <div className="flex items-center justify-between text-xs text-stone-500 mb-1">
                      <span>Logs de Auditoria Gravados</span>
                      <FileText className="w-4 h-4 text-brand-700" />
                    </div>
                    <div className="text-lg font-bold text-stone-900 tabular-nums">
                      {healthData.databaseStats?.auditLogsCount ?? auditLogs.length}
                    </div>
                    <div className="text-xs text-stone-400 mt-1">
                      Rastreabilidade completa (Quem / Quando)
                    </div>
                  </div>
                </div>
              )}

              {/* Tabela de Logs de Auditoria */}
              <div className="bg-white rounded-lg border border-stone-200 p-6">
                <div className="flex items-center justify-between pb-4 mb-4 border-b border-stone-100">
                  <div>
                    <h2 className="text-base font-semibold text-stone-900 flex items-center gap-2">
                      Logs de Auditoria
                      <TechTag>Auditoria, Segurança & DevOps</TechTag>
                      <TechTag>audit_logs</TechTag>
                    </h2>
                    <p className="text-xs text-stone-500 mt-0.5">
                      Registro imutável de criações, alterações, cancelamentos, logins e bloqueios RBAC (403)
                    </p>
                  </div>
                <a
                  href="http://localhost:3000/metrics"
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 rounded-md bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-mono"
                >
                  Abrir /metrics (Prometheus) ↗
                </a>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-stone-200 text-stone-500 uppercase text-xs font-medium">
                      <th className="py-2.5 px-3">Data / Hora</th>
                      <th className="py-2.5 px-3">Ator (Quem)</th>
                      <th className="py-2.5 px-3">Ação</th>
                      <th className="py-2.5 px-3">Agenda Alvo</th>
                      <th className="py-2.5 px-3">Detalhes da Operação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200">
                    {auditLogs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-12 px-4 text-center">
                          <FileText className="w-8 h-8 text-stone-400 mx-auto mb-2" />
                          <p className="text-sm font-semibold text-stone-700">Nenhum registro de auditoria encontrado</p>
                          <p className="text-xs text-stone-500 mt-1 max-w-md mx-auto">
                            Operações como criar ou cancelar compromissos, conceder permissões e bloqueios RBAC (403) serão registradas automaticamente nesta tabela.
                          </p>
                        </td>
                      </tr>
                    ) : (
                      auditLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-stone-50">
                          <td className="py-2.5 px-3 whitespace-nowrap font-mono text-[11px] text-stone-500 tabular-nums">
                            {new Date(log.createdAt).toLocaleString('pt-BR')}
                          </td>
                          <td className="py-2.5 px-3 font-medium text-stone-900">
                            {log.actorUser?.name || 'Sistema'}{' '}
                            {log.actorUser?.role && (
                              <span className="text-[11px] px-1.5 py-0.5 bg-stone-100 rounded-md font-mono">
                                {log.actorUser.role}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-md font-bold text-[11px] font-mono ${
                                log.action === 'ACCESS_DENIED'
                                  ? 'bg-red-100 text-red-800'
                                  : log.action === 'CREATE'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : log.action === 'CANCEL'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-brand-50 text-brand-800'
                              }`}
                            >
                              {log.action}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-stone-600">
                            {log.targetCalendar?.name || '—'}
                          </td>
                          <td className="py-2.5 px-3 text-stone-700">{log.details}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
      </main>

      {/* Barra de Segurança Rodapé fiel ao Diagrama VidaEmDia_Fluxo.drawio.html */}
      <footer className="bg-stone-900 text-stone-400 text-xs py-3 px-4 border-t border-stone-800 text-center">
        <strong className="text-stone-200">SEGURANÇA VIDAEMDIA</strong> — HTTPS em todas as
        comunicações · JWT para autenticação · RBAC para controle de acesso · Credenciais em
        variáveis de ambiente · Logs de auditoria · Backup periódico do PostgreSQL
      </footer>

      {/* Diálogo de Confirmação Acessível */}
      <ConfirmDialog
        isOpen={Boolean(confirmModal)}
        title={confirmModal?.title || ''}
        message={confirmModal?.message || ''}
        confirmLabel={confirmModal?.confirmLabel || 'Confirmar'}
        confirmLoadingLabel={confirmModal?.confirmLoadingLabel}
        cancelLabel={confirmModal?.cancelLabel || 'Cancelar'}
        confirmVariant={confirmModal?.confirmVariant || 'danger'}
        isLoading={confirmModal?.loadingKey ? Boolean(submitting[confirmModal.loadingKey]) : false}
        onConfirm={async () => {
          if (confirmModal?.onConfirm) {
            await confirmModal.onConfirm();
          }
        }}
        onCancel={() => setConfirmModal(null)}
      />
    </div>
  );
}
