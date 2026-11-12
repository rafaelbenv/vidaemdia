import {
  Appointment,
  AuditLogEntry,
  BotMessageBody,
  Calendar,
  CreateAppointmentBody,
  GrantPermissionBody,
  GrantPermissionResponse,
  HealthData,
  NotificationsStatus,
  ProfessionalDirectoryEntry,
  RunWorkerResponse,
  SimulateFailureBody,
  SimulateFailureResponse,
  TelegramLinkResponse,
  TelegramStatus,
  TelegramUnlinkResponse,
  UpdateAppointmentBody,
  User,
  VerifyAccessResponse,
} from './types';

export class ApiError extends Error {
  constructor(message: string, public readonly status: number, public readonly body: unknown) {
    super(message);
    this.name = 'ApiError';
  }
}

export function errorStatus(err: unknown): number | undefined {
  return err instanceof ApiError ? err.status : undefined;
}

export function errorMessage(err: unknown, fallback = 'Erro inesperado'): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

// Em produção o nginx encaminha /api para o backend; no dev, o proxy do Vite faz o mesmo.
// VITE_API_URL só é necessário para apontar o front de dev para outro backend.
export const API_BASE_URL: string = import.meta.env.VITE_API_URL || '/api';

let unauthorizedHandler: (() => void) | null = null;
export function setUnauthorizedHandler(fn: (() => void) | null) {
  unauthorizedHandler = fn;
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    if (response.status === 401 && token) {
      unauthorizedHandler?.();
    }
    let errorData: unknown = null;
    try {
      errorData = await response.json();
    } catch {
      // ignore json parse error
    }
    let messageText: string | undefined;
    if (typeof errorData === 'object' && errorData !== null && 'message' in errorData) {
      const msg = (errorData as { message: unknown }).message;
      if (Array.isArray(msg)) {
        messageText = msg.join(', ');
      } else if (typeof msg === 'string') {
        messageText = msg;
      }
    }
    const message = messageText || `Erro HTTP ${response.status}`;
    throw new ApiError(message, response.status, errorData);
  }

  return response.json();
}

export async function login(
  email: string,
  password: string,
): Promise<{ accessToken: string; user: User }> {
  return apiRequest<{ accessToken: string; user: User }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function getMe(token: string): Promise<User> {
  return apiRequest<User>('/auth/me', {}, token);
}

export async function getCalendars(
  token: string,
): Promise<{ owned: Calendar[]; delegated: Calendar[] }> {
  return apiRequest<{ owned: Calendar[]; delegated: Calendar[] }>('/agendas', {}, token);
}

export async function getProfessionals(token: string): Promise<ProfessionalDirectoryEntry[]> {
  return apiRequest<ProfessionalDirectoryEntry[]>('/agendas/profissionais', {}, token);
}

export async function getAuditLogs(token: string): Promise<AuditLogEntry[]> {
  return apiRequest<AuditLogEntry[]>('/auditoria', {}, token);
}

export async function getNotificationsStatus(token: string): Promise<NotificationsStatus> {
  return apiRequest<NotificationsStatus>('/notificacoes/status', {}, token);
}

export async function getHealth(token: string): Promise<HealthData> {
  return apiRequest<HealthData>('/health', {}, token);
}

export async function getAppointments(token: string, calendarId: string): Promise<Appointment[]> {
  return apiRequest<Appointment[]>(`/compromissos?calendarId=${calendarId}`, {}, token);
}

export async function createAppointment(
  token: string,
  body: CreateAppointmentBody,
): Promise<Appointment> {
  return apiRequest<Appointment>(
    '/compromissos',
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
    token,
  );
}

export async function updateAppointment(
  token: string,
  id: string,
  body: UpdateAppointmentBody,
): Promise<Appointment> {
  return apiRequest<Appointment>(
    `/compromissos/${id}`,
    {
      method: 'PATCH',
      body: JSON.stringify(body),
    },
    token,
  );
}

export async function cancelAppointment(token: string, id: string): Promise<Appointment> {
  return apiRequest<Appointment>(`/compromissos/${id}`, { method: 'DELETE' }, token);
}

export async function verifyCalendarAccess(
  token: string,
  calendarId: string,
): Promise<VerifyAccessResponse> {
  return apiRequest<VerifyAccessResponse>(`/agendas/${calendarId}/verificar-acesso`, {}, token);
}

export async function grantPermission(
  token: string,
  calendarId: string,
  body: GrantPermissionBody,
): Promise<GrantPermissionResponse> {
  return apiRequest<GrantPermissionResponse>(
    `/agendas/${calendarId}/permissoes`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
    token,
  );
}

export async function runWorkerNow(token: string): Promise<RunWorkerResponse> {
  return apiRequest<RunWorkerResponse>('/notificacoes/executar-worker', { method: 'POST' }, token);
}

export async function simulateFailure(
  token: string,
  body: SimulateFailureBody = { failCount: 1 },
): Promise<SimulateFailureResponse> {
  return apiRequest<SimulateFailureResponse>(
    '/notificacoes/simular-falha',
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
    token,
  );
}

export async function sendBotMessage(
  token: string,
  body: BotMessageBody,
): Promise<{ botReply: string }> {
  return apiRequest<{ botReply: string }>(
    '/notificacoes/bot/webhook',
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
    token,
  );
}

export async function getTelegramStatus(token: string): Promise<TelegramStatus> {
  return apiRequest<TelegramStatus>('/telegram/status', {}, token);
}

export async function createTelegramLink(token: string): Promise<TelegramLinkResponse> {
  return apiRequest<TelegramLinkResponse>('/telegram/link', { method: 'POST' }, token);
}

export async function unlinkTelegram(token: string): Promise<TelegramUnlinkResponse> {
  return apiRequest<TelegramUnlinkResponse>('/telegram/link', { method: 'DELETE' }, token);
}
