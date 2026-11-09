import { TelegramLinkResponse, TelegramStatus, TelegramUnlinkResponse } from './types';

const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3000';

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
    let errorData: any = null;
    try {
      errorData = await response.json();
    } catch {
      // ignore json parse error
    }
    const message = Array.isArray(errorData?.message)
      ? errorData.message.join(', ')
      : errorData?.message || `Erro HTTP ${response.status}`;
    const err: any = new Error(message);
    err.status = response.status;
    throw err;
  }

  return response.json();
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
