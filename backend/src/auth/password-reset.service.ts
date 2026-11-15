import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';
import { AuditService } from '../audit/audit.service';
import { MetricsService } from '../monitoring/metrics.service';
import { ResetPasswordDto } from './dto/auth.dto';

export const CODE_TTL_MINUTES = 15;
export const MAX_ATTEMPTS = 5;
export const RESEND_COOLDOWN_SECONDS = 60;
export const GENERIC_REQUEST_MESSAGE =
  'Se o e-mail estiver cadastrado e com o Telegram vinculado, enviamos um código pelo Telegram.';
export const INVALID_CODE_MESSAGE =
  'Código inválido ou expirado. Peça um novo código.';

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly telegramService: TelegramService,
    private readonly auditService: AuditService,
    private readonly metricsService: MetricsService,
  ) {}

  private get passwordResetCode() {
    return (this.prisma as any).passwordResetCode;
  }

  async requestCode(
    email: string,
    ipAddress?: string,
  ): Promise<{ ok: true; message: string }> {
    const normalizedEmail = (email || '').trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user || !user.telegramChatId) {
      return { ok: true, message: GENERIC_REQUEST_MESSAGE };
    }

    const cooldownThreshold = new Date(Date.now() - RESEND_COOLDOWN_SECONDS * 1000);
    const recentCode = await this.passwordResetCode.findFirst({
      where: {
        userId: user.id,
        createdAt: {
          gt: cooldownThreshold,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (recentCode) {
      return { ok: true, message: GENERIC_REQUEST_MESSAGE };
    }

    const now = new Date();
    await this.passwordResetCode.updateMany({
      where: {
        userId: user.id,
        usedAt: null,
      },
      data: {
        usedAt: now,
      },
    });

    const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(now.getTime() + CODE_TTL_MINUTES * 60 * 1000);

    await this.passwordResetCode.create({
      data: {
        userId: user.id,
        codeHash,
        expiresAt,
      },
    });

    try {
      await this.telegramService.sendMessage(
        user.telegramChatId,
        `🔐 Seu código para criar uma senha nova no VidaEmDia: <b>${code}</b>\nVale por 15 minutos. Se não foi você que pediu, ignore esta mensagem.`,
      );
    } catch (err: any) {
      this.logger.error(
        `Erro ao enviar código de recuperação via Telegram para usuário ${user.id}: ${err?.message || err}`,
      );
    }

    await this.auditService.log({
      actorUserId: user.id,
      entityType: 'AUTH',
      entityId: user.id,
      action: 'UPDATE',
      details: 'Pedido de código para recuperar a senha.',
      ipAddress,
    });

    return { ok: true, message: GENERIC_REQUEST_MESSAGE };
  }

  async resetPassword(
    dto: ResetPasswordDto,
    ipAddress?: string,
  ): Promise<{ ok: true; message: string }> {
    const normalizedEmail = (dto.email || '').trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      throw new BadRequestException(INVALID_CODE_MESSAGE);
    }

    const now = new Date();
    const resetCode = await this.passwordResetCode.findFirst({
      where: {
        userId: user.id,
        usedAt: null,
        expiresAt: {
          gt: now,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!resetCode) {
      throw new BadRequestException(INVALID_CODE_MESSAGE);
    }

    const cleanCode =
      typeof dto.code === 'string' ? dto.code.replace(/\s+/g, '') : dto.code;
    const isMatch = await bcrypt.compare(cleanCode, resetCode.codeHash);
    if (!isMatch) {
      const nextAttempts = (resetCode.attempts || 0) + 1;
      const updateData: { attempts: number; usedAt?: Date } = {
        attempts: nextAttempts,
      };
      if (nextAttempts >= MAX_ATTEMPTS) {
        updateData.usedAt = now;
      }

      await this.passwordResetCode.update({
        where: { id: resetCode.id },
        data: updateData,
      });

      this.metricsService.incrementAuthFailure();
      throw new BadRequestException(INVALID_CODE_MESSAGE);
    }

    await this.passwordResetCode.update({
      where: { id: resetCode.id },
      data: { usedAt: now },
    });

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    await this.auditService.log({
      actorUserId: user.id,
      entityType: 'AUTH',
      entityId: user.id,
      action: 'UPDATE',
      details: 'Senha redefinida com o código do Telegram.',
      ipAddress,
    });

    if (user.telegramChatId) {
      try {
        await this.telegramService.sendMessage(
          user.telegramChatId,
          '🔐 A senha da sua conta no VidaEmDia foi alterada. Se não foi você, fale com quem administra o VidaEmDia.',
        );
      } catch (err: any) {
        this.logger.error(
          `Erro ao enviar notificação de alteração de senha via Telegram para usuário ${user.id}: ${err?.message || err}`,
        );
      }
    }

    return { ok: true, message: 'Senha alterada. Entre com a senha nova.' };
  }
}
