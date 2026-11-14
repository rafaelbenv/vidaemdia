import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { BotWebhookController } from './bot-webhook.controller';
import { NotificationWorker } from './notification.worker';
import { NotificationProvider } from './notification.provider';
import { PrismaService } from '../prisma/prisma.service';
import { BotService } from './bot.service';
import { RbacGuard, ROLES_KEY } from '../auth/jwt-auth.guard';

describe('BotWebhookController', () => {
  let controller: BotWebhookController;
  let mockWorker: any;
  let mockProvider: any;
  let mockPrisma: any;
  let mockBotService: any;

  beforeEach(() => {
    mockWorker = {
      getWorkerStatus: jest.fn().mockReturnValue({ isRunning: false, lastRun: null }),
      processPendingReminders: jest.fn().mockResolvedValue({ processed: 1 }),
    };

    mockProvider = {
      getDispatchedMessages: jest.fn().mockReturnValue([]),
      setSimulateFailureCount: jest.fn().mockImplementation((count: number) => ({
        simulateFailureNextCount: count,
      })),
    };

    mockPrisma = {
      reminder: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      appointment: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      user: {
        findUnique: jest.fn(),
      },
    };

    mockBotService = {
      handleMessage: jest.fn(),
    };

    controller = new BotWebhookController(
      mockWorker as unknown as NotificationWorker,
      mockProvider as unknown as NotificationProvider,
      mockPrisma as unknown as PrismaService,
      mockBotService as unknown as BotService,
    );
  });

  describe('GET /notificacoes/status (getStatus)', () => {
    it('com usuário USER: prisma.reminder.findMany recebe where com OR de dono e permissão; mensagens de agendas fora do acesso são removidas', async () => {
      const userId = 'user-carlos';
      const req = {
        user: {
          sub: userId,
          role: UserRole.USER,
        },
      };

      const mockReminders = [
        {
          id: 'rem-1',
          appointmentId: 'apt-1',
          appointment: {
            calendar: { id: 'cal-1', name: 'Pessoal', type: 'PERSONAL' },
          },
        },
      ];
      mockPrisma.reminder.findMany.mockResolvedValue(mockReminders);

      const dispatched = [
        { id: 'msg-1', appointmentId: 'apt-1', message: 'Lembrete consulta' },
        { id: 'msg-2', appointmentId: 'apt-2', message: 'Lembrete outra agenda' },
      ];
      mockProvider.getDispatchedMessages.mockReturnValue(dispatched);

      // Apenas apt-1 está em agenda acessível pelo usuário
      mockPrisma.appointment.findMany.mockResolvedValue([{ id: 'apt-1' }]);

      const result = await controller.getStatus(req);

      expect(mockPrisma.reminder.findMany).toHaveBeenCalledWith({
        where: {
          appointment: {
            calendar: {
              OR: [
                { ownerId: userId },
                { permissions: { some: { granteeUserId: userId, canView: true } } },
              ],
            },
          },
        },
        include: {
          appointment: {
            include: {
              calendar: { select: { id: true, name: true, type: true } },
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
        take: 50,
      });

      expect(mockPrisma.appointment.findMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['apt-1', 'apt-2'] },
          calendar: {
            OR: [
              { ownerId: userId },
              { permissions: { some: { granteeUserId: userId, canView: true } } },
            ],
          },
        },
        select: {
          id: true,
          isPrivate: true,
          calendar: { select: { ownerId: true } },
        },
      });

      expect(result.reminders).toEqual(mockReminders);
      expect(result.dispatchedMessages).toEqual([dispatched[0]]);
      expect(result.dispatchedMessages).toHaveLength(1);
      expect(result.dispatchedMessages[0].appointmentId).toBe('apt-1');
      expect(result.worker).toEqual({ isRunning: false, lastRun: null });
    });

    it('com usuário USER: esconde mensagens de compromissos isPrivate cuja agenda não é do usuário, mas exibe se for o dono', async () => {
      const userId = 'user-carlos';
      const req = {
        user: {
          sub: userId,
          role: UserRole.USER,
        },
      };

      const dispatched = [
        { id: 'msg-1', appointmentId: 'apt-priv-other', message: 'Lembrete privado outro' },
        { id: 'msg-2', appointmentId: 'apt-priv-own', message: 'Lembrete privado meu' },
        { id: 'msg-3', appointmentId: 'apt-pub-other', message: 'Lembrete público outro' },
      ];
      mockProvider.getDispatchedMessages.mockReturnValue(dispatched);

      mockPrisma.appointment.findMany.mockResolvedValue([
        { id: 'apt-priv-other', isPrivate: true, calendar: { ownerId: 'other-user' } },
        { id: 'apt-priv-own', isPrivate: true, calendar: { ownerId: userId } },
        { id: 'apt-pub-other', isPrivate: false, calendar: { ownerId: 'other-user' } },
      ]);

      const result = await controller.getStatus(req);

      // apt-priv-other deve ser filtrado; apt-priv-own e apt-pub-other devem permanecer
      expect(result.dispatchedMessages).toHaveLength(2);
      expect(result.dispatchedMessages.map((m) => m.appointmentId)).toEqual([
        'apt-priv-own',
        'apt-pub-other',
      ]);
    });

    it('com ADMIN: findMany sem where de agenda; todas as mensagens despachadas retornadas', async () => {
      const adminId = 'admin-1';
      const req = {
        user: {
          sub: adminId,
          role: UserRole.ADMIN,
        },
      };

      const mockReminders = [
        { id: 'rem-1', appointmentId: 'apt-1' },
        { id: 'rem-2', appointmentId: 'apt-2' },
      ];
      mockPrisma.reminder.findMany.mockResolvedValue(mockReminders);

      const dispatched = [
        { id: 'msg-1', appointmentId: 'apt-1', message: 'Msg 1' },
        { id: 'msg-2', appointmentId: 'apt-2', message: 'Msg 2' },
      ];
      mockProvider.getDispatchedMessages.mockReturnValue(dispatched);

      const result = await controller.getStatus(req);

      expect(mockPrisma.reminder.findMany).toHaveBeenCalledWith({
        include: {
          appointment: {
            include: {
              calendar: { select: { id: true, name: true, type: true } },
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
        take: 50,
      });

      expect(mockPrisma.appointment.findMany).not.toHaveBeenCalled();
      expect(result.reminders).toEqual(mockReminders);
      expect(result.dispatchedMessages).toEqual(dispatched);
      expect(result.dispatchedMessages).toHaveLength(2);
    });
  });

  describe('POST /notificacoes/executar-worker & /notificacoes/simular-falha', () => {
    it('triggerWorkerNow chama worker.processPendingReminders', async () => {
      await controller.triggerWorkerNow();
      expect(mockWorker.processPendingReminders).toHaveBeenCalled();
    });

    it('simulateFailure chama provider.setSimulateFailureCount com o valor correto', async () => {
      await controller.simulateFailure({ failCount: 2 });
      expect(mockProvider.setSimulateFailureCount).toHaveBeenCalledWith(2);

      await controller.simulateFailure({});
      expect(mockProvider.setSimulateFailureCount).toHaveBeenCalledWith(1);
    });
  });

  describe('RbacGuard em endpoints restritos [PROFESSIONAL, ADMIN]', () => {
    let rbacGuard: RbacGuard;
    let mockReflector: any;

    beforeEach(() => {
      mockReflector = {
        getAllAndOverride: jest.fn().mockReturnValue([UserRole.PROFESSIONAL, UserRole.ADMIN]),
      };
      rbacGuard = new RbacGuard(mockReflector as unknown as Reflector);
    });

    function createMockContext(userRole?: UserRole | string): ExecutionContext {
      return {
        getHandler: jest.fn(),
        getClass: jest.fn(),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({
            user: userRole ? { sub: 'u1', role: userRole } : null,
          }),
        }),
      } as unknown as ExecutionContext;
    }

    it('USER lança ForbiddenException', () => {
      const context = createMockContext(UserRole.USER);
      expect(() => rbacGuard.canActivate(context)).toThrow(ForbiddenException);
      expect(mockReflector.getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, expect.any(Array));
    });

    it('SECRETARY lança ForbiddenException', () => {
      const context = createMockContext(UserRole.SECRETARY);
      expect(() => rbacGuard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('PROFESSIONAL passa (retorna true)', () => {
      const context = createMockContext(UserRole.PROFESSIONAL);
      expect(rbacGuard.canActivate(context)).toBe(true);
    });

    it('ADMIN passa (retorna true)', () => {
      const context = createMockContext(UserRole.ADMIN);
      expect(rbacGuard.canActivate(context)).toBe(true);
    });
  });
});
