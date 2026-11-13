import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  GoogleOAuthClient,
  GoogleInvalidGrantError,
} from './google-oauth.client';
import { googleConfig } from './google.config';
import { encryptToken, decryptToken } from './token-crypto';

export interface GoogleAccountStatus {
  configured: boolean;
  connected?: boolean;
  email?: string;
  lastError?: string | null;
}

@Injectable()
export class GoogleAccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly auditService: AuditService,
    private readonly oauthClient: GoogleOAuthClient,
  ) {}

  async status(userId: string): Promise<GoogleAccountStatus> {
    const cfg = googleConfig();
    if (!cfg.configured) {
      return { configured: false };
    }

    const account = await this.prisma.googleAccount.findUnique({
      where: { userId },
    });

    if (!account) {
      return { configured: true, connected: false };
    }

    return {
      configured: true,
      connected: true,
      email: account.googleEmail,
      lastError: account.lastError ?? null,
    };
  }

  async startConnect(userId: string): Promise<{ url: string }> {
    const cfg = googleConfig();
    if (!cfg.configured) {
      throw new ServiceUnavailableException(
        'Integração com o Google Agenda não configurada',
      );
    }

    const state = this.jwtService.sign(
      { sub: userId, purpose: 'google-oauth' },
      { expiresIn: '10m' },
    );
    const url = this.oauthClient.buildAuthUrl(state);
    return { url };
  }

  async finishConnect(code: string, state: string): Promise<string> {
    const cfg = googleConfig();
    if (!cfg.configured) {
      throw new ServiceUnavailableException(
        'Integração com o Google Agenda não configurada',
      );
    }

    let payload: any;
    try {
      payload = this.jwtService.verify(state);
    } catch {
      throw new BadRequestException('State inválido ou expirado');
    }

    if (!payload || payload.purpose !== 'google-oauth' || !payload.sub) {
      throw new BadRequestException(
        'State inválido: propósito ou identificador incorreto',
      );
    }

    const userId = payload.sub;
    const tokens = await this.oauthClient.exchangeCode(code);

    if (!tokens.refreshToken) {
      throw new BadRequestException(
        'O Google não devolveu acesso permanente; remova o VidaEmDia em myaccount.google.com/permissions e conecte de novo',
      );
    }

    const email = this.oauthClient.emailFromIdToken(tokens.idToken!);
    const refreshTokenEnc = encryptToken(tokens.refreshToken, cfg.encKey!);
    const accessTokenExpiresAt = tokens.expiresIn
      ? new Date(Date.now() + tokens.expiresIn * 1000)
      : null;

    await this.prisma.googleAccount.upsert({
      where: { userId },
      create: {
        userId,
        googleEmail: email,
        refreshTokenEnc,
        accessToken: tokens.accessToken ?? null,
        accessTokenExpiresAt,
        scope: tokens.scope ?? '',
        lastError: null,
      },
      update: {
        googleEmail: email,
        refreshTokenEnc,
        accessToken: tokens.accessToken ?? null,
        accessTokenExpiresAt,
        scope: tokens.scope ?? '',
        lastError: null,
      },
    });

    await this.auditService.log({
      actorUserId: userId,
      entityType: 'AUTH',
      action: 'UPDATE',
      details: `Google Agenda conectado (${email})`,
    });

    return userId;
  }

  async getAccessToken(userId: string): Promise<string> {
    const cfg = googleConfig();
    if (!cfg.configured) {
      throw new ServiceUnavailableException(
        'Integração com o Google Agenda não configurada',
      );
    }

    const account = await this.prisma.googleAccount.findUnique({
      where: { userId },
    });

    if (!account) {
      throw new NotFoundException('Conta do Google não vinculada');
    }

    const now = Date.now();
    if (
      account.accessToken &&
      account.accessTokenExpiresAt &&
      account.accessTokenExpiresAt.getTime() - now > 60 * 1000
    ) {
      return account.accessToken;
    }

    const refreshToken = decryptToken(account.refreshTokenEnc, cfg.encKey!);
    try {
      const renewed = await this.oauthClient.refreshAccessToken(refreshToken);
      const accessTokenExpiresAt = new Date(
        Date.now() + renewed.expiresIn * 1000,
      );

      await this.prisma.googleAccount.update({
        where: { userId },
        data: {
          accessToken: renewed.accessToken,
          accessTokenExpiresAt,
          lastError: null,
        },
      });

      return renewed.accessToken;
    } catch (err) {
      if (err instanceof GoogleInvalidGrantError) {
        await this.prisma.googleAccount.update({
          where: { userId },
          data: {
            lastError:
              'Conexão com o Google expirou ou foi revogada. Conecte de novo.',
          },
        });
      }
      throw err;
    }
  }

  async disconnect(userId: string): Promise<void> {
    const cfg = googleConfig();
    if (!cfg.configured) {
      throw new ServiceUnavailableException(
        'Integração com o Google Agenda não configurada',
      );
    }

    const account = await this.prisma.googleAccount.findUnique({
      where: { userId },
    });

    if (account) {
      if (cfg.encKey) {
        try {
          const refreshToken = decryptToken(
            account.refreshTokenEnc,
            cfg.encKey,
          );
          await this.oauthClient.revoke(refreshToken);
        } catch {
          // Ignora erro ao revogar no Google
        }
      }

      await this.prisma.googleAccount.delete({
        where: { userId },
      });

      await this.auditService.log({
        actorUserId: userId,
        entityType: 'AUTH',
        action: 'UPDATE',
        details: 'Google Agenda desconectado',
      });
    }
  }
}
