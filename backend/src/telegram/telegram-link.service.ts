import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

export type ConsumeResult =
  | { ok: true; userName: string; reason?: string }
  | { ok: false; reason: string; userName?: string };

@Injectable()
export class TelegramLinkService {
  private readonly logger = new Logger(TelegramLinkService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Gera um código temporário de vínculo e retorna a URL direta para o bot.
   */
  async createLink(userId: string): Promise<{ url: string; expiresAt: Date }> {
    const rawBotUsername = process.env.TELEGRAM_BOT_USERNAME?.trim();
    if (!rawBotUsername) {
      throw new ServiceUnavailableException(
        'Vínculo com o Telegram indisponível: nome de usuário do bot (TELEGRAM_BOT_USERNAME) não configurado.',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    // Código aleatório seguro de 32 caracteres hexadecimais
    const code = crypto.randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos

    await this.prisma.telegramLinkToken.create({
      data: {
        code,
        userId,
        expiresAt,
      },
    });

    const botUsername = rawBotUsername.startsWith('@')
      ? rawBotUsername.slice(1)
      : rawBotUsername;
    const url = `https://t.me/${botUsername}?start=${code}`;

    return {
      url,
      expiresAt,
    };
  }

  /**
   * Consome o código de vinculação recebido pelo bot (/start <codigo>)
   * e associa o chat_id ao usuário de forma atômica e segura.
   */
  async consume(code: string, chatId: string): Promise<ConsumeResult> {
    const cleanCode = (code || '').trim();
    const cleanChatId = String(chatId || '').trim();

    if (!cleanCode) {
      return { ok: false, reason: 'Código de vinculação ausente ou inválido.' };
    }

    if (!cleanChatId) {
      return { ok: false, reason: 'Identificador do chat do Telegram ausente ou inválido.' };
    }

    const token = await this.prisma.telegramLinkToken.findUnique({
      where: { code: cleanCode },
      include: { user: true },
    });

    if (!token) {
      return { ok: false, reason: 'Código de vinculação inexistente ou inválido.' };
    }

    if (token.usedAt) {
      return { ok: false, reason: 'Este código de vinculação já foi utilizado.' };
    }

    if (new Date() > token.expiresAt) {
      return { ok: false, reason: 'Este código de vinculação expirou. Gere um novo link no sistema.' };
    }

    if (!token.user) {
      return { ok: false, reason: 'Usuário correspondente ao código não encontrado.' };
    }

    const targetUserId = token.userId;
    const userName = token.user.name;

    try {
      await this.prisma.$transaction(async (tx) => {
        // Checagem de concorrência com atualização condicional
        const updatedToken = await tx.telegramLinkToken.updateMany({
          where: {
            id: token.id,
            usedAt: null,
          },
          data: {
            usedAt: new Date(),
          },
        });

        if (updatedToken.count === 0) {
          throw new Error('TOKEN_ALREADY_USED');
        }

        // Se outro usuário já tiver esse chatId, desvincula antes para manter unicidade
        await tx.user.updateMany({
          where: {
            telegramChatId: cleanChatId,
            NOT: { id: targetUserId },
          },
          data: {
            telegramChatId: null,
          },
        });

        // Grava user.telegramChatId = chat.id
        await tx.user.update({
          where: { id: targetUserId },
          data: {
            telegramChatId: cleanChatId,
          },
        });
      });

      // Grava audit log
      await this.auditService.log({
        actorUserId: targetUserId,
        entityType: 'AUTH',
        entityId: targetUserId,
        action: 'TELEGRAM_LINK' as any,
        details: `Conta vinculada ao Telegram (chatId: ${cleanChatId}) pelo usuário ${userName}.`,
      });

      return { ok: true, userName };
    } catch (err: any) {
      if (err?.message === 'TOKEN_ALREADY_USED') {
        return { ok: false, reason: 'Este código de vinculação já foi utilizado.' };
      }
      this.logger.error(`Erro ao vincular conta no Telegram: ${err?.message || err}`);
      return { ok: false, reason: 'Erro interno ao processar o vínculo. Tente novamente.' };
    }
  }

  /**
   * Remove o vínculo com o Telegram (zera telegramChatId).
   */
  async unlink(userId: string): Promise<{ ok: boolean; message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { telegramChatId: null },
    });

    await this.auditService.log({
      actorUserId: userId,
      entityType: 'AUTH',
      entityId: userId,
      action: 'TELEGRAM_UNLINK' as any,
      details: `Vínculo com o Telegram removido pelo usuário ${user.name}.`,
    });

    return { ok: true, message: 'Vínculo com o Telegram desfeito com sucesso.' };
  }

  /**
   * Retorna se a conta está vinculada e o botUsername configurado.
   */
  async getStatus(userId: string): Promise<{ linked: boolean; botUsername: string | null }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { telegramChatId: true },
    });

    const rawBotUsername = process.env.TELEGRAM_BOT_USERNAME?.trim() || null;
    const botUsername = rawBotUsername
      ? (rawBotUsername.startsWith('@') ? rawBotUsername.slice(1) : rawBotUsername)
      : null;

    return {
      linked: Boolean(user?.telegramChatId),
      botUsername,
    };
  }
}
