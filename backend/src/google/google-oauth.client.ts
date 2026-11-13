import { Injectable } from '@nestjs/common';
import { googleConfig } from './google.config';

export const GOOGLE_OAUTH_SCOPES =
  'openid email https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.calendarlist.readonly';

export class GoogleInvalidGrantError extends Error {
  constructor(
    message = 'Conexão com o Google expirou ou foi revogada. Conecte de novo.',
  ) {
    super(message);
    this.name = 'GoogleInvalidGrantError';
  }
}

export interface GoogleExchangeResult {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  scope?: string;
  idToken?: string;
}

export interface GoogleRefreshResult {
  accessToken: string;
  expiresIn: number;
}

@Injectable()
export class GoogleOAuthClient {
  buildAuthUrl(state: string): string {
    const cfg = googleConfig();
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', cfg.clientId || '');
    url.searchParams.set('redirect_uri', cfg.redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', GOOGLE_OAUTH_SCOPES);
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('prompt', 'consent');
    url.searchParams.set('include_granted_scopes', 'true');
    url.searchParams.set('state', state);
    return url.toString();
  }

  async exchangeCode(code: string): Promise<GoogleExchangeResult> {
    const cfg = googleConfig();
    const body = new URLSearchParams({
      code,
      client_id: cfg.clientId || '',
      client_secret: cfg.clientSecret || '',
      redirect_uri: cfg.redirectUri,
      grant_type: 'authorization_code',
    });

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!res.ok) {
      let errorMsg = `Erro HTTP ${res.status}`;
      try {
        const data = await res.json();
        errorMsg = data.error_description || data.error || errorMsg;
      } catch {
        const text = await res.text();
        if (text) errorMsg = text;
      }
      throw new Error(errorMsg);
    }

    const data = (await res.json()) as any;
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      scope: data.scope,
      idToken: data.id_token,
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<GoogleRefreshResult> {
    const cfg = googleConfig();
    const body = new URLSearchParams({
      client_id: cfg.clientId || '',
      client_secret: cfg.clientSecret || '',
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!res.ok) {
      let errorMsg = `Erro HTTP ${res.status}`;
      let errorType = '';
      try {
        const data = await res.json();
        errorType = data.error || '';
        errorMsg = data.error_description || data.error || errorMsg;
      } catch {
        const text = await res.text();
        if (text) errorMsg = text;
      }

      if (errorType === 'invalid_grant' || errorMsg.includes('invalid_grant')) {
        throw new GoogleInvalidGrantError(errorMsg);
      }
      throw new Error(errorMsg);
    }

    const data = (await res.json()) as any;
    return {
      accessToken: data.access_token,
      expiresIn: data.expires_in,
    };
  }

  async revoke(token: string): Promise<void> {
    try {
      await fetch(
        `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );
    } catch {
      // Ignora erros ao revogar
    }
  }

  emailFromIdToken(idToken: string): string {
    if (!idToken) {
      throw new Error('ID Token ausente');
    }
    const parts = idToken.split('.');
    if (parts.length < 2) {
      throw new Error('ID Token em formato inválido');
    }
    const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf8');
    const payload = JSON.parse(payloadJson);
    if (!payload.email) {
      throw new Error('E-mail não encontrado no ID Token');
    }
    return payload.email;
  }
}
