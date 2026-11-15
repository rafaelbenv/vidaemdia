import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { MonitoringController } from './monitoring.controller';
import { PrismaService } from '../prisma/prisma.service';
import { MetricsService } from './metrics.service';
import { ROLES_KEY } from '../auth/jwt-auth.guard';

describe('MonitoringController', () => {
  let controller: MonitoringController;
  let mockPrisma: any;
  let mockMetricsService: any;

  beforeEach(() => {
    mockPrisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ 1: 1 }]),
      user: { count: jest.fn().mockResolvedValue(10) },
      calendar: { count: jest.fn().mockResolvedValue(5) },
      appointment: { count: jest.fn().mockResolvedValue(20) },
      reminder: { count: jest.fn().mockResolvedValue(2) },
      auditLog: { count: jest.fn().mockResolvedValue(50) },
    };

    mockMetricsService = {
      getSummary: jest.fn().mockReturnValue({
        appointmentsCreatedTotal: 20,
        rbacAccessDenied: 1,
      }),
      toPrometheusText: jest.fn(),
    };

    controller = new MonitoringController(
      mockPrisma as unknown as PrismaService,
      mockMetricsService as unknown as MetricsService,
    );
  });

  describe('healthCheck', () => {
    it('GET /health devolve apenas status, timestamp e services, sem databaseStats e sem metrics', async () => {
      const result = await controller.healthCheck();

      expect(result).toHaveProperty('status', 'OK');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('services', {
        backend: 'UP',
        postgresql: 'UP',
        notificationWorker: 'UP',
      });
      expect(result).not.toHaveProperty('databaseStats');
      expect(result).not.toHaveProperty('metrics');
      expect(mockPrisma.user.count).not.toHaveBeenCalled();
    });

    it('GET /health devolve DEGRADED e postgresql DOWN quando o banco falhar', async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error('DB connection failed'));

      const result = await controller.healthCheck();

      expect(result.status).toBe('DEGRADED');
      expect(result.services.postgresql).toBe('DOWN');
      expect(result).not.toHaveProperty('databaseStats');
      expect(result).not.toHaveProperty('metrics');
    });
  });

  describe('getHealthDetails', () => {
    it('GET /health/detalhes devolve databaseStats e metrics completos', async () => {
      const result = await controller.getHealthDetails();

      expect(result).toHaveProperty('status', 'OK');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('services', {
        backend: 'UP',
        postgresql: 'UP',
        notificationWorker: 'UP',
      });
      expect(result).toHaveProperty('databaseStats', {
        usersCount: 10,
        calendarsCount: 5,
        appointmentsCount: 20,
        pendingRemindersCount: 2,
        auditLogsCount: 50,
      });
      expect(result).toHaveProperty('metrics');
      expect(result.metrics).toEqual({
        appointmentsCreatedTotal: 20,
        rbacAccessDenied: 1,
      });
    });

    it('deve ter o metadado de papéis [PROFESSIONAL, ADMIN]', () => {
      const reflector = new Reflector();
      const roles = reflector.get<UserRole[]>(ROLES_KEY, controller.getHealthDetails);
      expect(roles).toEqual([UserRole.PROFESSIONAL, UserRole.ADMIN]);
    });
  });
});
