import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AppointmentStatus, CalendarType, NotificationChannel, ReminderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CalendarAccessService } from '../calendars/calendar-access.service';
import { MetricsService } from '../monitoring/metrics.service';
import { CreateAppointmentDto, UpdateAppointmentDto } from './dto/appointment.dto';

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly calendarAccess: CalendarAccessService,
    private readonly metricsService: MetricsService,
  ) {}

  async findAllForCalendar(userId: string, userRole: string, calendarId: string, ipAddress?: string) {
    // Etapa 3 do Fluxo RBAC: Verifica JWT + papel + permissão de visualização na agenda
    await this.calendarAccess.verifyAccessOrThrow(userId, userRole, calendarId, 'VIEW', ipAddress);

    return this.prisma.appointment.findMany({
      where: { calendarId },
      include: {
        createdBy: { select: { id: true, name: true, email: true, role: true } },
        reminders: { orderBy: { createdAt: 'desc' } },
        calendar: {
          include: { owner: { select: { id: true, name: true, phoneWhatsapp: true, telegramChatId: true } } },
        },
      },
      orderBy: { startTime: 'asc' },
    });
  }

  /**
   * Implementa exatamente as etapas 5, 6 e 7 do Fluxo Principal e a Dupla Checagem do Fluxo RBAC:
   * - NestJS valida autenticação + RBAC + dados do compromisso
   * - Verifica conflito de horários em agendas profissionais
   * - Salva no PostgreSQL (Usuário, Agenda, Título, Data, Horário, Descrição, Config. lembrete, Status)
   * - Grava log de auditoria (quem criou / quando)
   * - Retorna 201 Created
   */
  async create(
    userId: string,
    userRole: string,
    dto: CreateAppointmentDto,
    createdVia: 'WEB' | 'WHATSAPP' | 'TELEGRAM' = 'WEB',
    ipAddress?: string,
  ) {
    // Dupla checagem RBAC para criação na agenda alvo
    const { calendar, isDelegated } = await this.calendarAccess.verifyAccessOrThrow(
      userId,
      userRole,
      dto.calendarId,
      'CREATE',
      ipAddress,
    );

    const startTime = new Date(dto.startTime);
    if (isNaN(startTime.getTime())) {
      throw new BadRequestException('Data/horário de início inválido');
    }

    const endTime = dto.endTime
      ? new Date(dto.endTime)
      : new Date(startTime.getTime() + 60 * 60 * 1000); // Padrão: 1 hora de duração

    if (endTime <= startTime) {
      throw new BadRequestException('O horário de término deve ser posterior ao horário de início');
    }

    // Validação de Conflito de Horários (Double-Booking) em agendas profissionais
    if (calendar.type === CalendarType.PROFESSIONAL) {
      const conflict = await this.prisma.appointment.findFirst({
        where: {
          calendarId: dto.calendarId,
          status: AppointmentStatus.SCHEDULED,
          AND: [
            { startTime: { lt: endTime } },
            { endTime: { gt: startTime } },
          ],
        },
      });

      if (conflict) {
        throw new BadRequestException(
          `Conflito de horário: Já existe o compromisso "${conflict.title}" agendado neste período na agenda profissional.`,
        );
      }
    }

    const reminderMinutesBefore = dto.reminderMinutesBefore ?? 30;
    // Se reminderMinutesBefore === 0, agenda o remindAt para 5 segundos atrás para que o Worker dispare no próximo ciclo imediatamente!
    const remindAt =
      reminderMinutesBefore === 0
        ? new Date(Date.now() - 5000)
        : new Date(startTime.getTime() - reminderMinutesBefore * 60 * 1000);

    const channel = dto.reminderChannel || NotificationChannel.WHATSAPP;

    const appointment = await this.prisma.appointment.create({
      data: {
        calendarId: dto.calendarId,
        createdById: userId,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        startTime,
        endTime,
        reminderMinutesBefore,
        status: AppointmentStatus.SCHEDULED,
        createdVia,
        reminders: {
          create: {
            remindAt,
            channel,
            status: ReminderStatus.PENDING,
          },
        },
      },
      include: {
        createdBy: { select: { id: true, name: true, email: true, role: true } },
        reminders: true,
        calendar: {
          include: { owner: { select: { id: true, name: true, email: true } } },
        },
      },
    });

    this.metricsService.incrementAppointmentCreated(createdVia);

    await this.auditService.log({
      actorUserId: userId,
      targetCalendarId: dto.calendarId,
      entityType: 'APPOINTMENT',
      entityId: appointment.id,
      action: 'CREATE',
      details: `${isDelegated ? '[Fluxo RBAC Delegado] ' : ''}Compromisso "${appointment.title}" criado na agenda "${calendar.name}" via ${createdVia}.`,
      metadata: {
        title: appointment.title,
        startTime: appointment.startTime,
        endTime: appointment.endTime,
        reminderChannel: channel,
        reminderMinutesBefore,
        isDelegated,
        createdVia,
      },
      ipAddress,
    });

    return appointment;
  }

  async update(
    userId: string,
    userRole: string,
    appointmentId: string,
    dto: UpdateAppointmentDto,
    ipAddress?: string,
  ) {
    const existing = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { reminders: true },
    });

    if (!existing) {
      throw new NotFoundException('Compromisso não encontrado');
    }

    const operation = dto.status === AppointmentStatus.CANCELLED ? 'CANCEL' : 'UPDATE';
    const { calendar, isDelegated } = await this.calendarAccess.verifyAccessOrThrow(
      userId,
      userRole,
      existing.calendarId,
      operation,
      ipAddress,
    );

    const startTime = dto.startTime ? new Date(dto.startTime) : existing.startTime;
    const endTime = dto.endTime ? new Date(dto.endTime) : existing.endTime;
    const reminderMinutesBefore = dto.reminderMinutesBefore ?? existing.reminderMinutesBefore;

    const updated = await this.prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        title: dto.title ?? existing.title,
        description: dto.description !== undefined ? dto.description : existing.description,
        startTime,
        endTime,
        reminderMinutesBefore,
        status: dto.status ?? existing.status,
      },
      include: {
        createdBy: { select: { id: true, name: true, email: true, role: true } },
        reminders: true,
      },
    });

    // Se o horário ou canal de lembrete mudou e o lembrete ainda estava PENDING, atualiza o lembrete
    if (dto.startTime || dto.reminderMinutesBefore !== undefined || dto.reminderChannel) {
      const remindAt =
        reminderMinutesBefore === 0
          ? new Date(Date.now() - 5000)
          : new Date(startTime.getTime() - reminderMinutesBefore * 60 * 1000);

      await this.prisma.reminder.updateMany({
        where: { appointmentId, status: ReminderStatus.PENDING },
        data: {
          remindAt,
          ...(dto.reminderChannel ? { channel: dto.reminderChannel } : {}),
        },
      });
    }

    await this.auditService.log({
      actorUserId: userId,
      targetCalendarId: existing.calendarId,
      entityType: 'APPOINTMENT',
      entityId: appointmentId,
      action: operation,
      details: `${isDelegated ? '[Fluxo RBAC Delegado] ' : ''}Compromisso "${updated.title}" ${
        operation === 'CANCEL' ? 'cancelado' : 'atualizado'
      } na agenda "${calendar.name}".`,
      metadata: {
        before: {
          title: existing.title,
          startTime: existing.startTime,
          status: existing.status,
        },
        after: {
          title: updated.title,
          startTime: updated.startTime,
          status: updated.status,
        },
        isDelegated,
      },
      ipAddress,
    });

    return updated;
  }

  async cancel(userId: string, userRole: string, appointmentId: string, ipAddress?: string) {
    return this.update(
      userId,
      userRole,
      appointmentId,
      { status: AppointmentStatus.CANCELLED },
      ipAddress,
    );
  }
}

