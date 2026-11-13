import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  GoogleAccountService,
} from './google-account.service';
import {
  GoogleOAuthClient,
  GoogleInvalidGrantError,
} from './google-oauth.client';
import { googleConfig } from './google.config';
import { encryptToken, decryptToken } from './token-crypto';

describe('GoogleAccountService', () => {
  let service: GoogleAccountService;
  let mockPrisma: any;
  let mockJwtService: any;
  let mockAuditService: any;
  let mockOAuthClient: any;

  const originalEnv = { ...process.env };
  const validHexKey =
    '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      GOOGLE_CLIENT_ID: 'google-client-id-test',
      GOOGLE_CLIENT_SECRET: 'google-client-secret-test',
      GOOGLE_TOKEN_ENC_KEY: validHexKey,
      GOOGLE_REDIRECT_URI: 'http://localhost:8080/api/google/callback',
      FRONTEND_URL: 'http://localhost:8080',
    };

    mockPrisma = {
      googleAccount: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    mockJwtService = {
      sign: jest.fn(),
      verify: jest.fn(),
    };

    mockAuditService = {
      log: jest.fn().mockResolvedValue({ id: 'audit-1' }),
    };

    mockOAuthClient = {
      buildAuthUrl: jest.fn(),
      exchangeCode: jest.fn(),
      refreshAccessToken: jest.fn(),
      revoke: jest.fn().mockResolvedValue(undefined),
      emailFromIdToken: jest.fn(),
    };

    service = new GoogleAccountService(
      mockPrisma as unknown as PrismaService,
      mockJwtService as unknown as JwtService,
      mockAuditService as unknown as AuditService,
      mockOAuthClient as unknown as GoogleOAuthClient,
    );
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('status', () => {
    it('com integração não configurada devolve configured: false', async () => {
      delete process.env.GOOGLE_CLIENT_ID;
      const result = await service.status('user-1');
      expect(result).toEqual({ configured: false });
    });

    it('com integração configurada mas sem conta devolve configured: true e connected: false', async () => {
      mockPrisma.googleAccount.findUnique.mockResolvedValue(null);
      const result = await service.status('user-1');
      expect(result).toEqual({ configured: true, connected: false });
    });

    it('com conta conectada devolve configured: true, connected: true, email e lastError', async () => {
      mockPrisma.googleAccount.findUnique.mockResolvedValue({
        googleEmail: 'teste@gmail.com',
        lastError: null,
      });
      const result = await service.status('user-1');
      expect(result).toEqual({
        configured: true,
        connected: true,
        email: 'teste@gmail.com',
        lastError: null,
      });
    });
  });

  describe('startConnect', () => {
    it('gera URL com state', async () => {
      mockJwtService.sign.mockReturnValue('state-jwt-123');
      mockOAuthClient.buildAuthUrl.mockReturnValue(
        'https://accounts.google.com/o/oauth2/v2/auth?state=state-jwt-123',
      );

      const result = await service.startConnect('user-1');

      expect(mockJwtService.sign).toHaveBeenCalledWith(
        { sub: 'user-1', purpose: 'google-oauth' },
        { expiresIn: '10m' },
      );
      expect(mockOAuthClient.buildAuthUrl).toHaveBeenCalledWith('state-jwt-123');
      expect(result).toEqual({
        url: 'https://accounts.google.com/o/oauth2/v2/auth?state=state-jwt-123',
      });
    });

    it('lança 503 se a integração não estiver configurada', async () => {
      delete process.env.GOOGLE_CLIENT_ID;
      await expect(service.startConnect('user-1')).rejects.toThrow();
    });
  });

  describe('finishConnect', () => {
    it('com state inválido ou expirado lança erro', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('jwt expired');
      });

      await expect(
        service.finishConnect('code-123', 'expired-state'),
      ).rejects.toThrow();
    });

    it('com state de outro propósito lança erro', async () => {
      mockJwtService.verify.mockReturnValue({
        sub: 'user-1',
        purpose: 'outro-proposito',
      });

      await expect(
        service.finishConnect('code-123', 'wrong-purpose'),
      ).rejects.toThrow();
    });

    it('com state sem sub lança erro', async () => {
      mockJwtService.verify.mockReturnValue({
        purpose: 'google-oauth',
      });

      await expect(
        service.finishConnect('code-123', 'no-sub'),
      ).rejects.toThrow();
    });

    it('sem refreshToken lança a mensagem combinada', async () => {
      mockJwtService.verify.mockReturnValue({
        sub: 'user-1',
        purpose: 'google-oauth',
      });
      mockOAuthClient.exchangeCode.mockResolvedValue({
        accessToken: 'access-token-123',
        refreshToken: undefined,
      });

      await expect(
        service.finishConnect('code-123', 'valid-state'),
      ).rejects.toThrow(
        'O Google não devolveu acesso permanente; remova o VidaEmDia em myaccount.google.com/permissions e conecte de novo',
      );
    });

    it('sucesso faz upsert com token criptografado (não igual ao original) e grava auditoria', async () => {
      const rawRefreshToken = 'refresh-secret-xyz';
      mockJwtService.verify.mockReturnValue({
        sub: 'user-1',
        purpose: 'google-oauth',
      });
      mockOAuthClient.exchangeCode.mockResolvedValue({
        accessToken: 'access-token-123',
        refreshToken: rawRefreshToken,
        expiresIn: 3600,
        scope: 'openid email calendar',
        idToken: 'header.payload.sig',
      });
      mockOAuthClient.emailFromIdToken.mockReturnValue('usuario@gmail.com');
      mockPrisma.googleAccount.upsert.mockResolvedValue({ id: 'acc-1' });

      const returnedUserId = await service.finishConnect(
        'code-123',
        'valid-state',
      );

      expect(returnedUserId).toBe('user-1');
      expect(mockPrisma.googleAccount.upsert).toHaveBeenCalledTimes(1);

      const upsertArgs = mockPrisma.googleAccount.upsert.mock.calls[0][0];
      expect(upsertArgs.where).toEqual({ userId: 'user-1' });

      const encToken = upsertArgs.create.refreshTokenEnc;
      expect(encToken).toBeDefined();
      expect(encToken).not.toBe(rawRefreshToken);

      const key = Buffer.from(validHexKey, 'hex');
      expect(decryptToken(encToken, key)).toBe(rawRefreshToken);

      expect(upsertArgs.create.googleEmail).toBe('usuario@gmail.com');
      expect(upsertArgs.create.lastError).toBeNull();

      expect(mockAuditService.log).toHaveBeenCalledWith({
        actorUserId: 'user-1',
        entityType: 'AUTH',
        action: 'UPDATE',
        details: 'Google Agenda conectado (usuario@gmail.com)',
      });
    });
  });

  describe('getAccessToken', () => {
    it('reaproveita token válido se faltar mais de 60 s para expirar', async () => {
      const futureDate = new Date(Date.now() + 10 * 60 * 1000);
      mockPrisma.googleAccount.findUnique.mockResolvedValue({
        userId: 'user-1',
        accessToken: 'cached-valid-token',
        accessTokenExpiresAt: futureDate,
        refreshTokenEnc: encryptToken(
          'refresh-val',
          Buffer.from(validHexKey, 'hex'),
        ),
      });

      const token = await service.getAccessToken('user-1');

      expect(token).toBe('cached-valid-token');
      expect(mockOAuthClient.refreshAccessToken).not.toHaveBeenCalled();
    });

    it('renova o token vencido ou com menos de 60 s para expirar', async () => {
      const nearExpired = new Date(Date.now() + 30 * 1000);
      const key = Buffer.from(validHexKey, 'hex');
      mockPrisma.googleAccount.findUnique.mockResolvedValue({
        userId: 'user-1',
        accessToken: 'old-access-token',
        accessTokenExpiresAt: nearExpired,
        refreshTokenEnc: encryptToken('refresh-to-renew', key),
      });
      mockOAuthClient.refreshAccessToken.mockResolvedValue({
        accessToken: 'renewed-access-token',
        expiresIn: 3600,
      });
      mockPrisma.googleAccount.update.mockResolvedValue({});

      const token = await service.getAccessToken('user-1');

      expect(token).toBe('renewed-access-token');
      expect(mockOAuthClient.refreshAccessToken).toHaveBeenCalledWith(
        'refresh-to-renew',
      );
      expect(mockPrisma.googleAccount.update).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: expect.objectContaining({
          accessToken: 'renewed-access-token',
          lastError: null,
        }),
      });
    });

    it('invalid_grant grava lastError e relança o erro', async () => {
      const expired = new Date(Date.now() - 60 * 1000);
      const key = Buffer.from(validHexKey, 'hex');
      mockPrisma.googleAccount.findUnique.mockResolvedValue({
        userId: 'user-1',
        accessToken: 'expired-access-token',
        accessTokenExpiresAt: expired,
        refreshTokenEnc: encryptToken('refresh-invalid', key),
      });
      mockOAuthClient.refreshAccessToken.mockRejectedValue(
        new GoogleInvalidGrantError('invalid_grant'),
      );
      mockPrisma.googleAccount.update.mockResolvedValue({});

      await expect(service.getAccessToken('user-1')).rejects.toThrow(
        GoogleInvalidGrantError,
      );

      expect(mockPrisma.googleAccount.update).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: {
          lastError:
            'Conexão com o Google expirou ou foi revogada. Conecte de novo.',
        },
      });
    });
  });

  describe('disconnect', () => {
    it('apaga o registro, tenta revogar token e grava auditoria', async () => {
      const key = Buffer.from(validHexKey, 'hex');
      mockPrisma.googleAccount.findUnique.mockResolvedValue({
        userId: 'user-1',
        refreshTokenEnc: encryptToken('refresh-to-revoke', key),
      });
      mockPrisma.googleAccount.delete.mockResolvedValue({});

      await service.disconnect('user-1');

      expect(mockOAuthClient.revoke).toHaveBeenCalledWith(
        'refresh-to-revoke',
      );
      expect(mockPrisma.googleAccount.delete).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
      expect(mockAuditService.log).toHaveBeenCalledWith({
        actorUserId: 'user-1',
        entityType: 'AUTH',
        action: 'UPDATE',
        details: 'Google Agenda desconectado',
      });
    });
  });

  describe('googleConfig', () => {
    it('lança erro se GOOGLE_TOKEN_ENC_KEY estiver ausente quando configurado', () => {
      delete process.env.GOOGLE_TOKEN_ENC_KEY;
      expect(() => googleConfig()).toThrow(
        'GOOGLE_TOKEN_ENC_KEY inválida: use 64 caracteres hexadecimais (openssl rand -hex 32).',
      );
    });

    it('lança erro se GOOGLE_TOKEN_ENC_KEY não possuir 64 caracteres hex', () => {
      process.env.GOOGLE_TOKEN_ENC_KEY = 'invalid-short-key';
      expect(() => googleConfig()).toThrow(
        'GOOGLE_TOKEN_ENC_KEY inválida: use 64 caracteres hexadecimais (openssl rand -hex 32).',
      );
    });

    it('retorna configured: false sem lançar erro quando credenciais do Google estiverem ausentes', () => {
      delete process.env.GOOGLE_CLIENT_ID;
      delete process.env.GOOGLE_TOKEN_ENC_KEY;
      const cfg = googleConfig();
      expect(cfg.configured).toBe(false);
      expect(cfg.encKey).toBeNull();
    });
  });
});
