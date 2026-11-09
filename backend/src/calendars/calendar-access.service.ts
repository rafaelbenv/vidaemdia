import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { MetricsService } from '../monitoring/metrics.service';

export type CalendarOperation = 'VIEW' | 'CREATE' | 'UPDATE' | 'CANCEL';

@Injectable()
export class CalendarAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly metricsService: MetricsService,
  ) {}

  /**
   * Implementa a verificação RBAC e Dupla Checagem descrita no diagrama VidaEmDia_Fluxo.drawio.html:
   * - Se o usuário é dono da agenda -> permitido.
   * - Se o usuário é SECRETÁRIA (ou outro usuário delegado) -> verifica na tabela calendar_permissions
   *   se possui autorização para a operação solicitada (VIEW, CREATE, UPDATE, CANCEL).
   * - Caso não possua, incrementa métrica de bloqueio RBAC, grava Log de Auditoria e lança 403 Forbidden.
   */
  async verifyAccessOrThrow(
    userId: string,
    userRole: string,
    calendarId: string,
    operation: CalendarOperation,
    ipAddress?: string,
  ) {
    const calendar = await this.prisma.calendar.findUnique({
      where: { id: calendarId },
      include: {
        owner: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    if (!calendar) {
      throw new NotFoundException('Agenda não encontrada');
    }

    // Dono da própria agenda ou ADMIN tem acesso total
    if (calendar.ownerId === userId || userRole === 'ADMIN') {
      return { calendar, isDelegated: false };
    }

    // Verificação na tabela de delegação RBAC (ex.: Secretária acessando agenda de um Profissional)
    const permission = await this.prisma.calendarPermission.findUnique({
      where: {
        calendarId_granteeUserId: {
          calendarId,
          granteeUserId: userId,
        },
      },
    });

    const hasPermission =
      permission &&
      ((operation === 'VIEW' && permission.canView) ||
        (operation === 'CREATE' && permission.canCreate) ||
        (operation === 'UPDATE' && permission.canUpdate) ||
        (operation === 'CANCEL' && permission.canCancel));

    if (!hasPermission) {
      this.metricsService.incrementRbacDenied();

      await this.auditService.log({
        actorUserId: userId,
        targetCalendarId: calendarId,
        entityType: 'RBAC',
        entityId: calendarId,
        action: 'ACCESS_DENIED',
        details: `403 Acesso negado: Usuário (${userRole}) tentou executar [${operation}] na agenda "${calendar.name}" (${calendar.owner.name}) sem autorização RBAC.`,
        metadata: { operation, userRole, calendarOwner: calendar.owner.name },
        ipAddress,
      });

      throw new ForbiddenException(
        `403 Acesso negado: Você não possui autorização RBAC para realizar a operação [${operation}] na agenda "${calendar.name}" (${calendar.owner.name}).`,
      );
    }

    return { calendar, isDelegated: true, permission };
  }
}

