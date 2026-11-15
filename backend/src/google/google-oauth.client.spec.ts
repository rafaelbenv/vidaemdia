import {
  GoogleOAuthClient,
  GoogleInvalidGrantError,
  GOOGLE_OAUTH_SCOPES,
} from './google-oauth.client';

describe('GoogleOAuthClient', () => {
  let client: GoogleOAuthClient;
  const originalEnv = { ...process.env };
  const validHexKey =
    '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      GOOGLE_CLIENT_ID: 'client-id-test',
      GOOGLE_CLIENT_SECRET: 'client-secret-test',
      GOOGLE_TOKEN_ENC_KEY: validHexKey,
      GOOGLE_REDIRECT_URI: 'http://localhost:8080/api/google/callback',
      FRONTEND_URL: 'http://localhost:8080',
    };
    client = new GoogleOAuthClient();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  describe('buildAuthUrl', () => {
    it('contém client_id, redirect_uri, access_type=offline, prompt=consent, state e os escopos de GOOGLE_OAUTH_SCOPES', () => {
      const state = 'custom-state-value-123';
      const authUrl = client.buildAuthUrl(state);

      const url = new URL(authUrl);
      expect(url.origin + url.pathname).toBe(
        'https://accounts.google.com/o/oauth2/v2/auth',
      );
      expect(url.searchParams.get('client_id')).toBe('client-id-test');
      expect(url.searchParams.get('redirect_uri')).toBe(
        'http://localhost:8080/api/google/callback',
      );
      expect(url.searchParams.get('access_type')).toBe('offline');
      expect(url.searchParams.get('prompt')).toBe('consent');
      expect(url.searchParams.get('state')).toBe('custom-state-value-123');
      expect(url.searchParams.get('scope')).toBe(GOOGLE_OAUTH_SCOPES);
      expect(url.searchParams.get('response_type')).toBe('code');
      expect(url.searchParams.get('include_granted_scopes')).toBe('true');
    });
  });

  describe('exchangeCode', () => {
    it('POST para https://oauth2.googleapis.com/token com grant_type=authorization_code e code; mapeia access_token, refresh_token, expires_in, scope, id_token', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          access_token: 'acc-token-test',
          refresh_token: 'ref-token-test',
          expires_in: 3600,
          scope: 'https://www.googleapis.com/auth/calendar.events',
          id_token: 'id-token-jwt-test',
        }),
        text: async () => '',
      } as any);

      const result = await client.exchangeCode('auth-code-123');

      expect(result).toEqual({
        accessToken: 'acc-token-test',
        refreshToken: 'ref-token-test',
        expiresIn: 3600,
        scope: 'https://www.googleapis.com/auth/calendar.events',
        idToken: 'id-token-jwt-test',
      });

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://oauth2.googleapis.com/token',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: expect.any(String),
        },
      );

      const sentBody = new URLSearchParams(
        fetchSpy.mock.calls[0][1]?.body as string,
      );
      expect(sentBody.get('grant_type')).toBe('authorization_code');
      expect(sentBody.get('code')).toBe('auth-code-123');
      expect(sentBody.get('client_id')).toBe('client-id-test');
      expect(sentBody.get('client_secret')).toBe('client-secret-test');
      expect(sentBody.get('redirect_uri')).toBe(
        'http://localhost:8080/api/google/callback',
      );
    });

    it('em erro lança Error com error_description', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: 'invalid_grant',
          error_description: 'Malformed or expired auth code',
        }),
        text: async () => '',
      } as any);

      await expect(client.exchangeCode('invalid-code')).rejects.toThrow(
        'Malformed or expired auth code',
      );
    });
  });

  describe('refreshAccessToken', () => {
    it('sucesso mapeia accessToken/expiresIn', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          access_token: 'new-refreshed-access-token',
          expires_in: 1800,
        }),
        text: async () => '',
      } as any);

      const result = await client.refreshAccessToken('my-refresh-token');

      expect(result).toEqual({
        accessToken: 'new-refreshed-access-token',
        expiresIn: 1800,
      });

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://oauth2.googleapis.com/token',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: expect.any(String),
        },
      );

      const sentBody = new URLSearchParams(
        fetchSpy.mock.calls[0][1]?.body as string,
      );
      expect(sentBody.get('grant_type')).toBe('refresh_token');
      expect(sentBody.get('refresh_token')).toBe('my-refresh-token');
      expect(sentBody.get('client_id')).toBe('client-id-test');
      expect(sentBody.get('client_secret')).toBe('client-secret-test');
    });

    it('resposta { error: "invalid_grant" } lança GoogleInvalidGrantError', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: 'invalid_grant',
          error_description: 'Token has been expired or revoked.',
        }),
        text: async () => '',
      } as any);

      await expect(
        client.refreshAccessToken('revoked-refresh-token'),
      ).rejects.toThrow(GoogleInvalidGrantError);
    });

    it('outro erro lança Error comum (e não GoogleInvalidGrantError)', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({
          error: 'internal_error',
          error_description: 'Google server error',
        }),
        text: async () => '',
      } as any);

      try {
        await client.refreshAccessToken('some-refresh-token');
        fail('Deveria ter lançado erro');
      } catch (err: any) {
        expect(err).toBeInstanceOf(Error);
        expect(err).not.toBeInstanceOf(GoogleInvalidGrantError);
        expect(err.message).toBe('Google server error');
      }
    });
  });

  describe('revoke', () => {
    it('não lança mesmo se o fetch rejeitar', async () => {
      const fetchSpy = jest
        .spyOn(global, 'fetch')
        .mockRejectedValueOnce(new Error('Network timeout'));

      await expect(client.revoke('token-to-revoke')).resolves.not.toThrow();
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://oauth2.googleapis.com/revoke?token=token-to-revoke',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );
    });
  });

  describe('emailFromIdToken', () => {
    it('lê o e-mail de um JWT montado no teste (header.payload.assinatura, payload em base64url)', () => {
      const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(
        JSON.stringify({ email: 'usuario@vidaemdia.com', sub: 'google-sub-123' }),
      ).toString('base64url');
      const jwt = `${header}.${payload}.mockSignature123`;

      const email = client.emailFromIdToken(jwt);
      expect(email).toBe('usuario@vidaemdia.com');
    });

    it('lança erro para token vazio, com menos de duas partes e sem email', () => {
      // 1. Token vazio
      expect(() => client.emailFromIdToken('')).toThrow('ID Token ausente');

      // 2. Com menos de duas partes
      expect(() => client.emailFromIdToken('tokenSemPontos')).toThrow(
        'ID Token em formato inválido',
      );

      // 3. Sem e-mail no payload
      const header = Buffer.from(JSON.stringify({ alg: 'RS256' })).toString('base64url');
      const payloadWithoutEmail = Buffer.from(
        JSON.stringify({ sub: 'google-sub-123', name: 'Usuário' }),
      ).toString('base64url');
      const jwtWithoutEmail = `${header}.${payloadWithoutEmail}.mockSignature`;

      expect(() => client.emailFromIdToken(jwtWithoutEmail)).toThrow(
        'E-mail não encontrado no ID Token',
      );
    });
  });
});
