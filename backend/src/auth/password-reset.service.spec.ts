import { BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import {
  PasswordResetService,
  GENERIC_REQUEST_MESSAGE,
  INVALID_CODE_MESSAGE,
} from './password-reset.service';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';
import { AuditService } from '../audit/audit.service';
import { MetricsService } from '../monitoring/metrics.service';

describe('PasswordResetService', () => {
  let service: PasswordResetService;
  let mockPrisma: any;
  let mockTelegramService: any;
  let mockAuditService: any;
  let mockMetricsService: any;

  beforeEach(() => {
    mockPrisma = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      passwordResetCode: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    mockTelegramService = {
      sendMessage: jest.fn().mockResolvedValue({ ok: true, result: null }),
    };

    mockAuditService = {
      log: jest.fn().mockResolvedValue({ id: 'log-1' }),
    };

    mockMetricsService = {
      incrementAuthFailure: jest.fn(),
    };

    service = new PasswordResetService(
      mockPrisma as unknown as PrismaService,
      mockTelegramService as unknown as TelegramService,
      mockAuditService as unknown as AuditService,
      mockMetricsService as unknown as MetricsService,
    );
  });

  describe('requestCode', () => {
    it('e-mail sem conta → resposta genérica, sem gravar código e sem enviar', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await service.requestCode('inexistente@vidaemdia.com.br', '192.168.1.1');

      expect(result).toEqual({ ok: true, message: GENERIC_REQUEST_MESSAGE });
      expect(mockPrisma.passwordResetCode.create).not.toHaveBeenCalled();
      expect(mockTelegramService.sendMessage).not.toHaveBeenCalled();
      expect(mockAuditService.log).not.toHaveBeenCalled();
    });

    it('conta sem Telegram → resposta genérica, sem enviar', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'user@vidaemdia.com.br',
        telegramChatId: null,
      });

      const result = await service.requestCode('user@vidaemdia.com.br');

      expect(result).toEqual({ ok: true, message: GENERIC_REQUEST_MESSAGE });
      expect(mockPrisma.passwordResetCode.create).not.toHaveBeenCalled();
      expect(mockTelegramService.sendMessage).not.toHaveBeenCalled();
      expect(mockAuditService.log).not.toHaveBeenCalled();
    });

    it('conta com Telegram → grava um código, invalida os anteriores, e a mensagem contém 15 minutos', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'user@vidaemdia.com.br',
        telegramChatId: '987654321',
      });
      mockPrisma.passwordResetCode.findFirst.mockResolvedValue(null);
      mockPrisma.passwordResetCode.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.passwordResetCode.create.mockResolvedValue({ id: 'c1' });

      const result = await service.requestCode('user@vidaemdia.com.br', '127.0.0.1');

      expect(result).toEqual({ ok: true, message: GENERIC_REQUEST_MESSAGE });

      // Invalida os anteriores
      expect(mockPrisma.passwordResetCode.updateMany).toHaveBeenCalledWith({
        where: { userId: 'u1', usedAt: null },
        data: { usedAt: expect.any(Date) },
      });

      // A mensagem contém 15 minutos
      expect(mockTelegramService.sendMessage).toHaveBeenCalledWith(
        '987654321',
        expect.stringContaining('15 minutos'),
      );

      // Extrair os 6 números do texto passado ao sendMessage
      const sentText: string = mockTelegramService.sendMessage.mock.calls[0][1];
      const match = sentText.match(/(\d{6})/);
      expect(match).not.toBeNull();
      const code = match![1];

      // O hash confere com o código enviado na mensagem
      expect(mockPrisma.passwordResetCode.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'u1',
          codeHash: expect.any(String),
          expiresAt: expect.any(Date),
        }),
      });
      const createdData = mockPrisma.passwordResetCode.create.mock.calls[0][0].data;
      const isMatch = await bcrypt.compare(code, createdData.codeHash);
      expect(isMatch).toBe(true);

      // Auditoria
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'AUTH',
          entityId: 'u1',
          actorUserId: 'u1',
          action: 'UPDATE',
          details: 'Pedido de código para recuperar a senha.',
          ipAddress: '127.0.0.1',
        }),
      );
    });

    it('segundo pedido em menos de 60 s não envia de novo', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'user@vidaemdia.com.br',
        telegramChatId: '987654321',
      });
      mockPrisma.passwordResetCode.findFirst.mockResolvedValue({
        id: 'c-recent',
        userId: 'u1',
        createdAt: new Date(),
      });

      const result = await service.requestCode('user@vidaemdia.com.br');

      expect(result).toEqual({ ok: true, message: GENERIC_REQUEST_MESSAGE });
      expect(mockPrisma.passwordResetCode.create).not.toHaveBeenCalled();
      expect(mockTelegramService.sendMessage).not.toHaveBeenCalled();
    });

    it('falha no sendMessage não muda a resposta', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'user@vidaemdia.com.br',
        telegramChatId: '987654321',
      });
      mockPrisma.passwordResetCode.findFirst.mockResolvedValue(null);
      mockTelegramService.sendMessage.mockRejectedValue(new Error('Falha de rede'));

      const result = await service.requestCode('user@vidaemdia.com.br');

      expect(result).toEqual({ ok: true, message: GENERIC_REQUEST_MESSAGE });
      expect(mockAuditService.log).toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('deve lançar BadRequestException quando o usuário não existir', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.resetPassword({
          email: 'inexistente@vidaemdia.com.br',
          code: '123456',
          newPassword: 'novaSenhaForte1',
        }),
      ).rejects.toThrow(new BadRequestException(INVALID_CODE_MESSAGE));
    });

    it('código expirado ou já usado (o findFirst não acha) lança a exceção', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'user@vidaemdia.com.br',
      });
      mockPrisma.passwordResetCode.findFirst.mockResolvedValue(null);

      await expect(
        service.resetPassword({
          email: 'user@vidaemdia.com.br',
          code: '123456',
          newPassword: 'novaSenhaForte1',
        }),
      ).rejects.toThrow(new BadRequestException(INVALID_CODE_MESSAGE));

      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('resetPassword com código certo grava a senha nova (o hash confere), marca o código como usado e envia o aviso', async () => {
      const code = '123456';
      const codeHash = await bcrypt.hash(code, 4);

      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'user@vidaemdia.com.br',
        telegramChatId: '987654321',
        passwordHash: 'hash-antigo',
      });
      mockPrisma.passwordResetCode.findFirst.mockResolvedValue({
        id: 'c1',
        userId: 'u1',
        codeHash,
        attempts: 0,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        usedAt: null,
      });
      mockPrisma.passwordResetCode.update.mockResolvedValue({ id: 'c1' });
      mockPrisma.user.update.mockResolvedValue({ id: 'u1' });

      const result = await service.resetPassword(
        {
          email: 'user@vidaemdia.com.br',
          code: '123456',
          newPassword: 'novaSenhaForte1',
        },
        '10.0.0.1',
      );

      expect(result).toEqual({
        ok: true,
        message: 'Senha alterada. Entre com a senha nova.',
      });

      // Marca o código como usado
      expect(mockPrisma.passwordResetCode.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { usedAt: expect.any(Date) },
      });

      // Grava a senha nova (o hash confere)
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { passwordHash: expect.any(String) },
      });
      const savedHash = mockPrisma.user.update.mock.calls[0][0].data.passwordHash;
      const isPasswordValid = await bcrypt.compare('novaSenhaForte1', savedHash);
      expect(isPasswordValid).toBe(true);

      // Envia o aviso
      expect(mockTelegramService.sendMessage).toHaveBeenCalledWith(
        '987654321',
        '🔐 A senha da sua conta no VidaEmDia foi alterada. Se não foi você, fale com quem administra o VidaEmDia.',
      );

      // Auditoria
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actorUserId: 'u1',
          entityType: 'AUTH',
          entityId: 'u1',
          action: 'UPDATE',
          details: 'Senha redefinida com o código do Telegram.',
          ipAddress: '10.0.0.1',
        }),
      );
    });

    it('não quebra se o envio do aviso no Telegram falhar após redefinir a senha', async () => {
      const code = '123456';
      const codeHash = await bcrypt.hash(code, 4);

      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'user@vidaemdia.com.br',
        telegramChatId: '987654321',
      });
      mockPrisma.passwordResetCode.findFirst.mockResolvedValue({
        id: 'c1',
        userId: 'u1',
        codeHash,
        attempts: 0,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        usedAt: null,
      });
      mockTelegramService.sendMessage.mockRejectedValue(new Error('Telegram fora do ar'));

      const result = await service.resetPassword({
        email: 'user@vidaemdia.com.br',
        code: '123456',
        newPassword: 'novaSenhaForte1',
      });

      expect(result).toEqual({
        ok: true,
        message: 'Senha alterada. Entre com a senha nova.',
      });
    });

    it('código errado soma 1 em attempts e lança BadRequestException', async () => {
      const codeHash = await bcrypt.hash('123456', 4);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'user@vidaemdia.com.br',
      });
      mockPrisma.passwordResetCode.findFirst.mockResolvedValue({
        id: 'c1',
        userId: 'u1',
        codeHash,
        attempts: 2,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        usedAt: null,
      });

      await expect(
        service.resetPassword({
          email: 'user@vidaemdia.com.br',
          code: '999999',
          newPassword: 'novaSenhaForte1',
        }),
      ).rejects.toThrow(new BadRequestException(INVALID_CODE_MESSAGE));

      expect(mockPrisma.passwordResetCode.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { attempts: 3 },
      });
      expect(mockMetricsService.incrementAuthFailure).toHaveBeenCalled();
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('na 5ª tentativa errada grava usedAt', async () => {
      const codeHash = await bcrypt.hash('123456', 4);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'user@vidaemdia.com.br',
      });
      mockPrisma.passwordResetCode.findFirst.mockResolvedValue({
        id: 'c1',
        userId: 'u1',
        codeHash,
        attempts: 4,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        usedAt: null,
      });

      await expect(
        service.resetPassword({
          email: 'user@vidaemdia.com.br',
          code: '999999',
          newPassword: 'novaSenhaForte1',
        }),
      ).rejects.toThrow(new BadRequestException(INVALID_CODE_MESSAGE));

      expect(mockPrisma.passwordResetCode.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: {
          attempts: 5,
          usedAt: expect.any(Date),
        },
      });
      expect(mockMetricsService.incrementAuthFailure).toHaveBeenCalled();
    });
  });

  describe('Auditoria', () => {
    it('a auditoria nunca contém o código', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'user@vidaemdia.com.br',
        telegramChatId: '987654321',
      });
      mockPrisma.passwordResetCode.findFirst.mockResolvedValue(null);

      await service.requestCode('user@vidaemdia.com.br');

      const sentText: string = mockTelegramService.sendMessage.mock.calls[0][1];
      const match = sentText.match(/(\d{6})/);
      expect(match).not.toBeNull();
      const code = match![1];

      const requestAuditCalls = JSON.stringify(mockAuditService.log.mock.calls);
      expect(requestAuditCalls).not.toContain(code);

      // Testando no resetPassword
      const codeHash = await bcrypt.hash(code, 4);
      mockPrisma.passwordResetCode.findFirst.mockResolvedValue({
        id: 'c1',
        userId: 'u1',
        codeHash,
        attempts: 0,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        usedAt: null,
      });

      await service.resetPassword({
        email: 'user@vidaemdia.com.br',
        code,
        newPassword: 'novaSenhaForte1',
      });

      const allAuditCalls = JSON.stringify(mockAuditService.log.mock.calls);
      expect(allAuditCalls).not.toContain(code);
      expect(allAuditCalls).not.toContain('novaSenhaForte1');
    });
  });
});
