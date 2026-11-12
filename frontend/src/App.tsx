import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Calendar as CalendarIcon } from 'lucide-react';
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
  ChatMessage,
  DispatchedMessageLog,
  ProfessionalDirectoryEntry,
  Reminder,
  User,
} from './types';
import {
  checkIsPast,
  formatApptDateTime,
  getErrorMessageByStatus,
} from './lib/format';
import {
  getVisibleTabs,
  LOGIN_PATH,
  TAB_DEFINITIONS,
  TAB_PATHS,
  tabFromPath,
  TabId,
} from './lib/tabs';
import { useUserMenu } from './hooks/useUserMenu';
import { useAppointmentForm } from './hooks/useAppointmentForm';
import { useTelegramLink } from './hooks/useTelegramLink';
import { ConfirmDialog, ConfirmModalProps } from './components/ConfirmDialog';
import { FeedbackBanner } from './components/FeedbackBanner';
import { UserMenu } from './components/UserMenu';
import { SessionLoading } from './components/SessionLoading';
import { SessionLoadError } from './components/SessionLoadError';
import { LoginPage } from './pages/LoginPage';
import { AgendaPage } from './pages/AgendaPage';
import { AcessosPage } from './pages/AcessosPage';
import { LembretesPage } from './pages/LembretesPage';
import { AssistentePage } from './pages/AssistentePage';
import { AuditoriaPage } from './pages/AuditoriaPage';

