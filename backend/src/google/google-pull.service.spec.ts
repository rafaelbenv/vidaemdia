import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  AppointmentStatus,
  NotificationChannel,
  ReminderStatus,
} from '@prisma/client';
import { GooglePullService } from './google-pull.service';
import { PrismaService } from '../prisma/prisma.service';
import { MetricsService } from '../monitoring/metrics.service';
import { GoogleAccountService } from './google-account.service';
import {
  GoogleCalendarClient,
  GoogleApiError,
} from './google-calendar.client';
import { GoogleInvalidGrantError } from './google-oauth.client';
import { AuditService } from '../audit/audit.service';

describe('GooglePullService', () => {
  let service: GooglePullService;
  let mockPrisma: any;
  let mockGoogleAccountService: any;
  let mockCalendarClient: any;
  let mockAuditService: any;
  let mockMetricsService: any;

  const originalEnv = { ...process.env };
  const validHexKey =
    '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

  const baseCalendar = {
    id: 'cal-1',
    ownerId: 'owner-1',
    name: 'Agenda Consultório',
    googleCalendarId: 'primary@gmail.com',
    googleSyncToken: null,
    googleLastSyncAt: null,
    googleSyncError: null,
  };

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      GOOGLE_CLIENT_ID: 'google-client-id-test',
      GOOGLE_CLIENT_SECRET: 'google-client-secret-test',
      GOOGLE_TOKEN_ENC_KEY: validHexKey,
      GOOGLE_REDIRECT_URI: 'http://localhost:8080/api/google/callback',
      FRONTEND_URL: 'http://localhost:8080',
    };

    mockPrisma = {
      calendar: {
        findMany: jest.fn().mockResolvedValue([baseCalendar]),
        findUnique: jest.fn().mockResolvedValue(baseCalendar),
        update: jest.fn().mockResolvedValue(baseCalendar),
      },
      appointment: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'appt-created-1' }),
        update: jest.fn().mockResolvedValue({ id: 'appt-updated-1' }),
      },
      reminder: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'rem-1' }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      googleSyncJob: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };

    mockGoogleAccountService = {
      getAccessToken: jest.fn().mockResolvedValue('token-abc'),
    };

    mockCalendarClient = {
      listEvents: jest.fn().mockResolvedValue({
        items: [],
        nextPageToken: undefined,
        nextSyncToken: 'next-sync-123',
      }),
    };

    mockAuditService = {
      log: jest.fn().mockResolvedValue({ id: 'audit-1' }),
    };

    mockMetricsService = {
      incrementGoogleSync: jest.fn(),
    };

    service = new GooglePullService(
      mockPrisma as unknown as PrismaService,
      mockGoogleAccountService as unknown as GoogleAccountService,
      mockCalendarClient as unknown as GoogleCalendarClient,
      mockAuditService as unknown as AuditService,
      mockMetricsService as unknown as MetricsService,
    );
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('carga completa sem token manda timeMin/timeMax e grava nextSyncToken', async () => {
    mockPrisma.calendar.findUnique.mockResolvedValue({
      ...baseCalendar,
      googleSyncToken: null,
    });
    mockCalendarClient.listEvents.mockResolvedValue({
      items: [],
      nextPageToken: undefined,
      nextSyncToken: 'sync-token-999',
    });

    const result = await service.pullCalendar('cal-1');

    expect(result).toEqual({ created: 0, updated: 0, cancelled: 0, ignored: 0 });
    expect(mockCalendarClient.listEvents).toHaveBeenCalledWith(
      'token-abc',
      'primary@gmail.com',
      expect.objectContaining({
        timeMin: expect.any(String),
        timeMax: expect.any(String),
      }),
    );
    expect(
      mockCalendarClient.listEvents.mock.calls[0][2].syncToken,
    ).toBeUndefined();

    expect(mockPrisma.calendar.update).toHaveBeenCalledWith({
      where: { id: 'cal-1' },
      data: {
        googleSyncToken: 'sync-token-999',
        googleLastSyncAt: expect.any(Date),
        googleSyncError: null,
      },
    });
    expect(mockMetricsService.incrementGoogleSync).toHaveBeenCalledWith('ok');
  });

  it('incremental manda só syncToken e não manda timeMin/timeMax', async () => {
    mockPrisma.calendar.findUnique.mockResolvedValue({
      ...baseCalendar,
      googleSyncToken: 'existing-sync-token',
    });
    mockCalendarClient.listEvents.mockResolvedValue({
      items: [],
      nextPageToken: undefined,
      nextSyncToken: 'new-sync-token',
    });

    await service.pullCalendar('cal-1');

    expect(mockCalendarClient.listEvents).toHaveBeenCalledWith(
      'token-abc',
      'primary@gmail.com',
      expect.objectContaining({
        syncToken: 'existing-sync-token',
      }),
    );
    expect(
      mockCalendarClient.listEvents.mock.calls[0][2].timeMin,
    ).toBeUndefined();
    expect(
      mockCalendarClient.listEvents.mock.calls[0][2].timeMax,
    ).toBeUndefined();

    expect(mockPrisma.calendar.update).toHaveBeenCalledWith({
      where: { id: 'cal-1' },
      data: {
        googleSyncToken: 'new-sync-token',
        googleLastSyncAt: expect.any(Date),
        googleSyncError: null,
      },
    });
  });

  it('410 zera o token e refaz como carga completa', async () => {
    mockPrisma.calendar.findUnique.mockResolvedValue({
      ...baseCalendar,
      googleSyncToken: 'expired-token',
    });

    mockCalendarClient.listEvents
      .mockRejectedValueOnce(new GoogleApiError(410, 'Sync token expired'))
      .mockResolvedValueOnce({
        items: [],
        nextPageToken: undefined,
        nextSyncToken: 'recovered-sync-token',
      });

    await service.pullCalendar('cal-1');

    expect(mockPrisma.calendar.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'cal-1' },
      data: { googleSyncToken: null },
    });

    expect(mockCalendarClient.listEvents).toHaveBeenNthCalledWith(
      1,
      'token-abc',
      'primary@gmail.com',
      expect.objectContaining({ syncToken: 'expired-token' }),
    );

    expect(mockCalendarClient.listEvents).toHaveBeenNthCalledWith(
      2,
      'token-abc',
      'primary@gmail.com',
      expect.objectContaining({
        timeMin: expect.any(String),
        timeMax: expect.any(String),
      }),
    );
    expect(
      mockCalendarClient.listEvents.mock.calls[1][2].syncToken,
    ).toBeUndefined();

    expect(mockPrisma.calendar.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'cal-1' },
      data: {
        googleSyncToken: 'recovered-sync-token',
        googleLastSyncAt: expect.any(Date),
        googleSyncError: null,
      },
    });
    expect(mockMetricsService.incrementGoogleSync).toHaveBeenCalledWith('ok');
  });

  it('evento novo cria com createdVia GOOGLE, lembrete e auditoria com actorUserId vazio, sem chamar a fila', async () => {
    const futureStart = new Date(Date.now() + 2 * 3600 * 1000);
    const futureEnd = new Date(Date.now() + 3 * 3600 * 1000);

    const ev = {
      id: 'g-event-new-1',
      etag: '"etag-111"',
      summary: 'Novo Evento Google',
      description: 'Detalhes do evento',
      start: { dateTime: futureStart.toISOString() },
      end: { dateTime: futureEnd.toISOString() },
      reminders: {
        useDefault: false,
        overrides: [{ method: 'popup', minutes: 15 }],
      },
    };

    mockCalendarClient.listEvents.mockResolvedValue({
      items: [ev],
      nextPageToken: undefined,
      nextSyncToken: 'sync-token-new',
    });
    mockPrisma.appointment.create.mockResolvedValue({
      id: 'appt-created-1',
      title: 'Novo Evento Google',
    });

    const result = await service.pullCalendar('cal-1');

    expect(result.created).toBe(1);
    expect(mockPrisma.appointment.create).toHaveBeenCalledWith({
      data: {
        calendarId: 'cal-1',
        createdById: 'owner-1',
        title: 'Novo Evento Google',
        description: 'Detalhes do evento',
        startTime: futureStart,
        endTime: futureEnd,
        reminderMinutesBefore: 15,
        status: AppointmentStatus.SCHEDULED,
        createdVia: 'GOOGLE',
        googleEventId: 'g-event-new-1',
        googleEtag: '"etag-111"',
        googleSyncedAt: expect.any(Date),
      },
    });

    expect(mockPrisma.reminder.create).toHaveBeenCalledWith({
      data: {
        appointmentId: 'appt-created-1',
        remindAt: new Date(futureStart.getTime() - 15 * 60 * 1000),
        channel: NotificationChannel.TELEGRAM,
        status: ReminderStatus.PENDING,
      },
    });

    expect(mockAuditService.log).toHaveBeenCalledWith({
      actorUserId: undefined,
      targetCalendarId: 'cal-1',
      entityType: 'APPOINTMENT',
      entityId: 'appt-created-1',
      action: 'CREATE',
      details: 'Compromisso "Novo Evento Google" importado do Google Agenda',
      metadata: { source: 'GOOGLE', googleEventId: 'g-event-new-1' },
    });
  });

  it('mesmo etag → ignorado; etag diferente → atualiza', async () => {
    const start = new Date(Date.now() + 2 * 3600 * 1000);
    const end = new Date(Date.now() + 3 * 3600 * 1000);

    const localAppt = {
      id: 'appt-existing-1',
      calendarId: 'cal-1',
      title: 'Reunião Semanal',
      googleEventId: 'g-event-existing',
      googleEtag: '"etag-same"',
      status: AppointmentStatus.SCHEDULED,
      reminderMinutesBefore: 30,
    };

    // Caso 1: mesmo etag
    mockPrisma.appointment.findFirst.mockResolvedValue(localAppt);
    mockPrisma.googleSyncJob.findFirst.mockResolvedValue(null);
    mockCalendarClient.listEvents.mockResolvedValue({
      items: [
        {
          id: 'g-event-existing',
          etag: '"etag-same"',
          summary: 'Reunião Semanal',
          start: { dateTime: start.toISOString() },
          end: { dateTime: end.toISOString() },
        },
      ],
      nextSyncToken: 'sync-1',
    });

    const res1 = await service.pullCalendar('cal-1');
    expect(res1.ignored).toBe(1);
    expect(res1.updated).toBe(0);
    expect(mockPrisma.appointment.update).not.toHaveBeenCalled();

    // Caso 2: etag diferente
    mockCalendarClient.listEvents.mockResolvedValue({
      items: [
        {
          id: 'g-event-existing',
          etag: '"etag-different"',
          summary: 'Reunião Alterada',
          description: 'Nova pauta',
          start: { dateTime: start.toISOString() },
          end: { dateTime: end.toISOString() },
        },
      ],
      nextSyncToken: 'sync-2',
    });

    const res2 = await service.pullCalendar('cal-1');
    expect(res2.updated).toBe(1);
    expect(mockPrisma.appointment.update).toHaveBeenCalledWith({
      where: { id: 'appt-existing-1' },
      data: {
        title: 'Reunião Alterada',
        description: 'Nova pauta',
        startTime: start,
        endTime: end,
        googleEventId: 'g-event-existing',
        googleEtag: '"etag-different"',
        googleSyncedAt: expect.any(Date),
        googleSyncError: null,
        status: AppointmentStatus.SCHEDULED,
      },
    });

    expect(mockAuditService.log).toHaveBeenCalledWith({
      actorUserId: undefined,
      targetCalendarId: 'cal-1',
      entityType: 'APPOINTMENT',
      entityId: 'appt-existing-1',
      action: 'UPDATE',
      details: 'Compromisso "Reunião Alterada" alterado via Google Agenda',
      metadata: { source: 'GOOGLE', googleEventId: 'g-event-existing' },
    });
  });

  it('cancelled cancela e apaga lembretes pendentes; cancelled desconhecido → ignorado', async () => {
    // 1. Cancelled conhecido
    const localAppt = {
      id: 'appt-to-cancel',
      title: 'Consulta Cancelada',
      status: AppointmentStatus.SCHEDULED,
      googleEventId: 'g-ev-cancel',
      googleEtag: '"old-etag"',
    };
    mockPrisma.appointment.findFirst.mockResolvedValue(localAppt);
    mockCalendarClient.listEvents.mockResolvedValue({
      items: [
        {
          id: 'g-ev-cancel',
          status: 'cancelled',
          etag: '"new-cancelled-etag"',
        },
      ],
      nextSyncToken: 'sync-cancel',
    });

    const res1 = await service.pullCalendar('cal-1');
    expect(res1.cancelled).toBe(1);
    expect(mockPrisma.appointment.update).toHaveBeenCalledWith({
      where: { id: 'appt-to-cancel' },
      data: {
        status: AppointmentStatus.CANCELLED,
        googleEventId: 'g-ev-cancel',
        googleEtag: '"new-cancelled-etag"',
        googleSyncedAt: expect.any(Date),
      },
    });
    expect(mockPrisma.reminder.deleteMany).toHaveBeenCalledWith({
      where: {
        appointmentId: 'appt-to-cancel',
        status: ReminderStatus.PENDING,
      },
    });
    expect(mockAuditService.log).toHaveBeenCalledWith({
      actorUserId: undefined,
      targetCalendarId: 'cal-1',
      entityType: 'APPOINTMENT',
      entityId: 'appt-to-cancel',
      action: 'CANCEL',
      details: 'Compromisso "Consulta Cancelada" cancelado via Google Agenda',
      metadata: { source: 'GOOGLE', googleEventId: 'g-ev-cancel' },
    });

    // 2. Cancelled desconhecido
    mockPrisma.appointment.findFirst.mockResolvedValue(null);
    mockCalendarClient.listEvents.mockResolvedValue({
      items: [
        {
          id: 'g-ev-unknown',
          status: 'cancelled',
        },
      ],
      nextSyncToken: 'sync-unknown',
    });

    const res2 = await service.pullCalendar('cal-1');
    expect(res2.ignored).toBe(1);
    expect(res2.cancelled).toBe(0);
  });

  it('job PENDING do compromisso → ignorado', async () => {
    const start = new Date(Date.now() + 2 * 3600 * 1000);
    const end = new Date(Date.now() + 3 * 3600 * 1000);

    const localAppt = {
      id: 'appt-with-job',
      title: 'Em Envio',
      googleEventId: 'g-ev-job',
      googleEtag: '"etag-1"',
      status: AppointmentStatus.SCHEDULED,
    };
    mockPrisma.appointment.findFirst.mockResolvedValue(localAppt);
    mockPrisma.googleSyncJob.findFirst.mockResolvedValue({
      id: 'job-1',
      status: 'PENDING',
    });

    mockCalendarClient.listEvents.mockResolvedValue({
      items: [
        {
          id: 'g-ev-job',
          etag: '"etag-2"',
          summary: 'Modificação no Google',
          start: { dateTime: start.toISOString() },
          end: { dateTime: end.toISOString() },
        },
      ],
      nextSyncToken: 'sync-job',
    });

    const res = await service.pullCalendar('cal-1');

    expect(res.ignored).toBe(1);
    expect(res.updated).toBe(0);
    expect(mockPrisma.appointment.update).not.toHaveBeenCalled();
  });

  it('achado pelo vidaemdiaId sem googleEventId → grava o googleEventId', async () => {
    const start = new Date(Date.now() + 2 * 3600 * 1000);
    const end = new Date(Date.now() + 3 * 3600 * 1000);

    const localAppt = {
      id: 'vidaemdia-id-456',
      title: 'Compromisso Local',
      googleEventId: null,
      googleEtag: null,
      status: AppointmentStatus.SCHEDULED,
    };

    // Primeiro findFirst (por googleEventId) não acha nada, segundo (por vidaemdiaId) acha
    mockPrisma.appointment.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(localAppt);

    mockCalendarClient.listEvents.mockResolvedValue({
      items: [
        {
          id: 'g-ev-matched',
          etag: '"etag-matched"',
          summary: 'Compromisso Local',
          extendedProperties: {
            private: {
              vidaemdiaId: 'vidaemdia-id-456',
            },
          },
          start: { dateTime: start.toISOString() },
          end: { dateTime: end.toISOString() },
        },
      ],
      nextSyncToken: 'sync-matched',
    });

    const res = await service.pullCalendar('cal-1');

    expect(res.updated).toBe(1);
    expect(mockPrisma.appointment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'vidaemdia-id-456' },
        data: expect.objectContaining({
          googleEventId: 'g-ev-matched',
          googleEtag: '"etag-matched"',
        }),
      }),
    );
  });

  it('achado pelo vidaemdiaId sem googleEventId com job PENDING grava googleEventId e ignora', async () => {
    const start = new Date(Date.now() + 2 * 3600 * 1000);
    const end = new Date(Date.now() + 3 * 3600 * 1000);

    const localAppt = {
      id: 'vidaemdia-pending-789',
      title: 'Compromisso Local Pendente',
      googleEventId: null,
      googleEtag: null,
      status: AppointmentStatus.SCHEDULED,
    };

    mockPrisma.appointment.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(localAppt);

    mockPrisma.googleSyncJob.findFirst.mockResolvedValue({
      id: 'job-pending',
      status: 'PENDING',
    });

    mockCalendarClient.listEvents.mockResolvedValue({
      items: [
        {
          id: 'g-ev-pending',
          etag: '"etag-pend"',
          summary: 'Compromisso Local Pendente',
          extendedProperties: {
            private: {
              vidaemdiaId: 'vidaemdia-pending-789',
            },
          },
          start: { dateTime: start.toISOString() },
          end: { dateTime: end.toISOString() },
        },
      ],
      nextSyncToken: 'sync-pend',
    });

    const res = await service.pullCalendar('cal-1');

    expect(res.ignored).toBe(1);
    expect(mockPrisma.appointment.update).toHaveBeenCalledWith({
      where: { id: 'vidaemdia-pending-789' },
      data: {
        googleEventId: 'g-ev-pending',
        googleEtag: '"etag-pend"',
      },
    });
  });

  it('dia inteiro → ignorado', async () => {
    mockCalendarClient.listEvents.mockResolvedValue({
      items: [
        {
          id: 'g-allday',
          summary: 'Feriado',
          start: { date: '2026-11-20' },
          end: { date: '2026-11-21' },
        },
      ],
      nextSyncToken: 'sync-allday',
    });

    const res = await service.pullCalendar('cal-1');

    expect(res.ignored).toBe(1);
    expect(res.created).toBe(0);
    expect(mockPrisma.appointment.create).not.toHaveBeenCalled();
  });

  it('token expirado grava googleSyncError', async () => {
    mockGoogleAccountService.getAccessToken.mockRejectedValue(
      new GoogleInvalidGrantError('invalid_grant'),
    );

    await expect(service.pullCalendar('cal-1')).rejects.toThrow(
      GoogleInvalidGrantError,
    );

    expect(mockPrisma.calendar.update).toHaveBeenCalledWith({
      where: { id: 'cal-1' },
      data: {
        googleSyncError: 'Conexão com o Google expirou; conecte de novo.',
      },
    });
    expect(mockMetricsService.incrementGoogleSync).toHaveBeenCalledWith('erro');
  });

  it('dono sem conta conectada grava erro específico', async () => {
    mockGoogleAccountService.getAccessToken.mockRejectedValue(
      new NotFoundException('Conta do Google não vinculada'),
    );

    await expect(service.pullCalendar('cal-1')).rejects.toThrow(
      NotFoundException,
    );

    expect(mockPrisma.calendar.update).toHaveBeenCalledWith({
      where: { id: 'cal-1' },
      data: {
        googleSyncError: 'O dono da agenda não tem o Google conectado.',
      },
    });
    expect(mockMetricsService.incrementGoogleSync).toHaveBeenCalledWith('erro');
  });

  it('pullCalendarForOwner com quem não é dono → ForbiddenException', async () => {
    mockPrisma.calendar.findUnique.mockResolvedValue({
      ...baseCalendar,
      ownerId: 'dono-original',
    });

    await expect(
      service.pullCalendarForOwner('outro-usuario', 'cal-1'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('pullCalendarForOwner com agenda inexistente → NotFoundException', async () => {
    mockPrisma.calendar.findUnique.mockResolvedValue(null);

    await expect(
      service.pullCalendarForOwner('owner-1', 'cal-inexistente'),
    ).rejects.toThrow(NotFoundException);
  });

  it('pullCalendarForOwner com agenda não ligada → BadRequestException', async () => {
    mockPrisma.calendar.findUnique.mockResolvedValue({
      ...baseCalendar,
      googleCalendarId: null,
    });

    await expect(
      service.pullCalendarForOwner('owner-1', 'cal-1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('pullAll percorre agendas ligadas e acumula contadores', async () => {
    mockPrisma.calendar.findMany.mockResolvedValue([
      { ...baseCalendar, id: 'cal-1' },
      { ...baseCalendar, id: 'cal-2' },
    ]);

    const result = await service.pullAll();

    expect(result.calendars).toBe(2);
    expect(mockCalendarClient.listEvents).toHaveBeenCalledTimes(2);
  });

  it('pullAll não executa se integração Google não estiver configurada', async () => {
    delete process.env.GOOGLE_CLIENT_ID;

    const result = await service.pullAll();

    expect(result.calendars).toBe(0);
    expect(mockPrisma.calendar.findMany).not.toHaveBeenCalled();
  });
});
