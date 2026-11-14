import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AppointmentStatus, CalendarType, NotificationChannel, ReminderStatus } from '@prisma/client';
import { AppointmentsService } from './appointments.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CalendarAccessService } from '../calendars/calendar-access.service';
import { MetricsService } from '../monitoring/metrics.service';
import { CreateAppointmentDto, UpdateAppointmentDto } from './dto/appointment.dto';

describe('AppointmentsService', () => {
  let service: AppointmentsService;
  let mockPrisma: any;
  let mockAuditService: any;
  let mockCalendarAccess: any;
  let mockMetricsService: any;

  const baseCalendar = {
    id: 'cal-1',
    name: 'Agenda Teste',
    type: CalendarType.PERSONAL,
    ownerId: 'owner-1',
  };

  const baseAppointment = {
    id: 'app-1',
    calendarId: 'cal-1',
    createdById: 'user-1',
    title: 'Consulta Teste',
    description: 'Desc',
    startTime: new Date('2026-11-20T10:00:00.000Z'),
    endTime: new Date('2026-11-20T11:00:00.000Z'),
    allDay: false,
    reminderMinutesBefore: 30,
    status: AppointmentStatus.SCHEDULED,
    createdVia: 'WEB',
    reminders: [],
  };

  beforeEach(() => {
    mockPrisma = {
      appointment: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn().mockResolvedValue(baseAppointment),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'app-new', ...data, reminders: [] })),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...baseAppointment, ...data })),
      },
      reminder: {
        findMany: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'rem-new', ...data })),
      },
    };

    mockAuditService = {
      log: jest.fn().mockResolvedValue({ id: 'audit-1' }),
    };

    mockCalendarAccess = {
      verifyAccessOrThrow: jest.fn().mockResolvedValue({
        calendar: baseCalendar,
        isDelegated: false,
      }),
    };

    mockMetricsService = {
      incrementAppointmentCreated: jest.fn(),
      incrementRbacDenied: jest.fn(),
    };

    service = new AppointmentsService(
      mockPrisma as unknown as PrismaService,
      mockAuditService as unknown as AuditService,
      mockCalendarAccess as unknown as CalendarAccessService,
      mockMetricsService as unknown as MetricsService,
    );
  });

  describe('create', () => {
    it('create com reminderMinutesBefore: 0 deve definir remindAt igual ao startTime', async () => {
      const startTimeStr = '2026-11-20T10:00:00.000Z';
      const dto: CreateAppointmentDto = {
        calendarId: 'cal-1',
        title: 'Consulta',
        startTime: startTimeStr,
        reminderMinutesBefore: 0,
      };

      await service.create('user-1', 'USER', dto);

      expect(mockPrisma.appointment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            reminderMinutesBefore: 0,
            reminders: {
              create: expect.objectContaining({
                remindAt: new Date(startTimeStr),
              }),
            },
          }),
        }),
      );
    });

    it('create com reminderMinutesBefore: 1440 deve definir remindAt 24 horas antes do startTime', async () => {
      const startTime = new Date('2026-11-20T10:00:00.000Z');
      const expectedRemindAt = new Date('2026-11-19T10:00:00.000Z');
      const dto: CreateAppointmentDto = {
        calendarId: 'cal-1',
        title: 'Consulta',
        startTime: startTime.toISOString(),
        reminderMinutesBefore: 1440,
      };

      await service.create('user-1', 'USER', dto);

      expect(mockPrisma.appointment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            reminderMinutesBefore: 1440,
            reminders: {
              create: expect.objectContaining({
                remindAt: expectedRemindAt,
              }),
            },
          }),
        }),
      );
    });

    it('create com reminderEnabled: false deve criar compromisso sem a chave reminders em data', async () => {
      const dto: CreateAppointmentDto = {
        calendarId: 'cal-1',
        title: 'Consulta Sem Lembrete',
        startTime: '2026-11-20T10:00:00.000Z',
        reminderEnabled: false,
      };

      await service.create('user-1', 'USER', dto);

      expect(mockPrisma.appointment.create).toHaveBeenCalledTimes(1);
      const callArgs = mockPrisma.appointment.create.mock.calls[0][0];
      expect(callArgs.data).not.toHaveProperty('reminders');
    });

    it('agenda PROFESSIONAL com compromisso sobreposto deve lançar BadRequestException ("Conflito de horário") e não chamar prisma.appointment.create', async () => {
      mockCalendarAccess.verifyAccessOrThrow.mockResolvedValue({
        calendar: { ...baseCalendar, type: CalendarType.PROFESSIONAL },
        isDelegated: false,
      });

      mockPrisma.appointment.findFirst.mockResolvedValue({
        id: 'app-conflict',
        title: 'Compromisso Conflitante',
      });

      const startTimeStr = '2026-11-20T10:00:00.000Z';
      const endTimeStr = '2026-11-20T11:00:00.000Z';
      const dto: CreateAppointmentDto = {
        calendarId: 'cal-1',
        title: 'Nova Consulta',
        startTime: startTimeStr,
        endTime: endTimeStr,
      };

      await expect(service.create('user-1', 'USER', dto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.create('user-1', 'USER', dto)).rejects.toThrow(
        'Conflito de horário',
      );

      expect(mockPrisma.appointment.create).not.toHaveBeenCalled();
      expect(mockPrisma.appointment.findFirst).toHaveBeenCalledWith({
        where: {
          calendarId: 'cal-1',
          status: AppointmentStatus.SCHEDULED,
          allDay: false,
          AND: [
            { startTime: { lt: new Date(endTimeStr) } },
            { endTime: { gt: new Date(startTimeStr) } },
          ],
        },
      });
    });

    it('agenda PERSONAL com o mesmo cenário deve criar normalmente sem chamar findFirst', async () => {
      mockCalendarAccess.verifyAccessOrThrow.mockResolvedValue({
        calendar: { ...baseCalendar, type: CalendarType.PERSONAL },
        isDelegated: false,
      });

      const dto: CreateAppointmentDto = {
        calendarId: 'cal-1',
        title: 'Consulta Pessoal',
        startTime: '2026-11-20T10:00:00.000Z',
        endTime: '2026-11-20T11:00:00.000Z',
      };

      await service.create('user-1', 'USER', dto);

      expect(mockPrisma.appointment.findFirst).not.toHaveBeenCalled();
      expect(mockPrisma.appointment.create).toHaveBeenCalled();
    });

    it('em agenda PROFESSIONAL encostando sem sobrepor (findFirst devolve null) deve criar o compromisso', async () => {
      mockCalendarAccess.verifyAccessOrThrow.mockResolvedValue({
        calendar: { ...baseCalendar, type: CalendarType.PROFESSIONAL },
        isDelegated: false,
      });
      mockPrisma.appointment.findFirst.mockResolvedValue(null);

      const dto: CreateAppointmentDto = {
        calendarId: 'cal-1',
        title: 'Consulta Sequencial',
        startTime: '2026-11-20T11:00:00.000Z',
        endTime: '2026-11-20T12:00:00.000Z',
      };

      await service.create('user-1', 'USER', dto);

      expect(mockPrisma.appointment.findFirst).toHaveBeenCalled();
      expect(mockPrisma.appointment.create).toHaveBeenCalled();
    });

    it('startTime inválido ("não é data") deve lançar BadRequestException e não criar compromisso', async () => {
      const dto: CreateAppointmentDto = {
        calendarId: 'cal-1',
        title: 'Consulta Data Inválida',
        startTime: 'não é data',
      };

      await expect(service.create('user-1', 'USER', dto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.create('user-1', 'USER', dto)).rejects.toThrow(
        'Data/horário de início inválido',
      );
      expect(mockPrisma.appointment.create).not.toHaveBeenCalled();
    });

    it('endTime igual ou anterior ao startTime deve lançar BadRequestException e não criar compromisso', async () => {
      const dtoEqual: CreateAppointmentDto = {
        calendarId: 'cal-1',
        title: 'Consulta Término Igual',
        startTime: '2026-11-20T10:00:00.000Z',
        endTime: '2026-11-20T10:00:00.000Z',
      };

      await expect(service.create('user-1', 'USER', dtoEqual)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.create('user-1', 'USER', dtoEqual)).rejects.toThrow(
        'O horário de término deve ser posterior ao horário de início',
      );

      const dtoBefore: CreateAppointmentDto = {
        calendarId: 'cal-1',
        title: 'Consulta Término Anterior',
        startTime: '2026-11-20T10:00:00.000Z',
        endTime: '2026-11-20T09:00:00.000Z',
      };

      await expect(service.create('user-1', 'USER', dtoBefore)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.create('user-1', 'USER', dtoBefore)).rejects.toThrow(
        'O horário de término deve ser posterior ao horário de início',
      );

      expect(mockPrisma.appointment.create).not.toHaveBeenCalled();
    });

    it('sem endTime deve definir endTime = início + 1 hora', async () => {
      const startTimeStr = '2026-11-20T10:00:00.000Z';
      const expectedEndTime = new Date('2026-11-20T11:00:00.000Z');
      const dto: CreateAppointmentDto = {
        calendarId: 'cal-1',
        title: 'Consulta Duração Padrão',
        startTime: startTimeStr,
      };

      await service.create('user-1', 'USER', dto);

      expect(mockPrisma.appointment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            startTime: new Date(startTimeStr),
            endTime: expectedEndTime,
          }),
        }),
      );
    });

    it('sem permissão (calendarAccess.verifyAccessOrThrow rejeita com ForbiddenException) a exceção sobe e nada é criado', async () => {
      mockCalendarAccess.verifyAccessOrThrow.mockRejectedValue(
        new ForbiddenException('Acesso negado à agenda'),
      );

      const dto: CreateAppointmentDto = {
        calendarId: 'cal-1',
        title: 'Consulta Sem Acesso',
        startTime: '2026-11-20T10:00:00.000Z',
      };

      await expect(service.create('user-1', 'USER', dto)).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockPrisma.appointment.create).not.toHaveBeenCalled();
    });

    it('sucesso grava auditoria com action CREATE e metadata (title/startTime) e incrementa métrica de compromisso criado com origem padrão WEB', async () => {
      const dto: CreateAppointmentDto = {
        calendarId: 'cal-1',
        title: 'Consulta Nova Auditoria',
        startTime: '2026-11-20T10:00:00.000Z',
      };

      await service.create('user-1', 'USER', dto);

      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CREATE',
          metadata: expect.objectContaining({
            title: dto.title,
            startTime: new Date(dto.startTime),
          }),
        }),
      );
      expect(mockMetricsService.incrementAppointmentCreated).toHaveBeenCalledWith('WEB');
    });

    it('sucesso incrementa métrica de compromisso criado com origem TELEGRAM quando passado explicitamente', async () => {
      const dto: CreateAppointmentDto = {
        calendarId: 'cal-1',
        title: 'Consulta Origem Telegram',
        startTime: '2026-11-20T10:00:00.000Z',
      };

      await service.create('user-1', 'USER', dto, 'TELEGRAM');

      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CREATE',
          metadata: expect.objectContaining({
            title: dto.title,
            startTime: new Date(dto.startTime),
            createdVia: 'TELEGRAM',
          }),
        }),
      );
      expect(mockMetricsService.incrementAppointmentCreated).toHaveBeenCalledWith('TELEGRAM');
    });

    it('criar com allDay normaliza para 00:00 −03:00 e dia seguinte, lembrete às 08:00, sem checagem de conflito mesmo em agenda PROFISSIONAL', async () => {
      mockCalendarAccess.verifyAccessOrThrow.mockResolvedValue({
        calendar: { ...baseCalendar, type: CalendarType.PROFESSIONAL },
        isDelegated: false,
      });

      const dto: CreateAppointmentDto = {
        calendarId: 'cal-1',
        title: 'Dia Inteiro Congresso',
        startTime: '2026-11-20T15:00:00.000Z',
        allDay: true,
      };

      await service.create('user-1', 'USER', dto);

      expect(mockPrisma.appointment.findFirst).not.toHaveBeenCalled();

      const expectedStart = new Date('2026-11-20T03:00:00.000Z');
      const expectedEnd = new Date('2026-11-21T03:00:00.000Z');
      const expectedRemindAt = new Date('2026-11-20T11:00:00.000Z');

      expect(mockPrisma.appointment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            allDay: true,
            startTime: expectedStart,
            endTime: expectedEnd,
            reminders: {
              create: expect.objectContaining({
                remindAt: expectedRemindAt,
              }),
            },
          }),
        }),
      );
    });
  });

  describe('update', () => {
    it('update mudando só startTime deve manter a duração original do compromisso', async () => {
      const existing = {
        ...baseAppointment,
        startTime: new Date('2026-11-20T10:00:00.000Z'),
        endTime: new Date('2026-11-20T11:30:00.000Z'), // 90 min de duração
        reminders: [],
      };
      mockPrisma.appointment.findUnique.mockResolvedValue(existing);

      const dto: UpdateAppointmentDto = {
        startTime: '2026-11-21T14:00:00.000Z',
      };

      await service.update('user-1', 'USER', 'app-1', dto);

      const expectedEndTime = new Date('2026-11-21T15:30:00.000Z'); // 14:00 + 90 min
      expect(mockPrisma.appointment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'app-1' },
          data: expect.objectContaining({
            startTime: new Date('2026-11-21T14:00:00.000Z'),
            endTime: expectedEndTime,
          }),
        }),
      );
    });

    it('update com endTime antes ou igual ao startTime deve lançar BadRequestException', async () => {
      const existing = {
        ...baseAppointment,
        startTime: new Date('2026-11-20T10:00:00.000Z'),
        endTime: new Date('2026-11-20T11:00:00.000Z'),
      };
      mockPrisma.appointment.findUnique.mockResolvedValue(existing);

      const dto: UpdateAppointmentDto = {
        startTime: '2026-11-20T10:00:00.000Z',
        endTime: '2026-11-20T09:00:00.000Z',
      };

      await expect(service.update('user-1', 'USER', 'app-1', dto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.update('user-1', 'USER', 'app-1', dto)).rejects.toThrow(
        'O horário de término deve ser posterior ao horário de início',
      );
    });

    it('update em agenda PROFESSIONAL com conflito deve lançar BadRequestException e excluir o próprio id na busca', async () => {
      mockCalendarAccess.verifyAccessOrThrow.mockResolvedValue({
        calendar: { ...baseCalendar, type: CalendarType.PROFESSIONAL },
        isDelegated: false,
      });

      const existing = {
        ...baseAppointment,
        startTime: new Date('2026-11-20T10:00:00.000Z'),
        endTime: new Date('2026-11-20T11:00:00.000Z'),
      };
      mockPrisma.appointment.findUnique.mockResolvedValue(existing);

      mockPrisma.appointment.findFirst.mockResolvedValue({
        id: 'app-2',
        title: 'Outro Compromisso',
      });

      const dto: UpdateAppointmentDto = {
        startTime: '2026-11-20T14:00:00.000Z',
        endTime: '2026-11-20T15:00:00.000Z',
      };

      await expect(service.update('user-1', 'USER', 'app-1', dto)).rejects.toThrow(
        BadRequestException,
      );

      expect(mockPrisma.appointment.findFirst).toHaveBeenCalledWith({
        where: {
          calendarId: 'cal-1',
          id: { not: 'app-1' },
          status: AppointmentStatus.SCHEDULED,
          allDay: false,
          AND: [
            { startTime: { lt: new Date('2026-11-20T15:00:00.000Z') } },
            { endTime: { gt: new Date('2026-11-20T14:00:00.000Z') } },
          ],
        },
      });
    });

    it('update com reminderEnabled: false deve chamar reminder.deleteMany com status PENDING', async () => {
      const existing = {
        ...baseAppointment,
        reminders: [
          { id: 'rem-1', status: ReminderStatus.PENDING, channel: NotificationChannel.TELEGRAM },
        ],
      };
      mockPrisma.appointment.findUnique.mockResolvedValue(existing);

      const dto: UpdateAppointmentDto = {
        reminderEnabled: false,
      };

      await service.update('user-1', 'USER', 'app-1', dto);

      expect(mockPrisma.reminder.deleteMany).toHaveBeenCalledWith({
        where: { appointmentId: 'app-1', status: ReminderStatus.PENDING },
      });
    });

    it('update mudando startTime sem lembrete PENDING (só um SENT) deve chamar reminder.create', async () => {
      const existing = {
        ...baseAppointment,
        startTime: new Date('2026-11-20T10:00:00.000Z'),
        endTime: new Date('2026-11-20T11:00:00.000Z'),
        reminderMinutesBefore: 30,
        reminders: [
          {
            id: 'rem-old',
            status: ReminderStatus.SENT,
            channel: NotificationChannel.TELEGRAM,
            createdAt: new Date('2026-11-19T09:00:00.000Z'),
          },
        ],
      };
      mockPrisma.appointment.findUnique.mockResolvedValue(existing);

      const dto: UpdateAppointmentDto = {
        startTime: '2026-11-21T10:00:00.000Z',
      };

      await service.update('user-1', 'USER', 'app-1', dto);

      expect(mockPrisma.reminder.create).toHaveBeenCalledWith({
        data: {
          appointmentId: 'app-1',
          remindAt: new Date('2026-11-21T09:30:00.000Z'),
          channel: NotificationChannel.TELEGRAM,
          status: ReminderStatus.PENDING,
        },
      });
    });

    it('update só com título e mesmo startTime/minutos, com um lembrete SENT não deve chamar reminder.create', async () => {
      const existing = {
        ...baseAppointment,
        startTime: new Date('2026-11-20T10:00:00.000Z'),
        endTime: new Date('2026-11-20T11:00:00.000Z'),
        reminderMinutesBefore: 30,
        reminders: [
          {
            id: 'rem-sent',
            status: ReminderStatus.SENT,
            remindAt: new Date('2026-11-20T09:30:00.000Z'),
            channel: NotificationChannel.TELEGRAM,
            createdAt: new Date('2026-11-19T09:00:00.000Z'),
          },
        ],
      };
      mockPrisma.appointment.findUnique.mockResolvedValue(existing);

      const dto: UpdateAppointmentDto = {
        title: 'Título Atualizado',
        startTime: '2026-11-20T10:00:00.000Z',
        reminderMinutesBefore: 30,
      };

      await service.update('user-1', 'USER', 'app-1', dto);

      expect(mockPrisma.reminder.create).not.toHaveBeenCalled();
    });

    it('update movendo o compromisso para o futuro, com um lembrete SENT antigo deve chamar reminder.create', async () => {
      const futureStart = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
      const futureEnd = new Date(futureStart.getTime() + 60 * 60 * 1000);
      const expectedRemindAt = new Date(futureStart.getTime() - 30 * 60 * 1000);

      const pastStart = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      const pastEnd = new Date(pastStart.getTime() + 60 * 60 * 1000);
      const pastRemindAt = new Date(pastStart.getTime() - 30 * 60 * 1000);

      const existing = {
        ...baseAppointment,
        startTime: pastStart,
        endTime: pastEnd,
        reminderMinutesBefore: 30,
        reminders: [
          {
            id: 'rem-old-sent',
            status: ReminderStatus.SENT,
            remindAt: pastRemindAt,
            channel: NotificationChannel.TELEGRAM,
            createdAt: new Date(pastRemindAt.getTime() - 1000),
          },
        ],
      };
      mockPrisma.appointment.findUnique.mockResolvedValue(existing);

      const dto: UpdateAppointmentDto = {
        startTime: futureStart.toISOString(),
      };

      await service.update('user-1', 'USER', 'app-1', dto);

      expect(mockPrisma.reminder.create).toHaveBeenCalledWith({
        data: {
          appointmentId: 'app-1',
          remindAt: expectedRemindAt,
          channel: NotificationChannel.TELEGRAM,
          status: ReminderStatus.PENDING,
        },
      });
    });

    it('update com reminderEnabled: true e remindAt já no passado não deve chamar reminder.create', async () => {
      const pastStart = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const pastEnd = new Date(pastStart.getTime() + 60 * 60 * 1000);
      const pastRemindAt = new Date(pastStart.getTime() - 30 * 60 * 1000);

      const existing = {
        ...baseAppointment,
        startTime: pastStart,
        endTime: pastEnd,
        reminderMinutesBefore: 30,
        reminders: [
          {
            id: 'rem-sent',
            status: ReminderStatus.SENT,
            remindAt: pastRemindAt,
            channel: NotificationChannel.TELEGRAM,
            createdAt: new Date(pastRemindAt.getTime() - 1000),
          },
        ],
      };
      mockPrisma.appointment.findUnique.mockResolvedValue(existing);

      const dto: UpdateAppointmentDto = {
        reminderEnabled: true,
      };

      await service.update('user-1', 'USER', 'app-1', dto);

      expect(mockPrisma.reminder.create).not.toHaveBeenCalled();
    });

    it('update com lembrete PENDING mudando startTime deve atualizar lembrete com updateMany', async () => {
      const existing = {
        ...baseAppointment,
        startTime: new Date('2026-11-20T10:00:00.000Z'),
        endTime: new Date('2026-11-20T11:00:00.000Z'),
        reminderMinutesBefore: 30,
        reminders: [
          {
            id: 'rem-1',
            status: ReminderStatus.PENDING,
            channel: NotificationChannel.TELEGRAM,
            createdAt: new Date('2026-11-20T09:00:00.000Z'),
          },
        ],
      };
      mockPrisma.appointment.findUnique.mockResolvedValue(existing);

      const dto: UpdateAppointmentDto = {
        startTime: '2026-11-21T10:00:00.000Z',
        reminderChannel: NotificationChannel.TELEGRAM,
      };

      await service.update('user-1', 'USER', 'app-1', dto);

      expect(mockPrisma.reminder.updateMany).toHaveBeenCalledWith({
        where: { appointmentId: 'app-1', status: ReminderStatus.PENDING },
        data: {
          remindAt: new Date('2026-11-21T09:30:00.000Z'),
          channel: NotificationChannel.TELEGRAM,
        },
      });
    });

    it('update registra log de auditoria com endTime em metadata.before e metadata.after', async () => {
      const existing = {
        ...baseAppointment,
        startTime: new Date('2026-11-20T10:00:00.000Z'),
        endTime: new Date('2026-11-20T11:00:00.000Z'),
        reminders: [],
      };
      mockPrisma.appointment.findUnique.mockResolvedValue(existing);

      const dto: UpdateAppointmentDto = {
        title: 'Novo Titulo',
      };

      await service.update('user-1', 'USER', 'app-1', dto);

      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            before: expect.objectContaining({
              endTime: existing.endTime,
            }),
            after: expect.objectContaining({
              endTime: existing.endTime,
            }),
          }),
        }),
      );
    });
  });

  describe('cancel', () => {
    it('cancel não mexe em lembretes e não checa conflito', async () => {
      mockCalendarAccess.verifyAccessOrThrow.mockResolvedValue({
        calendar: { ...baseCalendar, type: CalendarType.PROFESSIONAL },
        isDelegated: false,
      });

      const existing = {
        ...baseAppointment,
        status: AppointmentStatus.SCHEDULED,
        reminders: [
          { id: 'rem-1', status: ReminderStatus.PENDING, channel: NotificationChannel.TELEGRAM },
        ],
      };
      mockPrisma.appointment.findUnique.mockResolvedValue(existing);

      await service.cancel('user-1', 'USER', 'app-1');

      expect(mockPrisma.appointment.findFirst).not.toHaveBeenCalled();
      expect(mockPrisma.reminder.updateMany).not.toHaveBeenCalled();
      expect(mockPrisma.reminder.deleteMany).not.toHaveBeenCalled();
      expect(mockPrisma.reminder.create).not.toHaveBeenCalled();
      expect(mockPrisma.appointment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'app-1' },
          data: expect.objectContaining({
            status: AppointmentStatus.CANCELLED,
          }),
        }),
      );
    });
  });
});
