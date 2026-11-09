import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CalendarAccessService } from './calendar-access.service';
import { CreateCalendarDto, GrantPermissionDto } from './dto/calendar.dto';

@Injectable()
export class CalendarsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly calendarAccess: CalendarAccessService,
  ) {}

  async findAllAccessible(userId: string) {
    const owned = await this.prisma.calendar.findMany({
      where: { ownerId: userId },
      include: {
        owner: { select: { id: true, name: true, email: true, role: true } },
        permissions: {
          include: {
            granteeUser: { select: { id: true, name: true, email: true, role: true } },
          },
        },
        _count: { select: { appointments: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const delegatedPerms = await this.prisma.calendarPermission.findMany({
      where: { granteeUserId: userId, canView: true },
      include: {
        calendar: {
          include: {
            owner: { select: { id: true, name: true, email: true, role: true } },
            _count: { select: { appointments: true } },
          },
        },
      },
    });

    return {
      owned,
      delegated: delegatedPerms.map((p) => ({
        ...p.calendar,
        myPermissions: {
          canView: p.canView,
          canCreate: p.canCreate,
          canUpdate: p.canUpdate,
          canCancel: p.canCancel,
        },
      })),
    };
  }

  /**
   * Lista todos os profissionais e suas agendas profissionais para que a Secretária possa selecionar
   * na interface (ex.: Dr. João autorizado vs Dra. Ana não autorizada) e testar o Fluxo RBAC do diagrama!
   */
  async listProfessionalsDirectory(currentUserId: string) {
    const professionals = await this.prisma.user.findMany({
      where: { role: 'PROFESSIONAL' },
      select: {
        id: true,
        name: true,
        email: true,
        ownedCalendars: {
          where: { type: 'PROFESSIONAL' },
          include: {
            permissions: {
              where: { granteeUserId: currentUserId },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return professionals.map((prof) => ({
      id: prof.id,
      name: prof.name,
      email: prof.email,
      calendars: prof.ownedCalendars.map((cal) => {
        const perm = cal.permissions[0];
        return {
          id: cal.id,
          name: cal.name,
          description: cal.description,
          color: cal.color,
          hasRbacAuthorization: Boolean(perm && perm.canView),
          permissions: perm
            ? {
                canView: perm.canView,
                canCreate: perm.canCreate,
                canUpdate: perm.canUpdate,
                canCancel: perm.canCancel,
              }
            : null,
        };
      }),
    }));
  }

  async create(userId: string, dto: CreateCalendarDto) {
    return this.prisma.calendar.create({
      data: {
        ownerId: userId,
        name: dto.name,
        type: dto.type,
        description: dto.description,
        color: dto.color || (dto.type === 'PROFESSIONAL' ? '#16A34A' : '#2563EB'),
      },
    });
  }

  async grantPermission(ownerId: string, calendarId: string, dto: GrantPermissionDto, ipAddress?: string) {
    const calendar = await this.prisma.calendar.findUnique({ where: { id: calendarId } });
    if (!calendar) throw new NotFoundException('Agenda não encontrada');
    if (calendar.ownerId !== ownerId) {
      throw new ForbiddenException('Apenas o proprietário da agenda pode delegar permissões RBAC');
    }

    const secretary = await this.prisma.user.findUnique({
      where: { email: dto.secretaryEmail.toLowerCase().trim() },
    });
    if (!secretary) {
      throw new BadRequestException(`Nenhum usuário encontrado com o e-mail ${dto.secretaryEmail}`);
    }

    const perm = await this.prisma.calendarPermission.upsert({
      where: {
        calendarId_granteeUserId: {
          calendarId,
          granteeUserId: secretary.id,
        },
      },
      update: {
        canView: dto.canView ?? true,
        canCreate: dto.canCreate ?? true,
        canUpdate: dto.canUpdate ?? true,
        canCancel: dto.canCancel ?? true,
      },
      create: {
        calendarId,
        granteeUserId: secretary.id,
        canView: dto.canView ?? true,
        canCreate: dto.canCreate ?? true,
        canUpdate: dto.canUpdate ?? true,
        canCancel: dto.canCancel ?? true,
      },
      include: {
        granteeUser: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    await this.auditService.log({
      actorUserId: ownerId,
      targetCalendarId: calendarId,
      entityType: 'PERMISSION',
      entityId: perm.id,
      action: 'UPDATE',
      details: `Permissão RBAC concedida para ${secretary.name} (${secretary.email}) na agenda "${calendar.name}".`,
      metadata: {
        canView: perm.canView,
        canCreate: perm.canCreate,
        canUpdate: perm.canUpdate,
        canCancel: perm.canCancel,
      },
      ipAddress,
    });

    return perm;
  }

  async revokePermission(ownerId: string, calendarId: string, granteeUserId: string, ipAddress?: string) {
    const calendar = await this.prisma.calendar.findUnique({ where: { id: calendarId } });
    if (!calendar) throw new NotFoundException('Agenda não encontrada');
    if (calendar.ownerId !== ownerId) {
      throw new ForbiddenException('Apenas o proprietário da agenda pode revogar permissões RBAC');
    }

    await this.prisma.calendarPermission.delete({
      where: {
        calendarId_granteeUserId: {
          calendarId,
          granteeUserId,
        },
      },
    });

    await this.auditService.log({
      actorUserId: ownerId,
      targetCalendarId: calendarId,
      entityType: 'PERMISSION',
      entityId: granteeUserId,
      action: 'CANCEL',
      details: `Permissão RBAC revogada na agenda "${calendar.name}".`,
      ipAddress,
    });

    return { revoked: true };
  }
}

