import { BadRequestException, UnauthorizedException } from '@nestjs/common';
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

  beforeAll(async () => {
    validPasswordHash = await bcrypt.hash('123456', 4);
  });

  beforeEach(() => {
    mockPrisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
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
        phoneWhatsapp: null,
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
        phoneWhatsapp: null,
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
        phoneWhatsapp: null,
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
        passwordHash: validPasswordHash,
        role: UserRole.USER,
        phoneWhatsapp: null,
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
        password: '123456',
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
          password: '123456',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });
  });
});
