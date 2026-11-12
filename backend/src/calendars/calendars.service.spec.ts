import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CalendarsService } from './calendars.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CalendarAccessService } from './calendar-access.service';
import { GrantPermissionDto } from './dto/calendar.dto';

describe('CalendarsService', () => {
  let service: CalendarsService;
  let mockPrisma: any;
  let mockAuditService: any;
  let mockCalendarAccess: any;

  const baseCalendar = {
    id: 'cal-1',
    ownerId: 'owner-1',
    name: 'Agenda Principal',
    type: 'PROFESSIONAL',
  };

  beforeEach(() => {
    mockPrisma = {
      calendar: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      calendarPermission: {
        findMany: jest.fn(),
        upsert: jest.fn(),
        delete: jest.fn(),
      },
    };

    mockAuditService = {
      log: jest.fn().mockResolvedValue({ id: 'audit-1' }),
    };

    mockCalendarAccess = {
      verifyAccessOrThrow: jest.fn(),
    };

    service = new CalendarsService(
      mockPrisma as unknown as PrismaService,
      mockAuditService as unknown as AuditService,
      mockCalendarAccess as unknown as CalendarAccessService,
    );
  });

  describe('grantPermission', () => {
    const dto: GrantPermissionDto = {
      secretaryEmail: 'maria@clinica.com',
      canView: true,
      canCreate: true,
      canUpdate: false,
      canCancel: false,
    };

    it('deve lançar ForbiddenException quando o solicitante não for o dono da agenda', async () => {
      mockPrisma.calendar.findUnique.mockResolvedValue(baseCalendar);

      await expect(
        service.grantPermission('not-owner', 'cal-1', dto),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.grantPermission('not-owner', 'cal-1', dto),
      ).rejects.toThrow('Apenas o proprietário da agenda pode delegar permissões RBAC');
    });

    it('deve lançar NotFoundException quando a agenda não existir', async () => {
      mockPrisma.calendar.findUnique.mockResolvedValue(null);

      await expect(
        service.grantPermission('owner-1', 'cal-1', dto),
      ).rejects.toThrow(NotFoundException);
    });

    it('deve lançar BadRequestException quando o usuário grantee não for encontrado', async () => {
      mockPrisma.calendar.findUnique.mockResolvedValue(baseCalendar);
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.grantPermission('owner-1', 'cal-1', dto),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.grantPermission('owner-1', 'cal-1', dto),
      ).rejects.toThrow('Nenhum usuário encontrado com o e-mail maria@clinica.com');
    });

    it('deve conceder permissão e registrar no auditService.log com granteeUserId, granteeName e granteeEmail no metadata', async () => {
      mockPrisma.calendar.findUnique.mockResolvedValue(baseCalendar);

      const secretary = {
        id: 'sec-1',
        name: 'Maria Oliveira',
        email: 'maria@clinica.com',
        role: 'SECRETARY',
      };
      mockPrisma.user.findUnique.mockResolvedValue(secretary);

      const createdPerm = {
        id: 'perm-1',
        calendarId: 'cal-1',
        granteeUserId: 'sec-1',
        canView: true,
        canCreate: true,
        canUpdate: false,
        canCancel: false,
        granteeUser: secretary,
      };
      mockPrisma.calendarPermission.upsert.mockResolvedValue(createdPerm);

      const result = await service.grantPermission('owner-1', 'cal-1', dto, '127.0.0.1');

      expect(result).toEqual(createdPerm);
      expect(mockAuditService.log).toHaveBeenCalledWith({
        actorUserId: 'owner-1',
        targetCalendarId: 'cal-1',
        entityType: 'PERMISSION',
        entityId: 'perm-1',
        action: 'UPDATE',
        details: 'Permissão RBAC concedida para Maria Oliveira (maria@clinica.com) na agenda "Agenda Principal".',
        metadata: {
          canView: true,
          canCreate: true,
          canUpdate: false,
          canCancel: false,
          granteeUserId: 'sec-1',
          granteeName: 'Maria Oliveira',
          granteeEmail: 'maria@clinica.com',
        },
        ipAddress: '127.0.0.1',
      });
    });
  });

  describe('revokePermission', () => {
    it('deve lançar ForbiddenException quando o solicitante não for o dono da agenda', async () => {
      mockPrisma.calendar.findUnique.mockResolvedValue(baseCalendar);

      await expect(
        service.revokePermission('not-owner', 'cal-1', 'sec-1'),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.revokePermission('not-owner', 'cal-1', 'sec-1'),
      ).rejects.toThrow('Apenas o proprietário da agenda pode revogar permissões RBAC');
    });

    it('deve lançar NotFoundException quando a agenda não existir', async () => {
      mockPrisma.calendar.findUnique.mockResolvedValue(null);

      await expect(
        service.revokePermission('owner-1', 'cal-1', 'sec-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('deve buscar o usuário antes de deletar e gravar no auditService.log com granteeUserId, granteeName e granteeEmail no metadata', async () => {
      mockPrisma.calendar.findUnique.mockResolvedValue(baseCalendar);

      const grantee = {
        name: 'Maria Oliveira',
        email: 'maria@clinica.com',
      };
      mockPrisma.user.findUnique.mockResolvedValue(grantee);
      mockPrisma.calendarPermission.delete.mockResolvedValue({ id: 'perm-1' });

      const result = await service.revokePermission('owner-1', 'cal-1', 'sec-1', '127.0.0.1');

      expect(result).toEqual({ revoked: true });

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'sec-1' },
        select: { name: true, email: true },
      });

      expect(mockPrisma.calendarPermission.delete).toHaveBeenCalledWith({
        where: {
          calendarId_granteeUserId: {
            calendarId: 'cal-1',
            granteeUserId: 'sec-1',
          },
        },
      });

      const userFindOrder = mockPrisma.user.findUnique.mock.invocationCallOrder[0];
      const deleteOrder = mockPrisma.calendarPermission.delete.mock.invocationCallOrder[0];
      expect(userFindOrder).toBeLessThan(deleteOrder);

      expect(mockAuditService.log).toHaveBeenCalledWith({
        actorUserId: 'owner-1',
        targetCalendarId: 'cal-1',
        entityType: 'PERMISSION',
        entityId: 'sec-1',
        action: 'CANCEL',
        details: 'Permissão RBAC revogada na agenda "Agenda Principal".',
        metadata: {
          granteeUserId: 'sec-1',
          granteeName: 'Maria Oliveira',
          granteeEmail: 'maria@clinica.com',
        },
        ipAddress: '127.0.0.1',
      });
    });

    it('se a permissão não existir, o delete falha e o log não é gravado', async () => {
      mockPrisma.calendar.findUnique.mockResolvedValue(baseCalendar);
      mockPrisma.user.findUnique.mockResolvedValue({
        name: 'Maria Oliveira',
        email: 'maria@clinica.com',
      });
      mockPrisma.calendarPermission.delete.mockRejectedValue(
        new Error('Record to delete does not exist'),
      );

      await expect(
        service.revokePermission('owner-1', 'cal-1', 'sec-1'),
      ).rejects.toThrow('Record to delete does not exist');

      expect(mockAuditService.log).not.toHaveBeenCalled();
    });
  });
});
