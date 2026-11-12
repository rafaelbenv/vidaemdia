import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Calendar as CalendarIcon } from 'lucide-react';
import {
  cancelAppointment,
  createAppointment,
  createTelegramLink,
  errorMessage,
  errorStatus,
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
  updateAppointment,
  verifyCalendarAccess,
} from './api';
import {
  Appointment,
  AuditLogEntry,
  Calendar,
  ChatMessage,
  CreateAppointmentBody,
  DispatchedMessageLog,
  HealthData,
  ProfessionalDirectoryEntry,
  Reminder,
  UpdateAppointmentBody,
  User,
  WorkerStats,
} from './types';
import {
  formatApptDateTime,
  getErrorMessageByStatus,
} from './lib/format';
import { toDateKey } from './lib/dates';
import { formatRemindSuffix } from './lib/reminderText';
import {
  AGENDA_PATH,
  COMPARTILHAR_PATH,
  LOGIN_PATH,
  SHOW_BASTIDORES,
  bastidoresPath,
  sectionFromPath,
} from './lib/routes';
import { useUserMenu } from './hooks/useUserMenu';
import { useTelegramLink } from './hooks/useTelegramLink';
import { ConfirmDialog, ConfirmModalProps } from './components/ConfirmDialog';
import { FeedbackBanner } from './components/FeedbackBanner';
import { UserMenu } from './components/UserMenu';
import { CalendarMenu } from './components/CalendarMenu';
import { CalendarBanner } from './components/CalendarBanner';
import { SessionLoading } from './components/SessionLoading';
import { SessionLoadError } from './components/SessionLoadError';
import { BastidoresLayout } from './components/BastidoresLayout';
import { AppointmentFormValues, AppointmentPanel } from './components/agenda/AppointmentPanel';
import { LoginPage } from './pages/LoginPage';
import { AgendaPage } from './pages/AgendaPage';
import { CompartilharPage } from './pages/CompartilharPage';
import { TesteAcessoPage } from './pages/TesteAcessoPage';
import { LembretesPage } from './pages/LembretesPage';
import { AssistentePage } from './pages/AssistentePage';
import { AuditoriaPage } from './pages/AuditoriaPage';
import { SaudePage } from './pages/SaudePage';

const CHAT_STORAGE_KEY = 'vidaemdia_chat';
const AGENDA_STORAGE_KEY = 'vidaemdia_agenda';

function createWelcomeMessage(): ChatMessage[] {
  return [
    {
      sender: 'BOT',
      text: '👋 Olá! Sou o assistente inteligente do <b>VidaEmDia</b>.\nEnvie <code>agenda</code> para ver seus compromissos ou escreva por exemplo:\n<b>"Marcar Reunião de Equipe amanhã às 14:30"</b> para agendar automaticamente!',
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      channel: 'TELEGRAM',
    },
  ];
}