export function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const activeTab: TabId = tabFromPath(location.pathname) ?? 'agenda';
  const setActiveTab = (tab: TabId) => navigate(TAB_PATHS[tab]);

  const [token, setToken] = useState<string | null>(() => localStorage.getItem('vidaemdia_jwt'));
  const [user, setUser] = useState<User | null>(null);
  const { userMenuOpen, setUserMenuOpen, userMenuRef } = useUserMenu();

  // Redirecionamento baseado na sessão e na URL
  useEffect(() => {
    const path = location.pathname;
    if (!token) {
      if (path !== LOGIN_PATH) navigate(LOGIN_PATH, { replace: true });
      return;
    }
    if (!user) return; // sessão ainda sendo validada: não mexe na URL (recarregar mantém a tela)
    if (path === LOGIN_PATH || tabFromPath(path) === null) {
      navigate(TAB_PATHS.agenda, { replace: true });
    }
  }, [token, user, location.pathname, navigate]);

  // Se a aba ativa sumir ao trocar de conta, volta para "Agenda"
  useEffect(() => {
    if (user) {
      const visible = getVisibleTabs(user.role);
      if (!visible.includes(activeTab)) {
        navigate(TAB_PATHS.agenda, { replace: true });
      }
    }
  }, [user, activeTab, navigate]);

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
  const {
    telegramLinked,
    setTelegramLinked,
    telegramWaiting,
    setTelegramWaiting,
    pollingRef,
    pollingTimeoutRef,
    stopPolling,
  } = useTelegramLink();

  // Login State
  const [email, setEmail] = useState('dr.joao@vidaemdia.com.br');
  const [password, setPassword] = useState('123456');
  const [authError, setAuthError] = useState<string | null>(null);
  const [initialLoadError, setInitialLoadError] = useState<string | null>(null);
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
  const {
    formTitle,
    setFormTitle,
    formDate,
    setFormDate,
    formTime,
    setFormTime,
    formDesc,
    setFormDesc,
    formReminderMinutes,
    setFormReminderMinutes,
    formChannel,
    setFormChannel,
    dateError,
    setDateError,
  } = useAppointmentForm();
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
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
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
      setInitialLoadError(null);
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
      } else {
        const message = getErrorMessageByStatus(err?.status);
        if (!user) {
          setInitialLoadError(message);
        } else {
          setFeedbackBanner({ type: 'error', title: 'Não foi possível atualizar os dados.', detail: message });
        }
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
    setInitialLoadError(null);
    setSelectedCalendarId('');
    setAppointments([]);
    navigate(LOGIN_PATH, { replace: true });
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
  if (!token) {
    return (
      <LoginPage
        email={email}
        setEmail={setEmail}
        password={password}
        setPassword={setPassword}
        authError={authError}
        loading={loading}
        onLogin={handleLogin}
      />
    );
  }
  if (!user) {
    if (initialLoadError) {
      return (
        <SessionLoadError
          message={initialLoadError}
          retrying={loading}
          onRetry={() => loadInitialData(token)}
          onLogout={handleLogout}
        />
      );
    }
    return <SessionLoading />;
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
          <UserMenu
            user={user}
            userMenuOpen={userMenuOpen}
            setUserMenuOpen={setUserMenuOpen}
            userMenuRef={userMenuRef}
            userInitials={userInitials}
            telegramLinked={telegramLinked}
            telegramWaiting={telegramWaiting}
            submitting={submitting}
            handleConnectTelegram={handleConnectTelegram}
            openUnlinkTelegramDialog={openUnlinkTelegramDialog}
            openLogoutDialog={openLogoutDialog}
          />
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
        <FeedbackBanner
          feedbackBanner={feedbackBanner}
          setFeedbackBanner={setFeedbackBanner}
        />
      )}

      {/* Conteúdo Principal */}
      <main className="max-w-7xl mx-auto w-full px-4 py-6 flex-1">
        {/* =========================================================
            ABA 1: FLUXO PRINCIPAL — CADASTRO E VISUALIZAÇÃO DE AGENDA
           ========================================================= */}
        {activeTab === 'agenda' && (
          <AgendaPage
            allAccessibleCalendars={allAccessibleCalendars}
            selectedCalendarId={selectedCalendarId}
            setSelectedCalendarId={setSelectedCalendarId}
            user={user}
            formTitle={formTitle}
            setFormTitle={setFormTitle}
            formDate={formDate}
            setFormDate={setFormDate}
            formTime={formTime}
            setFormTime={setFormTime}
            dateError={dateError}
            setDateError={setDateError}
            formDesc={formDesc}
            setFormDesc={setFormDesc}
            formChannel={formChannel}
            setFormChannel={setFormChannel}
            formReminderMinutes={formReminderMinutes}
            setFormReminderMinutes={setFormReminderMinutes}
            submitting={submitting}
            handleCreateAppointment={handleCreateAppointment}
            activeCalendar={activeCalendar}
            loadAppointments={loadAppointments}
            loadingAppointments={loadingAppointments}
            appointments={appointments}
            openCancelDialog={openCancelDialog}
          />
        )}

        {/* =========================================================
            ABA 2: FLUXO RBAC — SECRETÁRIA ACESSANDO AGENDA DE PROFISSIONAL
           ========================================================= */}
        {activeTab === 'rbac' && (
          <AcessosPage
            isSinglePanel={isSinglePanel}
            showSecretaryPanel={showSecretaryPanel}
            showProfessionalPanel={showProfessionalPanel}
            professionals={professionals}
            user={user}
            handleSelectProfessionalCalendar={handleSelectProfessionalCalendar}
            handleGrantSecretaryPermission={handleGrantSecretaryPermission}
            selectedCalendarId={selectedCalendarId}
            setSelectedCalendarId={setSelectedCalendarId}
            ownedCalendars={ownedCalendars}
            secretaryEmailToGrant={secretaryEmailToGrant}
            setSecretaryEmailToGrant={setSecretaryEmailToGrant}
            submitting={submitting}
          />
        )}

        {/* =========================================================
            ABA 3: FLUXO DE NOTIFICAÇÃO — WORKER + TELEGRAM
           ========================================================= */}
        {activeTab === 'worker' && (
          <LembretesPage
            handleSimulateFailure={handleSimulateFailure}
            handleRunWorkerNow={handleRunWorkerNow}
            submitting={submitting}
            workerStats={workerStats}
            remindersQueue={remindersQueue}
            dispatchedMessages={dispatchedMessages}
          />
        )}

        {/* =========================================================
            ABA 4: CHATBOT TELEGRAM (VISÃO 100% CONVERSACIONAL)
           ========================================================= */}
        {activeTab === 'chatbot' && (
          <AssistentePage
            chatHistory={chatHistory}
            setBotInput={setBotInput}
            botInput={botInput}
            handleSendBotMessage={handleSendBotMessage}
            submitting={submitting}
          />
        )}

        {/* =========================================================
            ABA 5: AUDITORIA, SEGURANÇA & MONITORAMENTO DEVOPS
           ========================================================= */}
        {activeTab === 'auditoria' && (
          <AuditoriaPage
            healthData={healthData}
            auditLogs={auditLogs}
          />
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
