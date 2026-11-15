import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { MetricsService } from '../monitoring/metrics.service';
import { GoogleAccountService } from '../google/google-account.service';
import { googleConfig } from '../google/google.config';
import { DeleteAccountDto } from './dto/auth.dto';

@Injectable()
export class AccountDeletionService {
  private readonly logger = new Logger(AccountDeletionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly metricsService: MetricsService,
    private readonly googleAccountService: GoogleAccountService,
  ) {}

  async deleteAccount(
    userId: string,
    dto: DeleteAccountDto,
    ipAddress?: string,
  ): Promise<{ ok: true; message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      this.metricsService.incrementAuthFailure();
      throw new BadRequestException('Senha incorreta.');
    }

    if (googleConfig().configured) {
      try {
        await this.googleAccountService.disconnect(userId);
      } catch (err: any) {
        this.logger.warn(
          `Falha ao desconectar Google do usuário ${userId}: ${err?.message || err}`,
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      const appointments = await tx.appointment.findMany({
        where: {
          createdById: userId,
          calendar: { ownerId: { not: userId } },
        },
        select: {
          id: true,
          calendar: { select: { ownerId: true } },
        },
      });

      for (const appt of appointments) {
        await tx.appointment.update({
          where: { id: appt.id },
          data: { createdById: appt.calendar.ownerId },
        });
      }

      await tx.user.delete({
        where: { id: userId },
      });
    });

    await this.auditService.log({
      entityType: 'AUTH',
      entityId: userId,
      action: 'CANCEL',
      details: 'Conta excluída pelo próprio usuário.',
      ipAddress,
    });

    return { ok: true, message: 'Conta excluída.' };
  }
}
