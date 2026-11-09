import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateAuditLogInput {
  actorUserId?: string;
  targetCalendarId?: string;
  entityType: 'APPOINTMENT' | 'PERMISSION' | 'AUTH' | 'RBAC' | 'CHATBOT';
  entityId?: string;
  action: 'CREATE' | 'UPDATE' | 'CANCEL' | 'ACCESS_DENIED' | 'LOGIN' | 'BOT_COMMAND';
  details: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(input: CreateAuditLogInput) {
    return this.prisma.auditLog.create({
      data: {
        actorUserId: input.actorUserId ?? null,
        targetCalendarId: input.targetCalendarId ?? null,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        action: input.action,
        details: input.details,
        metadata: input.metadata ?? {},
        ipAddress: input.ipAddress ?? '127.0.0.1',
      },
    });
  }

  async findAllForUser(userId: string, role: string, calendarId?: string) {
    const where: any = {};

    if (calendarId) {
      where.targetCalendarId = calendarId;
    } else if (role !== 'ADMIN') {
      where.OR = [
        { actorUserId: userId },
        { targetCalendar: { ownerId: userId } },
        {
          targetCalendar: {
            permissions: {
              some: { granteeUserId: userId, canView: true },
            },
          },
        },
      ];
    }

    return this.prisma.auditLog.findMany({
      where,
      include: {
        actorUser: {
          select: { id: true, name: true, email: true, role: true },
        },
        targetCalendar: {
          select: { id: true, name: true, type: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}

