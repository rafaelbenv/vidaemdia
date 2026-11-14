import { NotFoundException } from '@nestjs/common';
import { AppointmentStatus } from '@prisma/client';
import { GoogleSyncWorker } from './google-sync.worker';
import { PrismaService } from '../prisma/prisma.service';
import { MetricsService } from '../monitoring/metrics.service';
import { GoogleAccountService } from './google-account.service';
import {
  GoogleCalendarClient,
  GoogleApiError,
} from './google-calendar.client';
import { GoogleInvalidGrantError } from './google-oauth.client';

describe('GoogleSyncWorker', () => {
  let worker: GoogleSyncWorker;
  let mockPrisma: any;
  let mockGoogleAccountService: any;
  let mockCalendarClient: any;
  let mockMetricsService: any;

  const originalEnv = { ...process.env };
  const validHexKey =
    '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

  const baseCalendar = {
    id: 'cal-1',
    ownerId: 'owner-1',
    name: 'Agenda Consultório',
    googleCalendarId: 'primary@gmail.com',
  };

  const baseAppointment = {
    id: 'appt-1',
    calendarId: 'cal-1',
    title: 'Consulta Geral',
    description: 'Checkup',
    startTime: new Date('2026-11-20T10:00:00.000Z'),
    endTime: new Date('2026-11-20T11:00:00.000Z'),
    status: AppointmentStatus.SCHEDULED,
    googleEventId: null,
    calendar: baseCalendar,
  };

  const baseJob = {
    id: 'job-1',
    appointmentId: 'appt-1',
    operation: 'UPSERT',
    status: 'PENDING',
    retryCount: 0,
    nextRetryAt: null,
    lastError: null,
    claimedAt: null,
    claimedBy: null,
    createdAt: new Date(),
  };

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      GOOGLE_CLIENT_ID: 'client-id-test',
      GOOGLE_CLIENT_SECRET: 'client-secret-test',
      GOOGLE_TOKEN_ENC_KEY: validHexKey,
      GOOGLE_REDIRECT_URI: 'http://localhost:8080/api/google/callback',
      FRONTEND_URL: 'http://localhost:8080',
    };

    mockPrisma = {
      googleSyncJob: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findMany: jest.fn().mockResolvedValue([baseJob]),
        update: jest.fn().mockResolvedValue(baseJob),
      },
      appointment: {
        findUnique: jest.fn().mockResolvedValue(baseAppointment),
        update: jest.fn().mockResolvedValue(baseAppointment),
      },
    };

    mockGoogleAccountService = {
      getAccessToken: jest.fn().mockResolvedValue('token-abc'),
    };

    mockCalendarClient = {
      insertEvent: jest
        .fn()
        .mockResolvedValue({ id: 'g-event-new', etag: '"etag-new"' }),
      patchEvent: jest
        .fn()
        .mockResolvedValue({ id: 'g-event-patched', etag: '"etag-patched"' }),
      deleteEvent: jest.fn().mockResolvedValue(undefined),
    };

    mockMetricsService = {
      incrementGoogleSync: jest.fn(),
    };

    worker = new GoogleSyncWorker(
      mockPrisma as unknown as PrismaService,
      mockGoogleAccountService as unknown as GoogleAccountService,
      mockCalendarClient as unknown as GoogleCalendarClient,
      mockMetricsService as unknown as MetricsService,
    );
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('integração não configurada não executa o ciclo', async () => {
    delete process.env.GOOGLE_CLIENT_ID;

    const result = await worker.processQueue();

    expect(result.processed).toBe(0);
    expect(mockPrisma.googleSyncJob.findMany).not.toHaveBeenCalled();
  });

  it('recupera reservas esquecidas no início do ciclo', async () => {
    mockPrisma.googleSyncJob.updateMany
      .mockResolvedValueOnce({ count: 2 }) // recuperados
      .mockResolvedValueOnce({ count: 1 }); // reserva do job atual

    await worker.processQueue();

    expect(mockPrisma.googleSyncJob.updateMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'PROCESSING',
          claimedAt: { lt: expect.any(Date) },
        }),
        data: expect.objectContaining({
          status: 'PENDING',
          claimedAt: null,
          claimedBy: null,
        }),
      }),
    );
  });

  it('insert sem googleEventId grava o id devolvido e marca DONE', async () => {
    const result = await worker.processQueue();

    expect(mockCalendarClient.insertEvent).toHaveBeenCalledWith(
      'token-abc',
      'primary@gmail.com',
      expect.objectContaining({
        summary: 'Consulta Geral',
        reminders: { useDefault: true },
        extendedProperties: { private: { vidaemdiaId: 'appt-1' } },
      }),
    );

    expect(mockPrisma.appointment.update).toHaveBeenCalledWith({
      where: { id: 'appt-1' },
      data: {
        googleEventId: 'g-event-new',
        googleEtag: '"etag-new"',
        googleSyncedAt: expect.any(Date),
        googleSyncError: null,
      },
    });

    expect(mockPrisma.googleSyncJob.update).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: {
        status: 'DONE',
        claimedAt: null,
        claimedBy: null,
        lastError: null,
      },
    });

    expect(mockMetricsService.incrementGoogleSync).toHaveBeenCalledWith('ok');
    expect(result.success).toBe(1);
  });

  it('patch com googleEventId existente grava googleSyncedAt e marca DONE', async () => {
    mockPrisma.appointment.findUnique.mockResolvedValue({
      ...baseAppointment,
      googleEventId: 'g-event-existing',
    });

    await worker.processQueue();

    expect(mockCalendarClient.patchEvent).toHaveBeenCalledWith(
      'token-abc',
      'primary@gmail.com',
      'g-event-existing',
      expect.any(Object),
    );

    expect(mockPrisma.appointment.update).toHaveBeenCalledWith({
      where: { id: 'appt-1' },
      data: {
        googleEventId: 'g-event-patched',
        googleEtag: '"etag-patched"',
        googleSyncedAt: expect.any(Date),
        googleSyncError: null,
      },
    });

    expect(mockMetricsService.incrementGoogleSync).toHaveBeenCalledWith('ok');
  });

  it('patch com erro 404 cai para insertEvent', async () => {
    mockPrisma.appointment.findUnique.mockResolvedValue({
      ...baseAppointment,
      googleEventId: 'g-event-deleted-on-google',
    });

    mockCalendarClient.patchEvent.mockRejectedValue(
      new GoogleApiError(404, 'Not Found'),
    );
    mockCalendarClient.insertEvent.mockResolvedValue({
      id: 'g-event-recreated',
      etag: '"etag-recreated"',
    });

    await worker.processQueue();

    expect(mockCalendarClient.patchEvent).toHaveBeenCalled();
    expect(mockCalendarClient.insertEvent).toHaveBeenCalled();
    expect(mockPrisma.appointment.update).toHaveBeenCalledWith({
      where: { id: 'appt-1' },
      data: {
        googleEventId: 'g-event-recreated',
        googleEtag: '"etag-recreated"',
        googleSyncedAt: expect.any(Date),
        googleSyncError: null,
      },
    });
    expect(mockMetricsService.incrementGoogleSync).toHaveBeenCalledWith('ok');
  });

  it('patch com erro 410 cai para insertEvent', async () => {
    mockPrisma.appointment.findUnique.mockResolvedValue({
      ...baseAppointment,
      googleEventId: 'g-event-gone',
    });

    mockCalendarClient.patchEvent.mockRejectedValue(
      new GoogleApiError(410, 'Gone'),
    );
    mockCalendarClient.insertEvent.mockResolvedValue({
      id: 'g-event-new-410',
      etag: '"etag-410"',
    });

    await worker.processQueue();

    expect(mockCalendarClient.patchEvent).toHaveBeenCalled();
    expect(mockCalendarClient.insertEvent).toHaveBeenCalled();
    expect(mockPrisma.appointment.update).toHaveBeenCalledWith({
      where: { id: 'appt-1' },
      data: {
        googleEventId: 'g-event-new-410',
        googleEtag: '"etag-410"',
        googleSyncedAt: expect.any(Date),
        googleSyncError: null,
      },
    });
  });

  it('delete com googleEventId existente chama deleteEvent e grava googleSyncedAt', async () => {
    mockPrisma.googleSyncJob.findMany.mockResolvedValue([
      { ...baseJob, operation: 'DELETE' },
    ]);
    mockPrisma.appointment.findUnique.mockResolvedValue({
      ...baseAppointment,
      googleEventId: 'g-event-to-del',
    });

    await worker.processQueue();

    expect(mockCalendarClient.deleteEvent).toHaveBeenCalledWith(
      'token-abc',
      'primary@gmail.com',
      'g-event-to-del',
    );
    expect(mockPrisma.appointment.update).toHaveBeenCalledWith({
      where: { id: 'appt-1' },
      data: {
        googleSyncedAt: expect.any(Date),
        googleSyncError: null,
      },
    });
    expect(mockMetricsService.incrementGoogleSync).toHaveBeenCalledWith('ok');
  });

  it('delete com erro 404 conta como sucesso', async () => {
    mockPrisma.googleSyncJob.findMany.mockResolvedValue([
      { ...baseJob, operation: 'DELETE' },
    ]);
    mockPrisma.appointment.findUnique.mockResolvedValue({
      ...baseAppointment,
      googleEventId: 'g-event-already-gone',
    });

    mockCalendarClient.deleteEvent.mockRejectedValue(
      new GoogleApiError(404, 'Not Found'),
    );

    await worker.processQueue();

    expect(mockPrisma.googleSyncJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'DONE' }),
      }),
    );
    expect(mockMetricsService.incrementGoogleSync).toHaveBeenCalledWith('ok');
  });

  it('delete sem googleEventId não chama deleteEvent e conta como sucesso', async () => {
    mockPrisma.googleSyncJob.findMany.mockResolvedValue([
      { ...baseJob, operation: 'DELETE' },
    ]);
    mockPrisma.appointment.findUnique.mockResolvedValue({
      ...baseAppointment,
      googleEventId: null,
    });

    await worker.processQueue();

    expect(mockCalendarClient.deleteEvent).not.toHaveBeenCalled();
    expect(mockPrisma.appointment.update).toHaveBeenCalledWith({
      where: { id: 'appt-1' },
      data: {
        googleSyncedAt: expect.any(Date),
        googleSyncError: null,
      },
    });
    expect(mockMetricsService.incrementGoogleSync).toHaveBeenCalledWith('ok');
  });

  it('UPSERT de compromisso CANCELLED executa lógica de DELETE', async () => {
    mockPrisma.googleSyncJob.findMany.mockResolvedValue([
      { ...baseJob, operation: 'UPSERT' },
    ]);
    mockPrisma.appointment.findUnique.mockResolvedValue({
      ...baseAppointment,
      status: AppointmentStatus.CANCELLED,
      googleEventId: 'g-event-cancelled',
    });

    await worker.processQueue();

    expect(mockCalendarClient.deleteEvent).toHaveBeenCalledWith(
      'token-abc',
      'primary@gmail.com',
      'g-event-cancelled',
    );
    expect(mockCalendarClient.insertEvent).not.toHaveBeenCalled();
    expect(mockCalendarClient.patchEvent).not.toHaveBeenCalled();
  });

  it('reserva perdida (count === 0) pula o job', async () => {
    mockPrisma.googleSyncJob.updateMany
      .mockResolvedValueOnce({ count: 0 }) // recuperação de esquecidos
      .mockResolvedValueOnce({ count: 0 }); // claim do job falhou

    const result = await worker.processQueue();

    expect(result.skipped).toBe(1);
    expect(mockCalendarClient.insertEvent).not.toHaveBeenCalled();
  });

  it('agenda desligada (sem googleCalendarId) marca job como DONE', async () => {
    mockPrisma.appointment.findUnique.mockResolvedValue({
      ...baseAppointment,
      calendar: { ...baseCalendar, googleCalendarId: null },
    });

    await worker.processQueue();

    expect(mockPrisma.googleSyncJob.update).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: {
        status: 'DONE',
        claimedAt: null,
        claimedBy: null,
      },
    });
    expect(mockCalendarClient.insertEvent).not.toHaveBeenCalled();
  });

  it('dono da agenda sem conta conectada marca FAILED e grava erro', async () => {
    mockGoogleAccountService.getAccessToken.mockRejectedValue(
      new NotFoundException('Conta do Google não vinculada'),
    );

    await worker.processQueue();

    expect(mockPrisma.googleSyncJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'job-1' },
        data: expect.objectContaining({
          status: 'FAILED',
          lastError: 'O dono da agenda não tem o Google conectado.',
        }),
      }),
    );

    expect(mockPrisma.appointment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'appt-1' },
        data: expect.objectContaining({
          googleSyncError:
            'Não foi possível enviar ao Google: O dono da agenda não tem o Google conectado.',
        }),
      }),
    );
    expect(mockMetricsService.incrementGoogleSync).toHaveBeenCalledWith('erro');
  });

  it('falha com tentativas sobrando volta para PENDING com nextRetryAt', async () => {
    mockCalendarClient.insertEvent.mockRejectedValue(
      new Error('Timeout de rede'),
    );

    await worker.processQueue();

    expect(mockPrisma.googleSyncJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'job-1' },
        data: expect.objectContaining({
          status: 'PENDING',
          retryCount: 1,
          nextRetryAt: expect.any(Date),
          lastError: 'Timeout de rede',
          claimedAt: null,
          claimedBy: null,
        }),
      }),
    );

    expect(mockPrisma.appointment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'appt-1' },
        data: expect.objectContaining({
          googleSyncError: 'Não foi possível enviar ao Google: Timeout de rede',
        }),
      }),
    );
    expect(mockMetricsService.incrementGoogleSync).toHaveBeenCalledWith('erro');
  });

  it('5ª falha marca job como FAILED e grava erro no appointment', async () => {
    mockPrisma.googleSyncJob.findMany.mockResolvedValue([
      { ...baseJob, retryCount: 4 },
    ]);
    mockCalendarClient.insertEvent.mockRejectedValue(
      new Error('Erro persistente'),
    );

    await worker.processQueue();

    expect(mockPrisma.googleSyncJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'job-1' },
        data: expect.objectContaining({
          status: 'FAILED',
          retryCount: 5,
          nextRetryAt: null,
          lastError: 'Erro persistente',
        }),
      }),
    );

    expect(mockPrisma.appointment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'appt-1' },
        data: expect.objectContaining({
          googleSyncError:
            'Não foi possível enviar ao Google: Erro persistente',
        }),
      }),
    );
    expect(mockMetricsService.incrementGoogleSync).toHaveBeenCalledWith('erro');
  });

  it('invalid_grant marca FAILED direto com mensagem específica', async () => {
    mockGoogleAccountService.getAccessToken.mockRejectedValue(
      new GoogleInvalidGrantError('invalid_grant'),
    );

    await worker.processQueue();

    expect(mockPrisma.googleSyncJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'job-1' },
        data: expect.objectContaining({
          status: 'FAILED',
          lastError: 'Conexão com o Google expirou; conecte de novo.',
          nextRetryAt: null,
        }),
      }),
    );

    expect(mockPrisma.appointment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'appt-1' },
        data: expect.objectContaining({
          googleSyncError:
            'Não foi possível enviar ao Google: Conexão com o Google expirou; conecte de novo.',
        }),
      }),
    );
    expect(mockMetricsService.incrementGoogleSync).toHaveBeenCalledWith('erro');
  });
});
