import { AppointmentStatus, CalendarType } from '@prisma/client';
import { GoogleSyncQueueService } from './google-sync-queue.service';
import { PrismaService } from '../prisma/prisma.service';
import { AppointmentsService } from '../appointments/appointments.service';
import { AuditService } from '../audit/audit.service';
import { CalendarAccessService } from '../calendars/calendar-access.service';
import { MetricsService } from '../monitoring/metrics.service';
import { ConflictService } from '../appointments/conflict.service';

describe('GoogleSyncQueueService', () => {
  let queueService: GoogleSyncQueueService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      googleSyncJob: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        deleteMany: jest.fn(),
      },
      appointment: {
        findMany: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    queueService = new GoogleSyncQueueService(
      mockPrisma as unknown as PrismaService,
    );
  });

  describe('enqueue', () => {
    it('deve criar novo job PENDING quando não houver job pendente para o compromisso', async () => {
      mockPrisma.googleSyncJob.findFirst.mockResolvedValue(null);
      mockPrisma.googleSyncJob.create.mockResolvedValue({
        id: 'job-1',
        appointmentId: 'appt-1',
        operation: 'UPSERT',
        status: 'PENDING',
      });

      const result = await queueService.enqueue('appt-1', 'UPSERT');

      expect(mockPrisma.googleSyncJob.findFirst).toHaveBeenCalledWith({
        where: {
          appointmentId: 'appt-1',
          status: 'PENDING',
        },
      });
      expect(mockPrisma.googleSyncJob.create).toHaveBeenCalledWith({
        data: {
          appointmentId: 'appt-1',
          operation: 'UPSERT',
          status: 'PENDING',
          nextRetryAt: null,
        },
      });
      expect(result).toEqual(
        expect.objectContaining({ id: 'job-1', operation: 'UPSERT' }),
      );
    });

    it('deve atualizar a operação e zerar nextRetryAt se já houver job PENDING', async () => {
      mockPrisma.googleSyncJob.findFirst.mockResolvedValue({
        id: 'job-existing',
        appointmentId: 'appt-1',
        operation: 'UPSERT',
        status: 'PENDING',
        nextRetryAt: new Date(),
      });
      mockPrisma.googleSyncJob.update.mockResolvedValue({
        id: 'job-existing',
        appointmentId: 'appt-1',
        operation: 'DELETE',
        status: 'PENDING',
        nextRetryAt: null,
      });

      const result = await queueService.enqueue('appt-1', 'DELETE');

      expect(mockPrisma.googleSyncJob.update).toHaveBeenCalledWith({
        where: { id: 'job-existing' },
        data: {
          operation: 'DELETE',
          nextRetryAt: null,
        },
      });
      expect(mockPrisma.googleSyncJob.create).not.toHaveBeenCalled();
      expect(result).toEqual(
        expect.objectContaining({ id: 'job-existing', operation: 'DELETE' }),
      );
    });

    it('deve usar o client de transação (tx) se fornecido', async () => {
      const mockTx = {
        googleSyncJob: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({ id: 'job-tx' }),
        },
      };

      await queueService.enqueue('appt-tx', 'UPSERT', mockTx);

      expect(mockTx.googleSyncJob.findFirst).toHaveBeenCalled();
      expect(mockTx.googleSyncJob.create).toHaveBeenCalled();
      expect(mockPrisma.googleSyncJob.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('enqueueCalendar', () => {
    it('deve enfileirar UPSERT somente para compromissos SCHEDULED com endTime >= agora - 1 dia', async () => {
      const mockAppointments = [{ id: 'appt-rec-1' }, { id: 'appt-rec-2' }];
      mockPrisma.appointment.findMany.mockResolvedValue(mockAppointments);
      mockPrisma.googleSyncJob.findFirst.mockResolvedValue(null);
      mockPrisma.googleSyncJob.create.mockResolvedValue({ id: 'job-new' });

      await queueService.enqueueCalendar('cal-1');

      expect(mockPrisma.appointment.findMany).toHaveBeenCalledWith({
        where: {
          calendarId: 'cal-1',
          status: AppointmentStatus.SCHEDULED,
          endTime: { gte: expect.any(Date) },
        },
        select: { id: true },
      });

      expect(mockPrisma.googleSyncJob.create).toHaveBeenCalledTimes(2);
      expect(mockPrisma.googleSyncJob.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            appointmentId: 'appt-rec-1',
            operation: 'UPSERT',
          }),
        }),
      );
      expect(mockPrisma.googleSyncJob.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            appointmentId: 'appt-rec-2',
            operation: 'UPSERT',
          }),
        }),
      );
    });
  });

  describe('dropCalendar', () => {
    it('deve apagar jobs PENDING da agenda e zerar os campos no appointment', async () => {
      mockPrisma.googleSyncJob.deleteMany.mockResolvedValue({ count: 3 });
      mockPrisma.appointment.updateMany.mockResolvedValue({ count: 5 });

      await queueService.dropCalendar('cal-1');

      expect(mockPrisma.googleSyncJob.deleteMany).toHaveBeenCalledWith({
        where: {
          status: 'PENDING',
          appointment: {
            calendarId: 'cal-1',
          },
        },
      });

      expect(mockPrisma.appointment.updateMany).toHaveBeenCalledWith({
        where: { calendarId: 'cal-1' },
        data: {
          googleEventId: null,
          googleSyncError: null,
          googleSyncedAt: null,
        },
      });
    });
  });

  describe('Integração de compromissos com a fila', () => {
    let appointmentsService: AppointmentsService;
    let mockAuditService: any;
    let mockCalendarAccess: any;
    let mockMetricsService: any;
    let mockSyncQueue: any;

    const linkedCalendar = {
      id: 'cal-linked',
      name: 'Agenda com Google',
      type: CalendarType.PERSONAL,
      ownerId: 'owner-1',
      googleCalendarId: 'primary',
    };

    const unlinkedCalendar = {
      id: 'cal-unlinked',
      name: 'Agenda sem Google',
      type: CalendarType.PERSONAL,
      ownerId: 'owner-1',
      googleCalendarId: null,
    };

    const baseAppointment = {
      id: 'app-sync-1',
      calendarId: 'cal-linked',
      createdById: 'user-1',
      title: 'Consulta Integrada',
      startTime: new Date('2026-11-20T10:00:00.000Z'),
      endTime: new Date('2026-11-20T11:00:00.000Z'),
      reminderMinutesBefore: 30,
      status: AppointmentStatus.SCHEDULED,
      createdVia: 'WEB',
      reminders: [],
    };

    beforeEach(() => {
      mockAuditService = { log: jest.fn().mockResolvedValue({ id: 'audit-1' }) };
      mockCalendarAccess = { verifyAccessOrThrow: jest.fn() };
      mockMetricsService = {
        incrementAppointmentCreated: jest.fn(),
        incrementRbacDenied: jest.fn(),
      };
      mockSyncQueue = {
        enqueue: jest.fn().mockResolvedValue({ id: 'job-1' }),
      };

      mockPrisma.appointment = {
        findUnique: jest.fn().mockResolvedValue(baseAppointment),
        create: jest.fn().mockResolvedValue(baseAppointment),
        update: jest.fn().mockResolvedValue(baseAppointment),
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
      };

      mockPrisma.reminder = {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockResolvedValue({ id: 'rem-1' }),
      };

      appointmentsService = new AppointmentsService(
        mockPrisma as unknown as PrismaService,
        mockAuditService as unknown as AuditService,
        mockCalendarAccess as unknown as CalendarAccessService,
        mockMetricsService as unknown as MetricsService,
        { recalculateCalendar: jest.fn().mockResolvedValue(undefined) } as unknown as ConflictService,
        mockSyncQueue as unknown as GoogleSyncQueueService,
      );
    });

    it('criar compromisso numa agenda ligada enfileira UPSERT', async () => {
      mockCalendarAccess.verifyAccessOrThrow.mockResolvedValue({
        calendar: linkedCalendar,
        isDelegated: false,
      });

      await appointmentsService.create('user-1', 'USER', {
        calendarId: 'cal-linked',
        title: 'Consulta',
        startTime: '2026-11-20T10:00:00.000Z',
      });

      expect(mockSyncQueue.enqueue).toHaveBeenCalledWith(
        'app-sync-1',
        'UPSERT',
      );
    });

    it('alterar compromisso numa agenda ligada enfileira UPSERT', async () => {
      mockCalendarAccess.verifyAccessOrThrow.mockResolvedValue({
        calendar: linkedCalendar,
        isDelegated: false,
      });

      await appointmentsService.update('user-1', 'USER', 'app-sync-1', {
        title: 'Consulta Alterada',
      });

      expect(mockSyncQueue.enqueue).toHaveBeenCalledWith(
        'app-sync-1',
        'UPSERT',
      );
    });

    it('cancelar compromisso numa agenda ligada enfileira DELETE', async () => {
      mockCalendarAccess.verifyAccessOrThrow.mockResolvedValue({
        calendar: linkedCalendar,
        isDelegated: false,
      });

      mockPrisma.appointment.findUnique.mockResolvedValue({
        ...baseAppointment,
        status: AppointmentStatus.CANCELLED,
      });

      await appointmentsService.cancel('user-1', 'USER', 'app-sync-1');

      expect(mockSyncQueue.enqueue).toHaveBeenCalledWith(
        'app-sync-1',
        'DELETE',
      );
    });

    it('criar compromisso numa agenda NÃO ligada não enfileira', async () => {
      mockCalendarAccess.verifyAccessOrThrow.mockResolvedValue({
        calendar: unlinkedCalendar,
        isDelegated: false,
      });

      await appointmentsService.create('user-1', 'USER', {
        calendarId: 'cal-unlinked',
        title: 'Consulta',
        startTime: '2026-11-20T10:00:00.000Z',
      });

      expect(mockSyncQueue.enqueue).not.toHaveBeenCalled();
    });

    it('alterar compromisso numa agenda NÃO ligada não enfileira', async () => {
      mockCalendarAccess.verifyAccessOrThrow.mockResolvedValue({
        calendar: unlinkedCalendar,
        isDelegated: false,
      });

      await appointmentsService.update('user-1', 'USER', 'app-sync-1', {
        title: 'Consulta',
      });

      expect(mockSyncQueue.enqueue).not.toHaveBeenCalled();
    });
  });
});
