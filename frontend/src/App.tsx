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
  Users,
  FileText,
  Smartphone,
} from 'lucide-react';
import { apiRequest, createTelegramLink, getTelegramStatus, unlinkTelegram } from './api';
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

function sanitizeTelegramHtml(rawHtml: string): string {
  if (!rawHtml) return '';
  return rawHtml.replace(/<[^>]*>/g, (tag) => {
    const lower = tag.toLowerCase();
    if (
      lower === '<b>' ||
      lower === '</b>' ||
      lower === '<i>' ||
      lower === '</i>' ||
      lower === '<code>' ||
      lower === '</code>'
    ) {
      return lower;
    }
    return '';
  });
}

export function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('vidaemdia_jwt'));
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'agenda' | 'rbac' | 'worker' | 'chatbot' | 'auditoria'>('agenda');

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
  const [professionals, setProfessionals] = useState<ProfessionalDirectoryEntry[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);

  // Worker & Notification State
  const [workerStats, setWorkerStats] = useState<any>(null);
  const [remindersQueue, setRemindersQueue] = useState<Reminder[]>([]);
  const [dispatchedMessages, setDispatchedMessages] = useState<DispatchedMessageLog[]>([]);
  const [healthData, setHealthData] = useState<any>(null);

  // Form State (Fluxo Principal - Etapa 3)
  const [formTitle, setFormTitle] = useState('');
  const [formDate, setFormDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [formTime, setFormTime] = useState('08:00');
  const [formDesc, setFormDesc] = useState('');
  const [formReminderMinutes, setFormReminderMinutes] = useState<number>(0);
  const [formChannel, setFormChannel] = useState<NotificationChannel>('TELEGRAM');
  const [feedbackBanner, setFeedbackBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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
        apiRequest<User>('/auth/me', {}, jwt),
        apiRequest<{ owned: Calendar[]; delegated: Calendar[] }>('/agendas', {}, jwt),
        apiRequest<ProfessionalDirectoryEntry[]>('/agendas/profissionais', {}, jwt),
        apiRequest<AuditLogEntry[]>('/auditoria', {}, jwt),
        apiRequest<any>('/notificacoes/status', {}, jwt),
        apiRequest<any>('/health', {}, jwt),
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
    try {
      const list = await apiRequest<Appointment[]>(`/compromissos?calendarId=${calendarId}`, {}, token);
      setAppointments(list);
    } catch (err: any) {
      setFeedbackBanner({
        type: 'error',
        text: err.message || 'Erro ao carregar compromissos desta agenda',
      });
    }
  }

  async function handleLogin(e?: React.FormEvent, quickEmail?: string) {
    if (e) e.preventDefault();
    setAuthError(null);
    const loginEmail = quickEmail || email;
    try {
      setLoading(true);
      const res = await apiRequest<{ accessToken: string; user: User }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: loginEmail, password }),
      });
      localStorage.setItem('vidaemdia_jwt', res.accessToken);
      setSelectedCalendarId('');
      setToken(res.accessToken);
      setUser(res.user);
      setFeedbackBanner({
        type: 'success',
        text: `Autenticado com sucesso via JWT como ${res.user.name} (${res.user.role})`,
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
  }

  async function handleConnectTelegram() {
    if (!token) return;
    setFeedbackBanner(null);
    stopPolling();

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
              text: 'Telegram conectado com sucesso!',
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
        text: err.message || 'Erro ao gerar link de conexão do Telegram',
      });
    }
  }

  async function handleUnlinkTelegram() {
    if (!token) return;
    stopPolling();
    setFeedbackBanner(null);

    try {
      await unlinkTelegram(token);
      setTelegramLinked(false);
      setTelegramWaiting(false);
      setFeedbackBanner({
        type: 'success',
        text: 'Telegram desconectado com sucesso!',
      });
      await loadInitialData(token);
    } catch (err: any) {
      setFeedbackBanner({
        type: 'error',
        text: err.message || 'Erro ao desconectar Telegram',
      });
    }
  }

  // Etapa 4 do Fluxo Principal: Submete formulário -> POST /compromissos (com JWT no header)
  async function handleCreateAppointment(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !selectedCalendarId) return;
    setFeedbackBanner(null);

    try {
      const startIso = new Date(`${formDate}T${formTime}:00`).toISOString();
      await apiRequest<Appointment>(
        '/compromissos',
        {
          method: 'POST',
          body: JSON.stringify({
            calendarId: selectedCalendarId,
            title: formTitle,
            description: formDesc || undefined,
            startTime: startIso,
            reminderMinutesBefore: Number(formReminderMinutes),
            reminderChannel: formChannel,
          }),
        },
        token,
      );

      setFormTitle('');
      setFormDesc('');
      setFeedbackBanner({
        type: 'success',
        text: '201 Created — Compromisso salvo no PostgreSQL e lembrete agendado para o Worker!',
      });

      await loadAppointments(selectedCalendarId);
      await loadInitialData(token);
    } catch (err: any) {
      setFeedbackBanner({
        type: 'error',
        text: `${err.status || 400} — ${err.message}`,
      });
      if (token) {
        const audits = await apiRequest<AuditLogEntry[]>('/auditoria', {}, token);
        setAuditLogs(audits);
      }
    }
  }

  async function handleCancelAppointment(id: string) {
    if (!token) return;
    setFeedbackBanner(null);
    try {
      await apiRequest(`/compromissos/${id}`, { method: 'DELETE' }, token);
      setFeedbackBanner({
        type: 'success',
        text: 'Compromisso cancelado com sucesso e log de auditoria gravado!',
      });
      await loadAppointments(selectedCalendarId);
      await loadInitialData(token);
    } catch (err: any) {
      setFeedbackBanner({
        type: 'error',
        text: `${err.status || 403} — ${err.message}`,
      });
    }
  }

  // Fluxo RBAC: Secretária seleciona agenda de um Profissional
  async function handleSelectProfessionalCalendar(calendarId: string, profName: string) {
    if (!token) return;
    setFeedbackBanner(null);
    try {
      await apiRequest(`/agendas/${calendarId}/verificar-acesso`, {}, token);
      setSelectedCalendarId(calendarId);
      setActiveTab('agenda');
      setFeedbackBanner({
        type: 'success',
        text: `Autorização RBAC validada! Acessando agenda de ${profName}.`,
      });
    } catch (err: any) {
      setFeedbackBanner({
        type: 'error',
        text: err.message || '403 Acesso negado: Secretária não tem autorização para esta agenda.',
      });
      // Atualiza logs de auditoria para mostrar o bloqueio 403 gravado
      const audits = await apiRequest<AuditLogEntry[]>('/auditoria', {}, token);
      setAuditLogs(audits);
    }
  }

  async function handleGrantSecretaryPermission(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !selectedCalendarId) return;
    try {
      await apiRequest(
        `/agendas/${selectedCalendarId}/permissoes`,
        {
          method: 'POST',
          body: JSON.stringify({
            secretaryEmail: secretaryEmailToGrant,
            canView: true,
            canCreate: true,
            canUpdate: true,
            canCancel: true,
          }),
        },
        token,
      );
      setFeedbackBanner({
        type: 'success',
        text: `Permissão RBAC concedida para ${secretaryEmailToGrant}!`,
      });
      await loadInitialData(token);
    } catch (err: any) {
      setFeedbackBanner({
        type: 'error',
        text: err.message,
      });
    }
  }

  // Fluxo de Notificação: Executa Ciclo do Worker manualmente
  async function handleRunWorkerNow() {
    if (!token) return;
    try {
      const res = await apiRequest<any>('/notificacoes/executar-worker', { method: 'POST' }, token);
      setFeedbackBanner({
        type: 'success',
        text: `Worker Executado: ${res.message}`,
      });
      await loadInitialData(token);
    } catch (err: any) {
      setFeedbackBanner({ type: 'error', text: err.message });
    }
  }

  async function handleSimulateFailure() {
    if (!token) return;
    try {
      await apiRequest('/notificacoes/simular-falha', {
        method: 'POST',
        body: JSON.stringify({ failCount: 1 }),
      }, token);
      setFeedbackBanner({
        type: 'error',
        text: 'Simulação de falha ativada! O próximo envio ao Telegram falhará e entrará na fila de Retry (máx. 3 tentativas).',
      });
    } catch (err: any) {
      setFeedbackBanner({ type: 'error', text: err.message });
    }
  }

  // Chatbot Webhook (Telegram)
  async function handleSendBotMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!botInput.trim() || !user || !token) return;

    const msgText = botInput;
    const nowTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    setChatHistory((prev) => [
      ...prev,
      { sender: 'USER', text: msgText, time: nowTime, channel: 'TELEGRAM' },
    ]);
    setBotInput('');

    try {
      const res = await apiRequest<{ botReply: string }>(
        '/notificacoes/bot/webhook',
        {
          method: 'POST',
          body: JSON.stringify({
            text: msgText,
          }),
        },
        token,
      );

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
    }
  }

  // ==========================================
  // TELA DE LOGIN (Fluxo Principal - Etapa 1 e 2)
  // ==========================================
  if (!token || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-4">
        <div className="max-w-4xl w-full grid md:grid-cols-2 bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Coluna Esquerda: Apresentação dos 3 Fluxos */}
          <div className="bg-indigo-600 p-8 text-white flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 bg-white/20 rounded-xl">
                  <CalendarIcon className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight">VidaEmDia</h1>
                  <p className="text-xs text-indigo-200">Agenda Pessoal/Profissional & Chatbot Telegram</p>
                </div>
              </div>

              <p className="text-sm text-indigo-100 leading-relaxed mb-6">
                Plataforma completa implementando os três fluxos arquiteturais do projeto:
              </p>

              <div className="space-y-4 text-xs">
                <div className="bg-white/10 p-3.5 rounded-xl border border-white/15">
                  <div className="font-semibold text-white flex items-center gap-2 mb-1">
                    <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                    1. Fluxo Principal (Cadastro & JWT)
                  </div>
                  <p className="text-indigo-100">
                    Autenticação JWT, agendas pessoal e profissional, validação NestJS e persistência no PostgreSQL.
                  </p>
                </div>

                <div className="bg-white/10 p-3.5 rounded-xl border border-white/15">
                  <div className="font-semibold text-white flex items-center gap-2 mb-1">
                    <ShieldCheck className="w-4 h-4 text-amber-300" />
                    2. Fluxo RBAC (Secretária ↔ Profissional)
                  </div>
                  <p className="text-indigo-100">
                    Delegação de acesso com dupla checagem RBAC, retorno 403 para agendas não autorizadas e log de auditoria.
                  </p>
                </div>

                <div className="bg-white/10 p-3.5 rounded-xl border border-white/15">
                  <div className="font-semibold text-white flex items-center gap-2 mb-1">
                    <Bell className="w-4 h-4 text-green-300" />
                    3. Worker Telegram + Chatbot
                  </div>
                  <p className="text-indigo-100">
                    Disparo periódico de lembretes com política de Retry (máx. 3 tentativas) e criação de eventos via chat.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-white/20 text-xs text-indigo-200 flex items-center justify-between">
              <span>Segurança: HTTPS · JWT · RBAC · Auditoria</span>
              <span>PostgreSQL 16</span>
            </div>
          </div>

          {/* Coluna Direita: Formulário de Login + Acesso Rápido Demo */}
          <div className="p-8 flex flex-col justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900 mb-1">Acessar Sistema Web</h2>
              <p className="text-xs text-slate-500 mb-6">
                Entre com e-mail e senha para gerar seu token JWT ou selecione um perfil de demonstração abaixo.
              </p>

              {authError && (
                <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{authError}</span>
                </div>
              )}

              <form onSubmit={(e) => handleLogin(e)} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">E-mail</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Senha</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-lg shadow transition flex items-center justify-center gap-2"
                >
                  <Lock className="w-4 h-4" />
                  {loading ? 'Validando credenciais...' : 'Entrar (Gerar JWT)'}
                </button>
              </form>

              <div className="mt-6">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                  Perfis Rápidos para Testar os Fluxos (1-Clique):
                </p>
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => handleLogin(undefined, 'carlos@vidaemdia.com.br')}
                    className="w-full text-left p-2.5 rounded-lg border border-blue-200 bg-blue-50/60 hover:bg-blue-100/70 transition flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-bold text-blue-900">👤 Carlos Silva (Usuário)</span>
                      <p className="text-blue-700 text-[11px]">Testa Fluxo Principal (Agenda Pessoal + Telegram)</p>
                    </div>
                    <span className="px-2 py-0.5 bg-blue-200 text-blue-900 rounded font-mono text-[10px]">USER</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleLogin(undefined, 'dr.joao@vidaemdia.com.br')}
                    className="w-full text-left p-2.5 rounded-lg border border-emerald-200 bg-emerald-50/60 hover:bg-emerald-100/70 transition flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-bold text-emerald-900">🩺 Dr. João Mendes (Profissional)</span>
                      <p className="text-emerald-700 text-[11px]">Agenda Médica + Delegação RBAC para Secretária</p>
                    </div>
                    <span className="px-2 py-0.5 bg-emerald-200 text-emerald-900 rounded font-mono text-[10px]">
                      PROFESSIONAL
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleLogin(undefined, 'secretaria.maria@vidaemdia.com.br')}
                    className="w-full text-left p-2.5 rounded-lg border border-amber-200 bg-amber-50/60 hover:bg-amber-100/70 transition flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-bold text-amber-900">🗂️ Maria Oliveira (Secretária)</span>
                      <p className="text-amber-700 text-[11px]">
                        Testa Fluxo RBAC (Acessa Dr. João ✅ | Bloqueada na Dra. Ana 403 ❌)
                      </p>
                    </div>
                    <span className="px-2 py-0.5 bg-amber-200 text-amber-900 rounded font-mono text-[10px]">
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

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Navbar */}
      <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-lg">
              <CalendarIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg">VidaEmDia</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 font-medium">
                  JWT Autenticado
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Controle de Agenda Pessoal & Profissional · RBAC · Worker Telegram
              </p>
            </div>
          </div>

          {/* Informações do Usuário Logado + Conexão Telegram + Troca Rápida */}
          <div className="flex items-center gap-3">
            {telegramLinked ? (
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  Telegram conectado
                </span>
                <button
                  type="button"
                  onClick={handleUnlinkTelegram}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-red-900/40 text-red-300 hover:text-red-200 text-xs font-medium border border-slate-700 transition"
                >
                  Desconectar
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleConnectTelegram}
                  className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow transition flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  Conectar Telegram
                </button>
                {telegramWaiting && (
                  <span className="text-xs text-sky-200 animate-pulse">
                    Clique em Iniciar no Telegram e volte aqui
                  </span>
                )}
              </div>
            )}

            <div className="text-right hidden sm:block">
              <div className="text-sm font-semibold text-white">{user.name}</div>
              <div className="text-xs text-slate-400 flex items-center justify-end gap-1.5">
                <span>{user.email}</span>
                <span className="px-1.5 py-0.2 bg-slate-800 text-amber-300 rounded font-mono text-[10px] border border-slate-700">
                  {user.role}
                </span>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 border border-slate-700 transition"
            >
              <LogOut className="w-3.5 h-3.5" />
              Trocar Conta
            </button>
          </div>
        </div>

        {/* Sub-barra de Navegação dos Fluxos */}
        <div className="bg-slate-800/70 border-t border-slate-800">
          <div className="max-w-7xl mx-auto px-4 flex overflow-x-auto gap-1 py-1.5">
            <button
              onClick={() => setActiveTab('agenda')}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition whitespace-nowrap ${
                activeTab === 'agenda'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-300 hover:bg-slate-700/60'
              }`}
            >
              <CalendarIcon className="w-4 h-4" />
              1. Fluxo Principal (Agenda & Compromissos)
            </button>

            <button
              onClick={() => setActiveTab('rbac')}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition whitespace-nowrap ${
                activeTab === 'rbac'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'text-slate-300 hover:bg-slate-700/60'
              }`}
            >
              <Users className="w-4 h-4" />
              2. Fluxo RBAC (Secretária ↔ Profissional)
            </button>

            <button
              onClick={() => setActiveTab('worker')}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition whitespace-nowrap ${
                activeTab === 'worker'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-300 hover:bg-slate-700/60'
              }`}
            >
              <Bell className="w-4 h-4" />
              3. Fluxo de Notificação (Worker Telegram)
              {remindersQueue.filter((r) => r.status === 'PENDING').length > 0 && (
                <span className="px-1.5 py-0.2 bg-white text-emerald-800 rounded-full text-[10px] font-bold">
                  {remindersQueue.filter((r) => r.status === 'PENDING').length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('chatbot')}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition whitespace-nowrap ${
                activeTab === 'chatbot'
                  ? 'bg-teal-600 text-white shadow'
                  : 'text-slate-300 hover:bg-slate-700/60'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              4. Chatbot Telegram (Webhook)
            </button>

            <button
              onClick={() => setActiveTab('auditoria')}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition whitespace-nowrap ${
                activeTab === 'auditoria'
                  ? 'bg-purple-600 text-white shadow'
                  : 'text-slate-300 hover:bg-slate-700/60'
              }`}
            >
              <FileText className="w-4 h-4" />
              5. Auditoria, Segurança & DevOps
            </button>
          </div>
        </div>
      </header>

      {/* Banner de Feedback de Operações (201 Created, 400 Bad Request, 403 Forbidden RBAC) */}
      {feedbackBanner && (
        <div className="max-w-7xl mx-auto w-full px-4 pt-4">
          <div
            className={`p-3.5 rounded-xl border flex items-center justify-between text-xs font-medium shadow-sm ${
              feedbackBanner.type === 'success'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                : 'bg-red-50 border-red-300 text-red-900'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {feedbackBanner.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />
              )}
              <span>{feedbackBanner.text}</span>
            </div>
            <button
              onClick={() => setFeedbackBanner(null)}
              className="text-slate-500 hover:text-slate-800 font-bold ml-4"
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
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Coluna Esquerda: Seletor de Agenda + Formulário de Novo Compromisso */}
            <div className="space-y-6">
              {/* Seleção da Agenda Ativa */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4 text-indigo-600" />
                  Agendas Autorizadas (Pessoal / Profissional)
                </h3>

                <div className="space-y-2">
                  {allAccessibleCalendars.map((cal) => {
                    const isDelegated = cal.ownerId !== user.id;
                    const isSelected = cal.id === selectedCalendarId;
                    return (
                      <button
                        key={cal.id}
                        onClick={() => setSelectedCalendarId(cal.id)}
                        className={`w-full text-left p-3 rounded-lg border transition flex items-center justify-between ${
                          isSelected
                            ? 'border-indigo-600 bg-indigo-50/70 ring-1 ring-indigo-600'
                            : 'border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div>
                          <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                            <span
                              className="w-2.5 h-2.5 rounded-full inline-block"
                              style={{ backgroundColor: cal.color }}
                            />
                            {cal.name}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {isDelegated
                              ? `Delegada via RBAC (${cal.owner?.name})`
                              : `Tipo: ${cal.type === 'PROFESSIONAL' ? 'Profissional' : 'Pessoal'}`}
                          </div>
                        </div>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                            isDelegated
                              ? 'bg-amber-100 text-amber-800'
                              : cal.type === 'PROFESSIONAL'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-blue-100 text-blue-800'
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
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                <h3 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-2">
                  <Plus className="w-4 h-4 text-indigo-600" />
                  Novo Compromisso
                </h3>
                <p className="text-xs text-slate-500 mb-4">
                  Preenche Título · Data · Horário · Descrição · Lembrete →{' '}
                  <code className="text-indigo-600 font-mono">POST /compromissos</code>
                </p>

                <form onSubmit={handleCreateAppointment} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Título do Compromisso *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex.: Consulta médica hoje às 08:00"
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Data *</label>
                      <input
                        type="date"
                        required
                        value={formDate}
                        onChange={(e) => setFormDate(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Horário *</label>
                      <input
                        type="time"
                        required
                        value={formTime}
                        onChange={(e) => setFormTime(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Descrição</label>
                    <textarea
                      rows={2}
                      placeholder="Observações, link da reunião ou preparo de consulta..."
                      value={formDesc}
                      onChange={(e) => setFormDesc(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Canal do Lembrete
                      </label>
                      <select
                        value={formChannel}
                        onChange={(e) => setFormChannel(e.target.value as NotificationChannel)}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                      >
                        <option value="TELEGRAM">Telegram</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Disparo do Lembrete
                      </label>
                      <select
                        value={formReminderMinutes}
                        onChange={(e) => setFormReminderMinutes(Number(e.target.value))}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
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
                    className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-lg shadow transition flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Salvar Compromisso na Agenda
                  </button>
                </form>
              </div>
            </div>

            {/* Coluna Direita (2 cols): Calendário / Lista de Compromissos */}
            <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex flex-wrap items-center justify-between gap-4 pb-4 mb-5 border-b border-slate-200">
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    {activeCalendar ? activeCalendar.name : 'Selecione uma Agenda'}
                    {activeCalendar && activeCalendar.ownerId !== user.id && (
                      <span className="text-xs px-2.5 py-0.5 bg-amber-100 text-amber-900 rounded-full font-semibold">
                        Modo Secretária (RBAC Autorizado)
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {activeCalendar?.description || 'Compromissos sincronizados com o PostgreSQL'}
                  </p>
                </div>

                <button
                  onClick={() => selectedCalendarId && loadAppointments(selectedCalendarId)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-xs font-medium flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Atualizar Agenda
                </button>
              </div>

              {appointments.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm">
                  Nenhum compromisso cadastrado nesta agenda ainda. Utilize o formulário ao lado!
                </div>
              ) : (
                <div className="space-y-3">
                  {appointments.map((appt) => {
                    const start = new Date(appt.startTime);
                    const reminder = appt.reminders?.[0];
                    return (
                      <div
                        key={appt.id}
                        className={`p-4 rounded-xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                          appt.status === 'CANCELLED'
                            ? 'bg-slate-50 border-slate-200 opacity-60'
                            : 'bg-white border-slate-200 hover:border-indigo-300'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`font-bold text-sm ${
                                appt.status === 'CANCELLED' ? 'line-through text-slate-500' : 'text-slate-900'
                              }`}
                            >
                              {appt.title}
                            </span>

                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                                appt.status === 'SCHEDULED'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {appt.status === 'SCHEDULED' ? 'AGENDADO' : 'CANCELADO'}
                            </span>

                            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono">
                              Origem: {appt.createdVia === 'WHATSAPP' ? 'TELEGRAM' : appt.createdVia}
                            </span>
                          </div>

                          {appt.description && (
                            <p className="text-xs text-slate-600">{appt.description}</p>
                          )}

                          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1">
                            <span className="flex items-center gap-1 font-medium text-slate-700">
                              <Clock className="w-3.5 h-3.5 text-indigo-600" />
                              {start.toLocaleDateString('pt-BR')} às{' '}
                              {start.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>

                            <span>Criado por: {appt.createdBy?.name || 'Usuário'}</span>

                            {reminder && (
                              <span
                                className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${
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
                            onClick={() => handleCancelAppointment(appt.id)}
                            className="self-start sm:self-center px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-xs font-medium flex items-center gap-1.5 shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Cancelar
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* =========================================================
            ABA 2: FLUXO RBAC — SECRETÁRIA ACESSANDO AGENDA DE PROFISSIONAL
           ========================================================= */}
        {activeTab === 'rbac' && (
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Painel da Secretária: Selecionar Profissional */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center gap-2.5 mb-2">
                <div className="p-2 bg-amber-100 text-amber-800 rounded-lg">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Fluxo RBAC — Visão da Secretária
                  </h2>
                  <p className="text-xs text-slate-500">
                    Selecione o profissional cuja agenda deseja gerenciar (testa autorização 200 OK vs. 403 Acesso Negado)
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-4">
                {professionals.map((prof) => (
                  <div
                    key={prof.id}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">{prof.name}</h3>
                        <p className="text-xs text-slate-500">{prof.email}</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {prof.calendars.map((cal) => (
                        <div
                          key={cal.id}
                          className="p-3 bg-white rounded-lg border border-slate-200 flex flex-wrap items-center justify-between gap-3"
                        >
                          <div>
                            <div className="text-xs font-bold text-slate-800">{cal.name}</div>
                            <div className="text-[11px] text-slate-500">{cal.description}</div>
                            <div className="mt-1">
                              {cal.hasRbacAuthorization || prof.id === user.id ? (
                                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-semibold">
                                  <ShieldCheck className="w-3.5 h-3.5" />
                                  Possui autorização RBAC ativa
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] text-red-600 font-semibold">
                                  <ShieldAlert className="w-3.5 h-3.5" />
                                  Sem delegação RBAC (Retornará 403 Forbidden)
                                </span>
                              )}
                            </div>
                          </div>

                          <button
                            onClick={() => handleSelectProfessionalCalendar(cal.id, prof.name)}
                            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition ${
                              cal.hasRbacAuthorization || prof.id === user.id
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                : 'bg-red-600 hover:bg-red-700 text-white'
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

            {/* Painel do Profissional: Delegar Acesso RBAC a uma Secretária */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-base font-bold text-slate-900 mb-1 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-600" />
                Gerenciar Delegação RBAC (Proprietário da Agenda)
              </h2>
              <p className="text-xs text-slate-500 mb-5">
                Como Profissional (ex.: Dr. João), autorize ou revogue o acesso de uma Secretária à sua agenda selecionada.
              </p>

              <form onSubmit={handleGrantSecretaryPermission} className="space-y-4 mb-6">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Agenda Selecionada
                  </label>
                  <select
                    value={selectedCalendarId}
                    onChange={(e) => setSelectedCalendarId(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                  >
                    {ownedCalendars.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.type})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    E-mail da Secretária
                  </label>
                  <input
                    type="email"
                    required
                    value={secretaryEmailToGrant}
                    onChange={(e) => setSecretaryEmailToGrant(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                  />
                </div>

                <button
                  type="submit"
                  disabled={ownedCalendars.length === 0}
                  className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-semibold text-xs rounded-lg transition"
                >
                  Conceder Permissão RBAC (Visualizar, Criar, Alterar, Cancelar)
                </button>
              </form>

              <div className="border-t border-slate-200 pt-4">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
                  Secretárias Autorizadas nas Suas Agendas
                </h3>
                {ownedCalendars.flatMap((c) =>
                  (c.permissions || []).map((p) => ({ calendar: c, perm: p })),
                ).length === 0 ? (
                  <p className="text-xs text-slate-400">
                    Nenhuma secretária delegada nas suas agendas próprias.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {ownedCalendars.map((cal) =>
                      (cal.permissions || []).map((perm) => (
                        <div
                          key={perm.id}
                          className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
                        >
                          <div>
                            <div className="font-bold text-slate-900">
                              {perm.granteeUser?.name} ({perm.granteeUser?.email})
                            </div>
                            <div className="text-[11px] text-slate-500">
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
          </div>
        )}

        {/* =========================================================
            ABA 3: FLUXO DE NOTIFICAÇÃO — WORKER + TELEGRAM
           ========================================================= */}
        {activeTab === 'worker' && (
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Controle do Worker + Fila no PostgreSQL */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                  <div>
                    <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <Bell className="w-5 h-5 text-emerald-600" />
                      Agendador / Worker de Notificações (Independente do Fluxo Principal)
                    </h2>
                    <p className="text-xs text-slate-500">
                      Consulta o PostgreSQL periodicamente, envia lembretes para Telegram e executa Retry de até 3 tentativas.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSimulateFailure}
                      className="px-3 py-2 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-semibold transition"
                    >
                      Simular Erro na API (Testar Retry 3x)
                    </button>

                    <button
                      onClick={handleRunWorkerNow}
                      className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow flex items-center gap-1.5 transition"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Executar Ciclo do Worker Agora
                    </button>
                  </div>
                </div>

                {workerStats && (
                  <div className="grid grid-cols-3 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                    <div>
                      <span className="text-slate-500 block">Ciclos Executados</span>
                      <span className="font-bold text-slate-900 text-sm">{workerStats.totalCycles}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Política de Retry</span>
                      <span className="font-bold text-slate-900 text-sm">
                        Máx. {workerStats.maxRetries} tentativas
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Última Verificação</span>
                      <span className="font-bold text-slate-900 text-sm">
                        {workerStats.lastRunAt
                          ? new Date(workerStats.lastRunAt).toLocaleTimeString('pt-BR')
                          : 'Aguardando ciclo'}
                      </span>
                    </div>
                  </div>
                )}

                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mt-6 mb-3">
                  Fila de Lembretes no PostgreSQL (Tabela `reminders`)
                </h3>

                <div className="space-y-2.5">
                  {remindersQueue.map((rem) => (
                    <div
                      key={rem.id}
                      className="p-3.5 rounded-lg border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <div className="font-bold text-slate-900">
                          {rem.appointment?.title || 'Compromisso'}
                        </div>
                        <div className="text-slate-500 text-[11px]">
                          Agenda: {rem.appointment?.calendar?.name} · Canal: <b>{rem.channel === 'WHATSAPP' || rem.channel === 'BOTH' ? 'TELEGRAM' : rem.channel}</b> ·
                          Tentativas: <b>{rem.retryCount}/3</b>
                        </div>
                        {rem.lastError && (
                          <div className="text-red-600 text-[11px] mt-1 font-medium">
                            ⚠️ Último erro: {rem.lastError}
                          </div>
                        )}
                      </div>

                      <span
                        className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
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
                  ))}
                </div>
              </div>
            </div>

            {/* Simulador de Celular Telegram recebendo os Lembretes */}
            <div className="bg-slate-900 rounded-2xl p-5 text-white shadow-xl border border-slate-800 flex flex-col">
              <div className="flex items-center gap-2.5 pb-3 mb-4 border-b border-slate-800">
                <Smartphone className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="text-sm font-bold">Celular do Usuário (Telegram)</h3>
                  <p className="text-[11px] text-slate-400">
                    Notificações entregues pelo Telegram Bot
                  </p>
                </div>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto max-h-[460px] pr-1">
                {dispatchedMessages.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 text-xs">
                    Nenhuma mensagem disparada ainda. Clique em{' '}
                    <b className="text-emerald-400">"Executar Ciclo do Worker Agora"</b> ao lado para enviar os lembretes pendentes!
                  </div>
                ) : (
                  dispatchedMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`p-3.5 rounded-xl border text-xs ${
                        msg.success
                          ? 'bg-emerald-950/70 border-emerald-700/60 text-emerald-100'
                          : 'bg-red-950/70 border-red-700/60 text-red-200'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] opacity-75 mb-1.5">
                        <span className="font-bold">
                          ✈️ Telegram → {msg.recipientName} ({msg.recipient})
                        </span>
                        <span>
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
                        <div className="mt-2 pt-1.5 border-t border-red-800 text-[11px] text-red-300 font-semibold">
                          ❌ Falha simulada: {msg.error} (Agendado Retry)
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* =========================================================
            ABA 4: CHATBOT TELEGRAM (VISÃO 100% CONVERSACIONAL)
           ========================================================= */}
        {activeTab === 'chatbot' && (
          <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-emerald-700 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <MessageSquare className="w-6 h-6" />
                <div>
                  <h2 className="text-sm font-bold">
                    Chatbot VidaEmDia — Integração Telegram
                  </h2>
                  <p className="text-xs text-emerald-100">
                    Envie uma mensagem para criar ou consultar eventos na sua agenda automaticamente
                  </p>
                </div>
              </div>
            </div>

            {/* Histórico de Mensagens */}
            <div className="p-5 bg-slate-100 h-96 overflow-y-auto space-y-3">
              {chatHistory.map((item, idx) => (
                <div
                  key={idx}
                  className={`flex ${item.sender === 'USER' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-md p-3.5 rounded-2xl text-xs shadow-sm ${
                      item.sender === 'USER'
                        ? 'bg-emerald-600 text-white rounded-br-none'
                        : 'bg-white text-slate-800 border border-slate-200 rounded-bl-none'
                    }`}
                  >
                    {item.sender === 'USER' ? (
                      <pre className="whitespace-pre-wrap font-sans leading-relaxed">{item.text}</pre>
                    ) : (
                      <div
                        className="whitespace-pre-wrap font-sans leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: sanitizeTelegramHtml(item.text) }}
                      />
                    )}
                    <div
                      className={`text-[10px] mt-1 text-right ${
                        item.sender === 'USER' ? 'text-emerald-200' : 'text-slate-400'
                      }`}
                    >
                      {item.time}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Sugestões Rápidas */}
            <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 flex flex-wrap gap-2 items-center">
              <span className="text-[11px] text-slate-500 font-semibold">Exemplos rápidos:</span>
              <button
                type="button"
                onClick={() => setBotInput('agenda')}
                className="text-[11px] px-2.5 py-1 bg-white border border-slate-300 rounded-full hover:bg-slate-100"
              >
                "agenda"
              </button>
              <button
                type="button"
                onClick={() => setBotInput('Marcar Consulta médica hoje às 08:00')}
                className="text-[11px] px-2.5 py-1 bg-white border border-slate-300 rounded-full hover:bg-slate-100"
              >
                "Marcar Consulta médica hoje às 08:00"
              </button>
              <button
                type="button"
                onClick={() => setBotInput('Agendar Reunião de Alinhamento amanhã às 15:00')}
                className="text-[11px] px-2.5 py-1 bg-white border border-slate-300 rounded-full hover:bg-slate-100"
              >
                "Agendar Reunião de Alinhamento amanhã às 15:00"
              </button>
            </div>

            {/* Input do Chat */}
            <form
              onSubmit={handleSendBotMessage}
              className="p-4 bg-white border-t border-slate-200 flex gap-2"
            >
              <input
                type="text"
                value={botInput}
                onChange={(e) => setBotInput(e.target.value)}
                placeholder="Digite uma mensagem para o bot (ex.: Marcar Dentista amanhã às 10:00)..."
                className="flex-1 px-4 py-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
              <button
                type="submit"
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition"
              >
                <Send className="w-4 h-4" />
                Enviar
              </button>
            </form>
          </div>
        )}

        {/* =========================================================
            ABA 5: AUDITORIA, SEGURANÇA & MONITORAMENTO DEVOPS
           ========================================================= */}
        {activeTab === 'auditoria' && (
          <div className="space-y-6">
            {/* Cards de Monitoramento / Healthcheck */}
            {healthData && (
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                    <span>Status Backend & PostgreSQL</span>
                    <Activity className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="text-lg font-bold text-emerald-600">{healthData.status}</div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    DB: {healthData.services?.postgresql} · Worker: {healthData.services?.notificationWorker}
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                    <span>Compromissos no Banco</span>
                    <Database className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div className="text-lg font-bold text-slate-900">
                    {healthData.databaseStats?.appointmentsCount ?? 0}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    Agendas ativas: {healthData.databaseStats?.calendarsCount ?? 0}
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                    <span>Bloqueios 403 RBAC</span>
                    <ShieldAlert className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="text-lg font-bold text-amber-600">
                    {healthData.metrics?.rbacAccessDenied ?? 0}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    Tentativas não autorizadas barradas
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                    <span>Logs de Auditoria Gravados</span>
                    <FileText className="w-4 h-4 text-purple-600" />
                  </div>
                  <div className="text-lg font-bold text-slate-900">
                    {healthData.databaseStats?.auditLogsCount ?? auditLogs.length}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    Rastreabilidade completa (Quem / Quando)
                  </div>
                </div>
              </div>
            )}

            {/* Tabela de Logs de Auditoria */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Logs de Auditoria (`audit_logs`)
                  </h2>
                  <p className="text-xs text-slate-500">
                    Registro imutável de criações, alterações, cancelamentos, logins e bloqueios RBAC (403)
                  </p>
                </div>
                <a
                  href="http://localhost:3000/metrics"
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-mono"
                >
                  Abrir /metrics (Prometheus) ↗
                </a>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 uppercase text-[11px]">
                      <th className="py-2.5 px-3">Data / Hora</th>
                      <th className="py-2.5 px-3">Ator (Quem)</th>
                      <th className="py-2.5 px-3">Ação</th>
                      <th className="py-2.5 px-3">Agenda Alvo</th>
                      <th className="py-2.5 px-3">Detalhes da Operação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 whitespace-nowrap font-mono text-[11px] text-slate-500">
                          {new Date(log.createdAt).toLocaleString('pt-BR')}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-900">
                          {log.actorUser?.name || 'Sistema'}{' '}
                          {log.actorUser?.role && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 rounded font-mono">
                              {log.actorUser.role}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                              log.action === 'ACCESS_DENIED'
                                ? 'bg-red-100 text-red-800'
                                : log.action === 'CREATE'
                                ? 'bg-emerald-100 text-emerald-800'
                                : log.action === 'CANCEL'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-indigo-100 text-indigo-800'
                            }`}
                          >
                            {log.action}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">
                          {log.targetCalendar?.name || '—'}
                        </td>
                        <td className="py-2.5 px-3 text-slate-700">{log.details}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Barra de Segurança Rodapé fiel ao Diagrama VidaEmDia_Fluxo.drawio.html */}
      <footer className="bg-slate-900 text-slate-400 text-[11px] py-3 px-4 border-t border-slate-800 text-center">
        <strong className="text-slate-200">SEGURANÇA VIDAEMDIA</strong> — HTTPS em todas as
        comunicações · JWT para autenticação · RBAC para controle de acesso · Credenciais em
        variáveis de ambiente · Logs de auditoria · Backup periódico do PostgreSQL
      </footer>
    </div>
  );
}

