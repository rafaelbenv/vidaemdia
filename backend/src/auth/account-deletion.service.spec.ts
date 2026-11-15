import { BadRequestException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AccountDeletionService } from './account-deletion.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { MetricsService } from '../monitoring/metrics.service';
import { GoogleAccountService } from '../google/google-account.service';
import { googleConfig } from '../google/google.config';

jest.mock('../google/google.config', () => ({
  googleConfig: jest.fn(),
}));

describe('AccountDeletionService', () => {
  let service: AccountDeletionService;
  let mockPrisma: any;
  let mockAuditService: any;
  let mockMetricsService: any;
  let mockGoogleAccountService: any;
  let validPasswordHash: string;

  beforeAll(async () => {
    validPasswordHash = await bcrypt.hash('123456', 4);
  });

  beforeEach(() => {
    (googleConfig as jest.Mock).mockReturnValue({ configured: true });

    mockPrisma = {
      user: {
        findUnique: jest.fn(),
        delete: jest.fn(),
      },
      appointment: {
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn(),
      },
      $transaction: jest.fn(async (cb) => cb(mockPrisma)),
    };

    mockAuditService = {
      log: jest.fn().mockResolvedValue({ id: 'log-1' }),
    };

    mockMetricsService = {
      incrementAuthFailure: jest.fn(),
    };

    mockGoogleAccountService = {
      disconnect: jest.fn().mockResolvedValue(undefined),
    };

    service = new AccountDeletionService(
      mockPrisma as unknown as PrismaService,
      mockAuditService as unknown as AuditService,
      mockMetricsService as unknown as MetricsService,
      mockGoogleAccountService as unknown as GoogleAccountService,
    );
  });

  it('lança NotFoundException se o usuário não existir', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.deleteAccount('user-inexistente', { password: '123456' }),
    ).rejects.toThrow(NotFoundException);

    expect(mockMetricsService.incrementAuthFailure).not.toHaveBeenCalled();
    expect(mockPrisma.user.delete).not.toHaveBeenCalled();
  });

  it('senha errada → BadRequestException, incrementAuthFailure chamado, nada apagado', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'carlos@vidaemdia.com.br',
      name: 'Carlos Silva',
      passwordHash: validPasswordHash,
    });

    await expect(
      service.deleteAccount('u1', { password: 'senha-errada' }),
    ).rejects.toThrow(BadRequestException);

    expect(mockMetricsService.incrementAuthFailure).toHaveBeenCalledTimes(1);
    expect(mockGoogleAccountService.disconnect).not.toHaveBeenCalled();
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(mockPrisma.user.delete).not.toHaveBeenCalled();
  });

  it('sucesso → user.delete chamado com o id; compromissos em agendas de outros donos recebem o createdById do dono; auditoria com "Conta excluída pelo próprio usuário." e sem o e-mail nem o nome', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'carlos@vidaemdia.com.br',
      name: 'Carlos Silva',
      passwordHash: validPasswordHash,
    });

    mockPrisma.appointment.findMany.mockResolvedValue([
      {
        id: 'appt-1',
        calendar: { ownerId: 'dono-outro' },
      },
      {
        id: 'appt-2',
        calendar: { ownerId: 'dono-outro-2' },
      },
    ]);

    const res = await service.deleteAccount(
      'u1',
      { password: '123456' },
      '192.168.1.10',
    );

    expect(res).toEqual({ ok: true, message: 'Conta excluída.' });
    expect(mockGoogleAccountService.disconnect).toHaveBeenCalledWith('u1');
    expect(mockPrisma.$transaction).toHaveBeenCalled();
    expect(mockPrisma.appointment.findMany).toHaveBeenCalledWith({
      where: {
        createdById: 'u1',
        calendar: { ownerId: { not: 'u1' } },
      },
      select: {
        id: true,
        calendar: { select: { ownerId: true } },
      },
    });
    expect(mockPrisma.appointment.update).toHaveBeenCalledWith({
      where: { id: 'appt-1' },
      data: { createdById: 'dono-outro' },
    });
    expect(mockPrisma.appointment.update).toHaveBeenCalledWith({
      where: { id: 'appt-2' },
      data: { createdById: 'dono-outro-2' },
    });
    expect(mockPrisma.user.delete).toHaveBeenCalledWith({
      where: { id: 'u1' },
    });

    expect(mockAuditService.log).toHaveBeenCalledWith({
      entityType: 'AUTH',
      entityId: 'u1',
      action: 'CANCEL',
      details: 'Conta excluída pelo próprio usuário.',
      ipAddress: '192.168.1.10',
    });

    const auditCallArg = mockAuditService.log.mock.calls[0][0];
    expect(auditCallArg.details).toBe('Conta excluída pelo próprio usuário.');
    expect(auditCallArg.actorUserId).toBeUndefined();
    expect(JSON.stringify(auditCallArg)).not.toContain('carlos@vidaemdia.com.br');
    expect(JSON.stringify(auditCallArg)).not.toContain('Carlos Silva');
  });

  it('Google configurado → disconnect chamado; se disconnect lançar, a conta é excluída mesmo assim', async () => {
    (googleConfig as jest.Mock).mockReturnValue({ configured: true });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'carlos@vidaemdia.com.br',
      name: 'Carlos Silva',
      passwordHash: validPasswordHash,
    });
    mockGoogleAccountService.disconnect.mockRejectedValue(
      new Error('Erro no Google'),
    );

    const res = await service.deleteAccount('u1', { password: '123456' });

    expect(res).toEqual({ ok: true, message: 'Conta excluída.' });
    expect(mockGoogleAccountService.disconnect).toHaveBeenCalledWith('u1');
    expect(mockPrisma.user.delete).toHaveBeenCalledWith({
      where: { id: 'u1' },
    });
  });

  it('Google não configurado → disconnect não chamado', async () => {
    (googleConfig as jest.Mock).mockReturnValue({ configured: false });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'carlos@vidaemdia.com.br',
      name: 'Carlos Silva',
      passwordHash: validPasswordHash,
    });

    const res = await service.deleteAccount('u1', { password: '123456' });

    expect(res).toEqual({ ok: true, message: 'Conta excluída.' });
    expect(mockGoogleAccountService.disconnect).not.toHaveBeenCalled();
    expect(mockPrisma.user.delete).toHaveBeenCalledWith({
      where: { id: 'u1' },
    });
  });
});