function getInitialChatHistory(): ChatMessage[] {
  try {
    const raw = sessionStorage.getItem(CHAT_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // se não houver ou falhar, usar a mensagem de boas-vindas de hoje
  }
  return createWelcomeMessage();
}

export function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('vidaemdia_jwt'));
  const [user, setUser] = useState<User | null>(null);
  const { userMenuOpen, setUserMenuOpen, userMenuRef } = useUserMenu();

  // Loading & Data State
  const [loading, setLoading] = useState(false);
  const [ownedCalendars, setOwnedCalendars] = useState<Calendar[]>([]);
  const [delegatedCalendars, setDelegatedCalendars] = useState<Calendar[]>([]);
  const [selectedCalendarId, setSelectedCalendarId] = useState<string>('');

  const allAccessibleCalendars = [...ownedCalendars, ...delegatedCalendars];
  const activeCalendar = allAccessibleCalendars.find((c) => c.id === selectedCalendarId);
  const canShareSelected = Boolean(
    activeCalendar && (activeCalendar.ownerId === user?.id || user?.role === 'ADMIN'),
  );

  const rawPath = location.pathname.replace(/\/+$/, '') || '/';
  const section = sectionFromPath(rawPath);
  const canControlWorker = user?.role === 'PROFESSIONAL' || user?.role === 'ADMIN';

  function handleSelectCalendar(id: string) {
    setSelectedCalendarId(id);
    try {
      localStorage.setItem(AGENDA_STORAGE_KEY, id);
    } catch {
      // Ignora erro ao salvar no localStorage
    }
    const target = allAccessibleCalendars.find((c) => c.id === id);
    const targetCanShare = target ? target.ownerId === user?.id || user?.role === 'ADMIN' : false;
    if (rawPath === COMPARTILHAR_PATH && !targetCanShare) {
      navigate(AGENDA_PATH);
    }
  }

  // Redirecionamento baseado na sessão e na URL
  useEffect(() => {
    const path = location.pathname.replace(/\/+$/, '') || '/';
    if (!token) {
      if (path !== LOGIN_PATH) navigate(LOGIN_PATH, { replace: true });
      return;
    }
    if (!user) return; // sessão ainda sendo validada: não mexe na URL (recarregar mantém a tela)

    if (SHOW_BASTIDORES && path === '/bastidores') {
      navigate(bastidoresPath('lembretes'), { replace: true });
      return;
    }

    const currentSection = sectionFromPath(path);
    const isBastidoresValid = currentSection !== null && SHOW_BASTIDORES;
    const isAgenda = path === AGENDA_PATH;

    if (path === COMPARTILHAR_PATH) {
      if (loading || allAccessibleCalendars.length === 0) {
        return; // Aguardar as agendas carregarem antes de redirecionar
      }
      if (!canShareSelected) {
        navigate(AGENDA_PATH, { replace: true });
        return;
      }
      return;
    }

    if (!isBastidoresValid && !isAgenda) {
      navigate(AGENDA_PATH, { replace: true });
    }
  }, [token, user, canShareSelected, loading, allAccessibleCalendars.length, location.pathname, navigate]);

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

  // Appointments, Professionals & Audit State
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
        setPanel(null);
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
  const [workerStats, setWorkerStats] = useState<WorkerStats | null>(null);
  const [remindersQueue, setRemindersQueue] = useState<Reminder[]>([]);
  const [dispatchedMessages, setDispatchedMessages] = useState<DispatchedMessageLog[]>([]);
  const [healthData, setHealthData] = useState<HealthData | null>(null);

  // Painel de Compromisso (Criar / Editar)
  const [panel, setPanel] = useState<
    | { mode: 'create'; date?: string }
    | { mode: 'edit'; appointmentId: string }
    | null
  >(null);
  const [panelSaving, setPanelSaving] = useState(false);
  const [panelError, setPanelError] = useState<string | null>(null);

  function openNewAppointment(date?: string) {
    setPanel({ mode: 'create', date });
    setPanelError(null);
  }

  function openEditAppointment(appt: Appointment) {
    setPanel({ mode: 'edit', appointmentId: appt.id });
    setPanelError(null);
  }

  function closePanel() {
    setPanel(null);
    setPanelError(null);
  }

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
  const [botInput, setBotInput] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>(getInitialChatHistory);

  useEffect(() => {
    try {
      sessionStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(chatHistory));
    } catch {
      // Ignora falhas de escrita no sessionStorage
    }
  }, [chatHistory]);

  useEffect(() => {
    if (token) {
      loadSession(token);
    }
  }, [token]);

  useEffect(() => {
    if (token && selectedCalendarId) {
      loadAppointments(selectedCalendarId);
    }
  }, [selectedCalendarId, token]);

  useEffect(() => {
    if (user && token && section !== null) {
      loadBastidoresData(token);
    }
  }, [user?.id, section, token]);

  useEffect(() => {
    if (section === 'lembretes' && token) {
      const interval = window.setInterval(() => {
        loadBastidoresData(token, { silent: true });
      }, 10000);
      return () => window.clearInterval(interval);
    }
  }, [section, token]);

  async function loadSession(jwt: string) {
    try {
      setInitialLoadError(null);
      setLoading(true);
      const [me, calData] = await Promise.all([
        getMe(jwt),
        getCalendars(jwt),
      ]);

      setUser(me);
      setOwnedCalendars(calData.owned);
      setDelegatedCalendars(calData.delegated);

      let isTgLinked = Boolean(me.telegramLinked);
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

      const allAccessible = [...calData.owned, ...calData.delegated];
      let initialCalId = '';
      try {
        const savedId = localStorage.getItem(AGENDA_STORAGE_KEY);
        if (savedId && allAccessible.some((c) => c.id === savedId)) {
          initialCalId = savedId;
        }
      } catch {
        // Fallback para seleção padrão
      }
      if (!initialCalId) {
        initialCalId = calData.owned[0]?.id || calData.delegated[0]?.id || '';
      }
      setSelectedCalendarId(initialCalId);
    } catch (err: unknown) {
      if (errorStatus(err) === 401) {
        handleLogout();
      } else {
        const message = getErrorMessageByStatus(errorStatus(err));
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

  async function loadBastidoresData(jwt: string, options?: { silent?: boolean }) {
    try {
      const [profs, audits, notifStatus, health] = await Promise.all([
        getProfessionals(jwt),
        getAuditLogs(jwt),
        getNotificationsStatus(jwt),
        getHealth(jwt),
      ]);

      setProfessionals(profs);
      setAuditLogs(audits);
      setWorkerStats(notifStatus.worker);
      setRemindersQueue(notifStatus.reminders);
      setDispatchedMessages(notifStatus.dispatchedMessages);
      setHealthData(health);
    } catch (err: unknown) {
      if (options?.silent) {
        return;
      }
      const status = errorStatus(err);
      if (status !== 401) {
        setFeedbackBanner({
          type: 'error',
          title: 'Não foi possível carregar os dados técnicos.',
          detail: getErrorMessageByStatus(status),
        });
      }
    }
  }

  async function loadAppointments(calendarId: string) {
    if (!token) return;
    setLoadingAppointments(true);
    try {
      const list = await getAppointments(token, calendarId);
      setAppointments(list);
    } catch (err: unknown) {
      const status = errorStatus(err) || 500;
      setFeedbackBanner({
        type: 'error',
        title: getErrorMessageByStatus(errorStatus(err)),
        detail: `${status} — ${errorMessage(err, 'Erro ao carregar compromissos desta agenda')}`,
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
      navigate(AGENDA_PATH);
      setUserMenuOpen(false);
      setFeedbackBanner({
        type: 'success',
        title: `Bem-vindo, ${res.user.name}!`,
        detail: `Autenticado com sucesso via JWT como ${res.user.name} (${res.user.role})`,
      });
    } catch (err: unknown) {
      setAuthError(errorMessage(err, 'Falha na autenticação'));
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    stopPolling();
    setTelegramLinked(false);
    setTelegramWaiting(false);
    localStorage.removeItem('vidaemdia_jwt');
    try {
      sessionStorage.removeItem(CHAT_STORAGE_KEY);
    } catch {
      // Ignora erro ao acessar sessionStorage
    }
    setChatHistory(createWelcomeMessage());
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
            await loadSession(token);
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
    } catch (err: unknown) {
      const status = errorStatus(err) || 500;
      setFeedbackBanner({
        type: 'error',
        title: 'Não foi possível conectar o Telegram.',
        detail: `${status} — ${errorMessage(err, 'Erro ao gerar link de conexão do Telegram')}`,
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
      await loadSession(token);
    } catch (err: unknown) {
      const status = errorStatus(err) || 500;
      setFeedbackBanner({
        type: 'error',
        title: 'Não foi possível desconectar o Telegram.',
        detail: `${status} — ${errorMessage(err, 'Erro ao desconectar Telegram')}`,
      });
    } finally {
      setSubmittingKey('telegram', false);
    }
  }

  async function handleSaveAppointment(values: AppointmentFormValues) {
    if (!token || !panel || !selectedCalendarId) return;
    setPanelSaving(true);
    setPanelError(null);

    try {
      const start = new Date(`${values.date}T${values.time}`);
      const end = values.endTime ? new Date(`${values.date}T${values.endTime}`) : undefined;

      let savedAppt: Appointment;

      if (panel.mode === 'create') {
        const body: CreateAppointmentBody = {
          calendarId: selectedCalendarId,
          title: values.title.trim(),
          description: values.description.trim() || undefined,
          startTime: start.toISOString(),
          endTime: end ? end.toISOString() : undefined,
          reminderEnabled: values.reminder !== 'none',
          reminderMinutesBefore: values.reminder === 'none' ? undefined : Number(values.reminder),
          reminderChannel: 'TELEGRAM',
        };
        savedAppt = await createAppointment(token, body);
      } else {
        const body: UpdateAppointmentBody = {
          title: values.title.trim(),
          description: values.description.trim() === '' ? '' : values.description.trim(),
          startTime: start.toISOString(),
          reminderEnabled: values.reminder !== 'none',
          reminderMinutesBefore: values.reminder === 'none' ? undefined : Number(values.reminder),
          reminderChannel: 'TELEGRAM',
        };
        if (end) {
          body.endTime = end.toISOString();
        }
        savedAppt = await updateAppointment(token, panel.appointmentId, body);
      }

      setPanel(null);
      setPanelError(null);
      await loadAppointments(selectedCalendarId);
      if (section !== null) {
        await loadBastidoresData(token);
      }

      const isOwnCal = activeCalendar ? activeCalendar.ownerId === user?.id : true;
      let bannerTitle = '';
      let bannerDetail: string | undefined = undefined;

      if (savedAppt.reminders && savedAppt.reminders.length > 0 && values.reminder !== 'none') {
        const suffix = formatRemindSuffix(savedAppt.reminders[0].remindAt, savedAppt.startTime);
        bannerTitle = `Compromisso salvo. Lembrete ${suffix}.`;
        if (isOwnCal && !telegramLinked) {
          bannerDetail = 'Conecte o Telegram para receber o lembrete.';
        }
      } else {
        bannerTitle = 'Compromisso salvo. Sem lembrete.';
      }

      setFeedbackBanner({
        type: 'success',
        title: bannerTitle,
        detail: bannerDetail,
      });
    } catch (err: unknown) {
      const status = errorStatus(err);
      const msg = status === 403 ? getErrorMessageByStatus(403) : errorMessage(err);
      setPanelError(msg);
    } finally {
      setPanelSaving(false);
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
      if (selectedCalendarId) {
        await loadAppointments(selectedCalendarId);
      }
      if (section !== null) {
        await loadBastidoresData(token);
      }
    } catch (err: unknown) {
      const status = errorStatus(err);
      setFeedbackBanner({
        type: 'error',
        title: getErrorMessageByStatus(status),
        detail: `${status || 403} — ${errorMessage(err)}`,
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
      navigate(AGENDA_PATH);
      setFeedbackBanner({
        type: 'success',
        title: `Acessando agenda de ${profName}.`,
        detail: 'Autorização RBAC validada',
      });
    } catch (err: unknown) {
      const status = errorStatus(err) || 403;
      setFeedbackBanner({
        type: 'error',
        title: getErrorMessageByStatus(status),
        detail: `${status} — ${errorMessage(err, '403 Acesso negado: Secretária não tem autorização para esta agenda.')}`,
      });
      // Atualiza logs de auditoria para mostrar o bloqueio 403 gravado
      if (section !== null) {
        const audits = await getAuditLogs(token);
        setAuditLogs(audits);
      }
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
      await loadSession(token);
    } catch (err: unknown) {
      const status = errorStatus(err);
      setFeedbackBanner({
        type: 'error',
        title: getErrorMessageByStatus(status),
        detail: `${status || 400} — ${errorMessage(err)}`,
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
      await loadBastidoresData(token);
      if (selectedCalendarId) {
        await loadAppointments(selectedCalendarId);
      }
    } catch (err: unknown) {
      const status = errorStatus(err);
      setFeedbackBanner({
        type: 'error',
        title: getErrorMessageByStatus(status),
        detail: `${status || 500} — ${errorMessage(err)}`,
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
        detail: `Fila de Retry: máx. ${workerStats?.maxRetries ?? 3} tentativas no PostgreSQL`,
      });
      await loadBastidoresData(token);
      if (selectedCalendarId) {
        await loadAppointments(selectedCalendarId);
      }
    } catch (err: unknown) {
      const status = errorStatus(err);
      setFeedbackBanner({
        type: 'error',
        title: getErrorMessageByStatus(status),
        detail: `${status || 500} — ${errorMessage(err)}`,
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
        if (selectedCalendarId) {
          await loadAppointments(selectedCalendarId);
        }
        if (section !== null) {
          await loadBastidoresData(token);
        }
      }
    } catch (err: unknown) {
      setChatHistory((prev) => [
        ...prev,
        {
          sender: 'BOT',
          text: `❌ Erro ao processar comando: ${errorMessage(err)}`,
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
          onRetry={() => loadSession(token)}
          onLogout={handleLogout}
        />
      );
    }
    return <SessionLoading />;
  }

  const isOwnerOrAdmin = activeCalendar
    ? activeCalendar.ownerId === user.id || user.role === 'ADMIN'
    : false;
  const canCreateAppt = isOwnerOrAdmin
    ? true
    : Boolean(activeCalendar?.myPermissions?.canCreate);
  const canUpdateAppt = isOwnerOrAdmin
    ? true
    : Boolean(activeCalendar?.myPermissions?.canUpdate);
  const canCancelAppt = isOwnerOrAdmin
    ? true
    : Boolean(activeCalendar?.myPermissions?.canCancel);

  const userInitials = user.name
    ? user.name
        .split(' ')
        .map((part) => part[0])
        .filter(Boolean)
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'U';

  // Diálogo de confirmação acessível reutilizado em ambos os layouts
  const confirmDialogElement = (
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
  );

  // Banner de feedback reutilizado em ambos os layouts
  const feedbackBannerElement = feedbackBanner ? (
    <FeedbackBanner
      feedbackBanner={feedbackBanner}
      setFeedbackBanner={setFeedbackBanner}
    />
  ) : null;

  if (section !== null && SHOW_BASTIDORES) {
    return (
      <>
        <BastidoresLayout
          section={section}
          userName={user.name}
          onBack={() => navigate(AGENDA_PATH)}
          feedbackBanner={feedbackBannerElement}
        >
          {section === 'lembretes' && (
            <LembretesPage
              handleSimulateFailure={handleSimulateFailure}
              handleRunWorkerNow={handleRunWorkerNow}
              submitting={submitting}
              workerStats={workerStats}
              remindersQueue={remindersQueue}
              dispatchedMessages={dispatchedMessages}
              canControlWorker={canControlWorker}
            />
          )}
          {section === 'assistente' && (
            <AssistentePage
              chatHistory={chatHistory}
              setBotInput={setBotInput}
              botInput={botInput}
              handleSendBotMessage={handleSendBotMessage}
              submitting={submitting}
            />
          )}
          {section === 'acesso' && (
            <TesteAcessoPage
              professionals={professionals}
              user={user}
              handleSelectProfessionalCalendar={handleSelectProfessionalCalendar}
            />
          )}
          {section === 'auditoria' && (
            <AuditoriaPage auditLogs={auditLogs} />
          )}
          {section === 'saude' && (
            <SaudePage healthData={healthData} auditLogsCount={auditLogs.length} />
          )}
        </BastidoresLayout>
        {confirmDialogElement}
      </>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      {/* Top Navbar */}
      <header className="bg-stone-900 text-white border-b border-stone-800 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center gap-2 shrink-0">
              <div className="p-1.5 bg-brand-700 rounded-md">
                <CalendarIcon className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-lg hidden sm:inline">VidaEmDia</span>
            </div>

            {(rawPath === AGENDA_PATH || rawPath === COMPARTILHAR_PATH) && (
              <CalendarMenu
                owned={ownedCalendars}
                delegated={delegatedCalendars}
                selectedId={selectedCalendarId}
                canShareSelected={canShareSelected}
                onSelect={handleSelectCalendar}
                onShare={() => navigate(COMPARTILHAR_PATH)}
              />
            )}
          </div>

          {/* Menu do Avatar */}
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
            showBastidores={SHOW_BASTIDORES}
            onOpenBastidores={() => navigate(bastidoresPath('lembretes'))}
          />
        </div>
      </header>

      {activeCalendar && activeCalendar.ownerId !== user.id && (
        <CalendarBanner calendar={activeCalendar} />
      )}

      {/* Banner de Feedback de Operações */}
      {feedbackBannerElement}

      {/* Conteúdo Principal */}
      <main className="max-w-7xl mx-auto w-full px-4 py-6 flex-1">
        {rawPath === COMPARTILHAR_PATH && canShareSelected ? (
          <CompartilharPage
            onBack={() => navigate(AGENDA_PATH)}
            selectedCalendarId={selectedCalendarId}
            setSelectedCalendarId={handleSelectCalendar}
            ownedCalendars={ownedCalendars}
            secretaryEmailToGrant={secretaryEmailToGrant}
            setSecretaryEmailToGrant={setSecretaryEmailToGrant}
            handleGrantSecretaryPermission={handleGrantSecretaryPermission}
            submitting={submitting}
          />
        ) : (
          <AgendaPage
            user={user}
            activeCalendar={activeCalendar}
            canCreate={canCreateAppt}
            loadingAppointments={loadingAppointments}
            appointments={appointments}
            onOpenAppointment={openEditAppointment}
            onNewAppointment={openNewAppointment}
            telegramLinked={telegramLinked}
            onConnectTelegram={handleConnectTelegram}
          />
        )}
      </main>

      {panel !== null && activeCalendar && (
        <AppointmentPanel
          key={panel.mode === 'edit' ? panel.appointmentId : `create-${panel.date || 'default'}`}
          mode={panel.mode}
          appointment={
            panel.mode === 'edit'
              ? appointments.find((a) => a.id === panel.appointmentId)
              : undefined
          }
          calendar={activeCalendar}
          defaultDate={
            (panel.mode === 'create' && panel.date) ||
            new URLSearchParams(location.search).get('dia') ||
            toDateKey(new Date())
          }
          canEdit={panel.mode === 'create' ? canCreateAppt : canUpdateAppt}
          canCancel={canCancelAppt}
          saving={panelSaving}
          serverError={panelError}
          onClose={closePanel}
          onSubmit={handleSaveAppointment}
          onRequestCancel={() => {
            if (panel.mode === 'edit') {
              const appt = appointments.find((a) => a.id === panel.appointmentId);
              if (appt) openCancelDialog(appt);
            }
          }}
        />
      )}

      {confirmDialogElement}
    </div>
  );
}
