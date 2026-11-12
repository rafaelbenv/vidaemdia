import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AuditService } from './audit.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AuditService', () => {
  let auditService: AuditService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      calendar: {
        findUnique: jest.fn(),
      },
      auditLog: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    auditService = new AuditService(mockPrisma as unknown as PrismaService);
  });

  describe('findAllForUser', () => {
    it('deve permitir acesso para o dono da agenda', async () => {
      mockPrisma.calendar.findUnique.mockResolvedValue({
        ownerId: 'u1',
        permissions: [],
      });

      const result = await auditService.findAllForUser('u1', 'USER', 'c1');

      expect(result).toEqual([]);
      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { targetCalendarId: 'c1' },
        }),
      );
    });

    it('deve permitir acesso para usuário com permissão canView', async () => {
      mockPrisma.calendar.findUnique.mockResolvedValue({
        ownerId: 'outro',
        permissions: [{ id: 'p1' }],
      });

      const result = await auditService.findAllForUser('u1', 'USER', 'c1');

      expect(result).toEqual([]);
      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { targetCalendarId: 'c1' },
        }),
      );
    });

    it('deve rejeitar com ForbiddenException para usuário sem acesso', async () => {
      mockPrisma.calendar.findUnique.mockResolvedValue({
        ownerId: 'outro',
        permissions: [],
      });

      await expect(auditService.findAllForUser('u1', 'USER', 'c1')).rejects.toThrow(
        ForbiddenException,
      );

      expect(mockPrisma.auditLog.findMany).not.toHaveBeenCalled();
    });

    it('deve rejeitar com NotFoundException quando a agenda não existir', async () => {
      mockPrisma.calendar.findUnique.mockResolvedValue(null);

      await expect(auditService.findAllForUser('u1', 'USER', 'c1')).rejects.toThrow(
        NotFoundException,
      );

      expect(mockPrisma.auditLog.findMany).not.toHaveBeenCalled();
    });

    it('deve permitir acesso para ADMIN sem consultar a agenda', async () => {
      const result = await auditService.findAllForUser('adm', 'ADMIN', 'c1');

      expect(result).toEqual([]);
      expect(mockPrisma.calendar.findUnique).not.toHaveBeenCalled();
      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { targetCalendarId: 'c1' },
        }),
      );
    });

    it('deve filtrar com OR contendo 3 condições quando nenhum calendarId for informado para usuário comum', async () => {
      await auditService.findAllForUser('u1', 'USER');

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.any(Array),
          }),
        }),
      );

      const calledWhere = mockPrisma.auditLog.findMany.mock.calls[0][0].where;
      expect(calledWhere.OR).toHaveLength(3);
    });
  });
});
