import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CalendarAccessService } from './calendar-access.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { MetricsService } from '../monitoring/metrics.service';

describe('CalendarAccessService', () => {
  let calendarAccessService: CalendarAccessService;
  let mockPrisma: any;
  let mockAuditService: any;
  let mockMetricsService: any;

  const defaultCalendar = {
    id: 'c1',
    ownerId: 'dono',
    name: 'Agenda X',
    owner: {
      id: 'dono',
      name: 'Dr. João',
      email: 'j@x.com',
      role: 'PROFESSIONAL',
    },
  };

  beforeEach(() => {
    mockPrisma = {
      calendar: {
        findUnique: jest.fn(),
      },
      calendarPermission: {
        findUnique: jest.fn(),
      },
    };

    mockAuditService = {
      log: jest.fn().mockResolvedValue({ id: 'log-1' }),
    };

    mockMetricsService = {
      incrementRbacDenied: jest.fn(),
    };

    calendarAccessService = new CalendarAccessService(
      mockPrisma as unknown as PrismaService,
      mockAuditService as unknown as AuditService,
      mockMetricsService as unknown as MetricsService,
    );
  });

  describe('verifyAccessOrThrow', () => {
    it('deve permitir acesso para o dono da agenda com isDelegated: false sem consultar calendarPermission', async () => {
      mockPrisma.calendar.findUnique.mockResolvedValue(defaultCalendar);

      const result = await calendarAccessService.verifyAccessOrThrow(
        'dono',
        'PROFESSIONAL',
        'c1',
        'VIEW',
      );

      expect(result).toEqual({ calendar: defaultCalendar, isDelegated: false });
      expect(mockPrisma.calendarPermission.findUnique).not.toHaveBeenCalled();
    });

    it('deve permitir acesso para ADMIN não dono com isDelegated: false sem consultar calendarPermission', async () => {
      mockPrisma.calendar.findUnique.mockResolvedValue(defaultCalendar);

      const result = await calendarAccessService.verifyAccessOrThrow(
        'admin-id',
        'ADMIN',
        'c1',
        'VIEW',
      );

      expect(result).toEqual({ calendar: defaultCalendar, isDelegated: false });
      expect(mockPrisma.calendarPermission.findUnique).not.toHaveBeenCalled();
    });

    it('deve lançar NotFoundException quando a agenda não existir', async () => {
      mockPrisma.calendar.findUnique.mockResolvedValue(null);

      await expect(
        calendarAccessService.verifyAccessOrThrow('sec1', 'SECRETARY', 'c1', 'VIEW'),
      ).rejects.toThrow(NotFoundException);
    });

    it('deve permitir acesso para secretária com canView: true pedindo VIEW com isDelegated: true', async () => {
      mockPrisma.calendar.findUnique.mockResolvedValue(defaultCalendar);
      const permission = {
        id: 'p1',
        calendarId: 'c1',
        granteeUserId: 'sec1',
        canView: true,
        canCreate: false,
        canUpdate: false,
        canCancel: false,
      };
      mockPrisma.calendarPermission.findUnique.mockResolvedValue(permission);

      const result = await calendarAccessService.verifyAccessOrThrow(
        'sec1',
        'SECRETARY',
        'c1',
        'VIEW',
      );

      expect(result).toEqual({ calendar: defaultCalendar, isDelegated: true, permission });
    });

    it('deve lançar ForbiddenException, incrementar métrica de negação e registrar auditoria para secretária com canView: true, canCreate: false pedindo CREATE', async () => {
      mockPrisma.calendar.findUnique.mockResolvedValue(defaultCalendar);
      const permission = {
        id: 'p1',
        calendarId: 'c1',
        granteeUserId: 'sec1',
        canView: true,
        canCreate: false,
        canUpdate: false,
        canCancel: false,
      };
      mockPrisma.calendarPermission.findUnique.mockResolvedValue(permission);

      await expect(
        calendarAccessService.verifyAccessOrThrow('sec1', 'SECRETARY', 'c1', 'CREATE'),
      ).rejects.toThrow(ForbiddenException);

      expect(mockMetricsService.incrementRbacDenied).toHaveBeenCalledTimes(1);
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'ACCESS_DENIED',
        }),
      );
    });

    it.each([
      { operation: 'UPDATE' as const, flag: 'canUpdate' as const, allowed: true },
      { operation: 'UPDATE' as const, flag: 'canUpdate' as const, allowed: false },
      { operation: 'CANCEL' as const, flag: 'canCancel' as const, allowed: true },
      { operation: 'CANCEL' as const, flag: 'canCancel' as const, allowed: false },
    ])(
      'operação $operation com flag $flag (allowed: $allowed)',
      async ({ operation, flag, allowed }) => {
        mockPrisma.calendar.findUnique.mockResolvedValue(defaultCalendar);
        const permission = {
          id: 'p1',
          calendarId: 'c1',
          granteeUserId: 'sec1',
          canView: true,
          canCreate: false,
          canUpdate: false,
          canCancel: false,
          [flag]: allowed,
        };
        mockPrisma.calendarPermission.findUnique.mockResolvedValue(permission);

        if (allowed) {
          const result = await calendarAccessService.verifyAccessOrThrow(
            'sec1',
            'SECRETARY',
            'c1',
            operation,
          );
          expect(result.isDelegated).toBe(true);
          expect(result.permission).toEqual(permission);
        } else {
          await expect(
            calendarAccessService.verifyAccessOrThrow('sec1', 'SECRETARY', 'c1', operation),
          ).rejects.toThrow(ForbiddenException);
        }
      },
    );

    it('deve lançar ForbiddenException quando o usuário não tiver nenhuma permissão na tabela', async () => {
      mockPrisma.calendar.findUnique.mockResolvedValue(defaultCalendar);
      mockPrisma.calendarPermission.findUnique.mockResolvedValue(null);

      await expect(
        calendarAccessService.verifyAccessOrThrow('u-estranho', 'USER', 'c1', 'VIEW'),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
