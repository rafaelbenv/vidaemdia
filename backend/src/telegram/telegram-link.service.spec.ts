import { TelegramLinkService } from './telegram-link.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ServiceUnavailableException, NotFoundException } from '@nestjs/common';

describe('TelegramLinkService', () => {
  let service: TelegramLinkService;
  let mockPrisma: any;
  let mockAuditService: any;
  let mockTx: any;

  beforeEach(() => {
    mockTx = {
      telegramLinkToken: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      user: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        update: jest.fn().mockResolvedValue({ id: 'user-1', telegramChatId: '123456' }),
      },
    };

    mockPrisma = {
      telegramLinkToken: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation(async (cb: (tx: any) => Promise<any>) => {
        return cb(mockTx);
      }),
    };

    mockAuditService = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    service = new TelegramLinkService(
      mockPrisma as unknown as PrismaService,
      mockAuditService as unknown as AuditService,
    );
  });

  describe('consume', () => {
    it('código válido vincula a conta com sucesso e registra auditoria', async () => {
      const futureDate = new Date(Date.now() + 10 * 60 * 1000);
      mockPrisma.telegramLinkToken.findUnique.mockResolvedValue({
        id: 'token-1',
        code: 'valid_code_123',
        userId: 'user-1',
        usedAt: null,
        expiresAt: futureDate,
        user: {
          id: 'user-1',
          name: 'Carlos Silva',
        },
      });

      const result = await service.consume('valid_code_123', '987654321');

      expect(result.ok).toBe(true);
      expect(result.userName).toBe('Carlos Silva');
      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockTx.telegramLinkToken.updateMany).toHaveBeenCalledWith({
        where: { id: 'token-1', usedAt: null },
        data: expect.objectContaining({ usedAt: expect.any(Date) }),
      });
      expect(mockTx.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { telegramChatId: '987654321' },
      });
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actorUserId: 'user-1',
          action: 'TELEGRAM_LINK',
          entityType: 'AUTH',
        }),
      );
    });

    it('código inexistente falha com mensagem apropriada', async () => {
      mockPrisma.telegramLinkToken.findUnique.mockResolvedValue(null);

      const result = await service.consume('non_existent_code', '987654321');

      expect(result.ok).toBe(false);
      expect(result.reason).toBe('Código de vinculação inexistente ou inválido.');
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      expect(mockAuditService.log).not.toHaveBeenCalled();
    });

    it('código repetido (já utilizado anteriormente) falha', async () => {
      mockPrisma.telegramLinkToken.findUnique.mockResolvedValue({
        id: 'token-2',
        code: 'already_used_code',
        userId: 'user-1',
        usedAt: new Date(Date.now() - 5 * 60 * 1000),
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        user: { id: 'user-1', name: 'Carlos Silva' },
      });

      const result = await service.consume('already_used_code', '987654321');

      expect(result.ok).toBe(false);
      expect(result.reason).toBe('Este código de vinculação já foi utilizado.');
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      expect(mockAuditService.log).not.toHaveBeenCalled();
    });

    it('código repetido por concorrência (updateMany count = 0) falha', async () => {
      mockPrisma.telegramLinkToken.findUnique.mockResolvedValue({
        id: 'token-3',
        code: 'race_code',
        userId: 'user-1',
        usedAt: null,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        user: { id: 'user-1', name: 'Carlos Silva' },
      });
      mockTx.telegramLinkToken.updateMany.mockResolvedValue({ count: 0 });

      const result = await service.consume('race_code', '987654321');

      expect(result.ok).toBe(false);
      expect(result.reason).toBe('Este código de vinculação já foi utilizado.');
      expect(mockAuditService.log).not.toHaveBeenCalled();
    });

    it('código expirado falha com mensagem indicando expiração', async () => {
      const pastDate = new Date(Date.now() - 60 * 1000);
      mockPrisma.telegramLinkToken.findUnique.mockResolvedValue({
        id: 'token-4',
        code: 'expired_code',
        userId: 'user-1',
        usedAt: null,
        expiresAt: pastDate,
        user: { id: 'user-1', name: 'Carlos Silva' },
      });

      const result = await service.consume('expired_code', '987654321');

      expect(result.ok).toBe(false);
      expect(result.reason).toContain('expirou');
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      expect(mockAuditService.log).not.toHaveBeenCalled();
    });

    it('parâmetros vazios falham imediatamente sem consultar o banco', async () => {
      const resultNoCode = await service.consume('', '12345');
      expect(resultNoCode.ok).toBe(false);

      const resultNoChatId = await service.consume('some_code', '');
      expect(resultNoChatId.ok).toBe(false);

      expect(mockPrisma.telegramLinkToken.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('createLink', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterAll(() => {
      process.env = originalEnv;
    });

    it('lança ServiceUnavailableException se TELEGRAM_BOT_USERNAME não estiver configurado', async () => {
      delete process.env.TELEGRAM_BOT_USERNAME;

      await expect(service.createLink('user-1')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('gera link de vinculação com username formatado e token temporário', async () => {
      process.env.TELEGRAM_BOT_USERNAME = '@MeuBotExemplo';
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        name: 'Carlos Silva',
      });
      mockPrisma.telegramLinkToken.create.mockResolvedValue({});

      const result = await service.createLink('user-1');

      expect(result.url).toMatch(/^https:\/\/t\.me\/MeuBotExemplo\?start=[a-f0-9]{32}$/);
      expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
      expect(mockPrisma.telegramLinkToken.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          code: expect.any(String),
          expiresAt: expect.any(Date),
        }),
      });
    });

    it('lança NotFoundException se usuário não existir', async () => {
      process.env.TELEGRAM_BOT_USERNAME = 'MeuBotExemplo';
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.createLink('non-existent-user')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('unlink', () => {
    it('remove o vínculo do usuário e gera registro de auditoria', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        name: 'Carlos Silva',
      });
      mockPrisma.user.update.mockResolvedValue({
        id: 'user-1',
        telegramChatId: null,
      });

      const result = await service.unlink('user-1');

      expect(result.ok).toBe(true);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { telegramChatId: null },
      });
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actorUserId: 'user-1',
          action: 'TELEGRAM_UNLINK',
          entityType: 'AUTH',
        }),
      );
    });
  });

  describe('getStatus', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterAll(() => {
      process.env = originalEnv;
    });

    it('retorna status vinculado e botUsername', async () => {
      process.env.TELEGRAM_BOT_USERNAME = '@VidaEmDiaBot';
      mockPrisma.user.findUnique.mockResolvedValue({
        telegramChatId: '12345678',
      });

      const status = await service.getStatus('user-1');

      expect(status.linked).toBe(true);
      expect(status.botUsername).toBe('VidaEmDiaBot');
    });

    it('retorna não vinculado quando telegramChatId é nulo', async () => {
      process.env.TELEGRAM_BOT_USERNAME = 'VidaEmDiaBot';
      mockPrisma.user.findUnique.mockResolvedValue({
        telegramChatId: null,
      });

      const status = await service.getStatus('user-1');

      expect(status.linked).toBe(false);
      expect(status.botUsername).toBe('VidaEmDiaBot');
    });
  });
});
