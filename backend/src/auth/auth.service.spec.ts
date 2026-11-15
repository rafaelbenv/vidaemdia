import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { CalendarType, UserRole } from '@prisma/client';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { MetricsService } from '../monitoring/metrics.service';

describe('AuthService', () => {
  let authService: AuthService;
  let mockPrisma: any;
  let mockJwtService: any;
  let mockAuditService: any;
  let mockMetricsService: any;
  let validPasswordHash: string;
  let strongPasswordHash: string;

  beforeAll(async () => {
    validPasswordHash = await bcrypt.hash('123456', 4);
    strongPasswordHash = await bcrypt.hash('senhaForte1', 4);
  });

  beforeEach(() => {
    mockPrisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      calendar: {
        create: jest.fn(),
      },
    };

    mockJwtService = {
      sign: jest.fn().mockReturnValue('token-fake'),
    };

    mockAuditService = {
      log: jest.fn().mockResolvedValue({ id: 'log-1' }),
    };

    mockMetricsService = {
      incrementAuthFailure: jest.fn(),
    };

    authService = new AuthService(
      mockPrisma as unknown as PrismaService,
      mockJwtService as unknown as JwtService,
      mockAuditService as unknown as AuditService,
      mockMetricsService as unknown as MetricsService,
    );
  });

  describe('login', () => {
    it('deve realizar login com sucesso', async () => {
      const user = {
        id: 'u1',
        name: 'Dr. João',
        email: 'dr.joao@vidaemdia.com.br',
        passwordHash: validPasswordHash,
        role: UserRole.PROFESSIONAL,
        telegramChatId: null,
        preferredChannel: 'TELEGRAM',
      };
      mockPrisma.user.findUnique.mockResolvedValue(user);

      const result = await authService.login({
        email: 'dr.joao@vidaemdia.com.br',
        password: '123456',
      });

      expect(result.accessToken).toBe('token-fake');
      expect(result.user.role).toBe('PROFESSIONAL');
      expect(result.user).not.toHaveProperty('passwordHash');
      expect(mockJwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: 'u1',
          email: 'dr.joao@vidaemdia.com.br',
          role: 'PROFESSIONAL',
        }),
      );
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'LOGIN',
        }),
      );
    });

    it('deve normalizar o e-mail no login', async () => {
      const user = {
        id: 'u1',
        name: 'Dr. João',
        email: 'dr.joao@vidaemdia.com.br',
        passwordHash: validPasswordHash,
        role: UserRole.PROFESSIONAL,
        telegramChatId: null,
        preferredChannel: 'TELEGRAM',
      };
      mockPrisma.user.findUnique.mockResolvedValue(user);

      await authService.login({
        email: '  Dr.Joao@VidaEmDia.com.br ',
        password: '123456',
      });

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'dr.joao@vidaemdia.com.br' },
      });
    });

    it('deve rejeitar login com e-mail inexistente e registrar falha', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        authService.login({
          email: 'inexistente@vidaemdia.com.br',
          password: '123456',
        }),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockMetricsService.incrementAuthFailure).toHaveBeenCalled();
    });

    it('deve rejeitar login com senha incorreta e registrar falha sem gerar token', async () => {
      const user = {
        id: 'u1',
        name: 'Dr. João',
        email: 'dr.joao@vidaemdia.com.br',
        passwordHash: validPasswordHash,
        role: UserRole.PROFESSIONAL,
        telegramChatId: null,
        preferredChannel: 'TELEGRAM',
      };
      mockPrisma.user.findUnique.mockResolvedValue(user);

      await expect(
        authService.login({
          email: 'dr.joao@vidaemdia.com.br',
          password: 'senha-errada',
        }),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockMetricsService.incrementAuthFailure).toHaveBeenCalled();
      expect(mockJwtService.sign).not.toHaveBeenCalled();
    });
  });

  describe('register', () => {
    it('deve registrar usuário sempre como USER ignorando role passada', async () => {
      const createdUser = {
        id: 'u-ana',
        name: 'Ana',
        email: 'ana@x.com',
        passwordHash: strongPasswordHash,
        role: UserRole.USER,
        telegramChatId: null,
        preferredChannel: 'TELEGRAM',
      };

      mockPrisma.user.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(createdUser);

      mockPrisma.user.create.mockResolvedValue(createdUser);
      mockPrisma.calendar.create.mockResolvedValue({ id: 'cal-1' });

      await authService.register({
        name: 'Ana',
        email: 'ana@x.com',
        password: 'senhaForte1',
        role: 'ADMIN',
      } as any);

      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            role: 'USER',
          }),
        }),
      );
      expect(mockPrisma.calendar.create).toHaveBeenCalledTimes(1);
      expect(mockPrisma.calendar.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: CalendarType.PERSONAL,
            name: 'Minha agenda',
          }),
        }),
      );
    });

    it('deve limpar espaços extras do nome ao registrar', async () => {
      const createdUser = {
        id: 'u-ana',
        name: 'Ana Souza',
        email: 'ana@x.com',
        passwordHash: strongPasswordHash,
        role: UserRole.USER,
        telegramChatId: null,
        preferredChannel: 'TELEGRAM',
      };

      mockPrisma.user.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(createdUser);

      mockPrisma.user.create.mockResolvedValue(createdUser);
      mockPrisma.calendar.create.mockResolvedValue({ id: 'cal-1' });

      await authService.register({
        name: '  Ana   Souza ',
        email: 'ana@x.com',
        password: 'senhaForte1',
      });

      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Ana Souza',
          }),
        }),
      );
    });

    it('deve rejeitar registro com e-mail repetido', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u-existente',
        email: 'repetido@x.com',
      });

      await expect(
        authService.register({
          name: 'Ana Repetida',
          email: 'repetido@x.com',
          password: 'senhaForte1',
        }),
      ).rejects.toThrow(
        new BadRequestException(
          'Não foi possível criar a conta com este e-mail. Se você já tem conta, entre ou recupere a senha.',
        ),
      );

      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });
  });

  describe('updateProfile', () => {
    it('grava o nome, registra auditoria UPDATE e devolve o perfil', async () => {
      const updatedUser = {
        id: 'u1',
        name: 'Carlos Silva',
        email: 'carlos@vidaemdia.com.br',
        role: UserRole.USER,
        telegramChatId: null,
        preferredChannel: 'TELEGRAM',
        createdAt: new Date(),
      };

      mockPrisma.user.update.mockResolvedValue(updatedUser);
      mockPrisma.user.findUnique.mockResolvedValue(updatedUser);

      const result = await authService.updateProfile(
        'u1',
        { name: '  Carlos   Silva  ' },
        '127.0.0.1',
      );

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { name: 'Carlos Silva' },
      });

      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actorUserId: 'u1',
          entityType: 'AUTH',
          entityId: 'u1',
          action: 'UPDATE',
          details: 'Nome alterado para Carlos Silva.',
          ipAddress: '127.0.0.1',
        }),
      );

      expect(result).toEqual({
        id: 'u1',
        name: 'Carlos Silva',
        email: 'carlos@vidaemdia.com.br',
        role: UserRole.USER,
        preferredChannel: 'TELEGRAM',
        createdAt: expect.any(Date),
        telegramLinked: false,
      });
    });
  });

  describe('changePassword', () => {
    it('deve lançar NotFoundException quando o usuário não existir', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        authService.changePassword('u-inexistente', {
          currentPassword: 'senhaForte1',
          newPassword: 'novaSenhaForte2',
        }),
      ).rejects.toThrow(new NotFoundException('Usuário não encontrado'));
    });

    it('deve falhar com BadRequestException e registrar falha quando a senha atual estiver errada', async () => {
      const user = {
        id: 'u1',
        name: 'Carlos',
        email: 'carlos@x.com',
        passwordHash: strongPasswordHash,
      };
      mockPrisma.user.findUnique.mockResolvedValue(user);

      await expect(
        authService.changePassword('u1', {
          currentPassword: 'senhaIncorreta1',
          newPassword: 'novaSenhaForte2',
        }),
      ).rejects.toThrow(new BadRequestException('A senha atual está incorreta.'));

      expect(mockMetricsService.incrementAuthFailure).toHaveBeenCalled();
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('deve falhar com BadRequestException quando a senha nova for igual à atual', async () => {
      const user = {
        id: 'u1',
        name: 'Carlos',
        email: 'carlos@x.com',
        passwordHash: strongPasswordHash,
      };
      mockPrisma.user.findUnique.mockResolvedValue(user);

      await expect(
        authService.changePassword('u1', {
          currentPassword: 'senhaForte1',
          newPassword: 'senhaForte1',
        }),
      ).rejects.toThrow(
        new BadRequestException('A senha nova precisa ser diferente da atual.'),
      );

      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('deve trocar a senha com sucesso, gravar novo hash e registrar auditoria sem expor a senha', async () => {
      const user = {
        id: 'u1',
        name: 'Carlos',
        email: 'carlos@x.com',
        passwordHash: strongPasswordHash,
      };
      mockPrisma.user.findUnique.mockResolvedValue(user);
      mockPrisma.user.update.mockResolvedValue({ ...user });

      const result = await authService.changePassword(
        'u1',
        {
          currentPassword: 'senhaForte1',
          newPassword: 'novaSenhaForte2',
        },
        '192.168.1.1',
      );

      expect(result).toEqual({ ok: true, message: 'Senha alterada.' });

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: {
          passwordHash: expect.any(String),
        },
      });

      const updateCall = mockPrisma.user.update.mock.calls[0][0];
      const isNewHashValid = await bcrypt.compare(
        'novaSenhaForte2',
        updateCall.data.passwordHash,
      );
      expect(isNewHashValid).toBe(true);

      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actorUserId: 'u1',
          entityType: 'AUTH',
          entityId: 'u1',
          action: 'UPDATE',
          details: 'Senha alterada.',
          ipAddress: '192.168.1.1',
        }),
      );

      const auditCalls = mockAuditService.log.mock.calls;
      const logDetails = auditCalls[auditCalls.length - 1][0].details;
      expect(logDetails).not.toContain('novaSenhaForte2');
      expect(logDetails).not.toContain('senhaForte1');
    });
  });
});
