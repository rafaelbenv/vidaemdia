import { AppointmentStatus, NotificationChannel, ReminderStatus } from '@prisma/client';
import { NotificationWorker } from './notification.worker';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationProvider } from './notification.provider';
import { MetricsService } from '../monitoring/metrics.service';

describe('NotificationWorker', () => {
  let worker: NotificationWorker;
  let mockPrisma: any;
  let mockNotificationProvider: any;
  let mockMetricsService: any;

  const baseReminder = {
    id: 'rem-1',
    appointmentId: 'appt-1',
    remindAt: new Date(Date.now() - 1000),
    channel: NotificationChannel.TELEGRAM,
    status: ReminderStatus.PENDING,
    retryCount: 0,
    nextRetryAt: null,
    lastError: null,
    sentAt: null,
    claimedAt: null,
    claimedBy: null,
    appointment: {
      id: 'appt-1',
      title: 'Consulta Médica',
      description: 'Retorno de rotina',
      startTime: new Date('2026-11-20T10:00:00.000Z'),
      endTime: new Date('2026-11-20T11:00:00.000Z'),
      status: AppointmentStatus.SCHEDULED,
      calendar: {
        name: 'Agenda Principal',
        owner: {
          id: 'user-1',
          name: 'Paciente Teste',
          telegramChatId: '123456789',
        },
      },
    },
  };

  beforeEach(() => {
    mockPrisma = {
      reminder: {
        findMany: jest.fn().mockResolvedValue([baseReminder]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue(baseReminder),
      },
    };

    mockNotificationProvider = {
      sendReminderMessage: jest.fn().mockResolvedValue({ success: true }),
    };

    mockMetricsService = {
      incrementReminderSent: jest.fn(),
      incrementReminderFailed: jest.fn(),
    };

    worker = new NotificationWorker(
      mockPrisma as unknown as PrismaService,
      mockNotificationProvider as unknown as NotificationProvider,
      mockMetricsService as unknown as MetricsService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('deve realizar reserva bem-sucedida (updateMany -> { count: 1 }) e atualizar com status SENT e claimedAt: null após envio ok', async () => {
    mockPrisma.reminder.updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 });

    const result = await worker.processPendingReminders();

    expect(mockPrisma.reminder.updateMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'rem-1',
          status: ReminderStatus.PENDING,
        }),
        data: expect.objectContaining({
          status: ReminderStatus.PROCESSING,
          claimedAt: expect.any(Date),
          claimedBy: expect.any(String),
        }),
      }),
    );

    expect(mockNotificationProvider.sendReminderMessage).toHaveBeenCalledTimes(1);

    expect(mockPrisma.reminder.update).toHaveBeenCalledWith({
      where: { id: 'rem-1' },
      data: {
        status: ReminderStatus.SENT,
        sentAt: expect.any(Date),
        lastError: null,
        claimedAt: null,
        claimedBy: null,
      },
    });

    expect(mockMetricsService.incrementReminderSent).toHaveBeenCalledWith(NotificationChannel.TELEGRAM);
    expect(result.sent).toBe(1);
    expect(result.skipped).toBe(0);
  });

  it('deve ignorar lembrete em caso de reserva perdida ({ count: 0 }), não chamar sendReminderMessage e retornar skipped: 1', async () => {
    mockPrisma.reminder.updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 0 });

    const result = await worker.processPendingReminders();

    expect(mockNotificationProvider.sendReminderMessage).not.toHaveBeenCalled();
    expect(mockPrisma.reminder.update).not.toHaveBeenCalled();
    expect(result.skipped).toBe(1);
    expect(result.sent).toBe(0);
    expect(result.message).toContain('1 reservado(s) por outra instância');
  });

  it('deve agendar nova tentativa (status PENDING, retryCount + 1, nextRetryAt e reserva limpa) em caso de falha com tentativas sobrando', async () => {
    mockPrisma.reminder.updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 });

    mockNotificationProvider.sendReminderMessage.mockResolvedValue({
      success: false,
      error: 'Erro temporário de conexão',
    });

    const result = await worker.processPendingReminders();

    expect(mockPrisma.reminder.update).toHaveBeenCalledWith({
      where: { id: 'rem-1' },
      data: {
        retryCount: 1,
        status: ReminderStatus.PENDING,
        nextRetryAt: expect.any(Date),
        lastError: 'Erro temporário de conexão',
        claimedAt: null,
        claimedBy: null,
      },
    });

    expect(mockMetricsService.incrementReminderFailed).toHaveBeenCalledWith(NotificationChannel.TELEGRAM);
    expect(result.retried).toBe(1);
    expect(result.failedPermanently).toBe(0);
    expect(result.sent).toBe(0);
  });

  it('deve marcar status como FAILED na última tentativa excedida e limpar reserva', async () => {
    mockPrisma.reminder.findMany.mockResolvedValueOnce([
      {
        ...baseReminder,
        retryCount: 2,
      },
    ]);

    mockPrisma.reminder.updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 });

    mockNotificationProvider.sendReminderMessage.mockResolvedValue({
      success: false,
      error: 'Destinatário bloqueou o bot',
    });

    const result = await worker.processPendingReminders();

    expect(mockPrisma.reminder.update).toHaveBeenCalledWith({
      where: { id: 'rem-1' },
      data: {
        retryCount: 3,
        status: ReminderStatus.FAILED,
        nextRetryAt: null,
        lastError: 'Destinatário bloqueou o bot',
        claimedAt: null,
        claimedBy: null,
      },
    });

    expect(result.failedPermanently).toBe(1);
    expect(result.retried).toBe(0);
  });

  it('deve tratar exceção lançada no envio como falha para não deixar o lembrete preso em PROCESSING', async () => {
    mockPrisma.reminder.updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 });

    mockNotificationProvider.sendReminderMessage.mockRejectedValue(
      new Error('Queda inesperada no provedor HTTP'),
    );

    const result = await worker.processPendingReminders();

    expect(mockPrisma.reminder.update).toHaveBeenCalledWith({
      where: { id: 'rem-1' },
      data: {
        retryCount: 1,
        status: ReminderStatus.PENDING,
        nextRetryAt: expect.any(Date),
        lastError: 'Queda inesperada no provedor HTTP',
        claimedAt: null,
        claimedBy: null,
      },
    });

    expect(result.retried).toBe(1);
    expect(mockMetricsService.incrementReminderFailed).toHaveBeenCalledWith(NotificationChannel.TELEGRAM);
  });

  it('deve recuperar reservas esquecidas no primeiro updateMany do ciclo com status PROCESSING e claimedAt < now - 5min', async () => {
    mockPrisma.reminder.updateMany.mockResolvedValueOnce({ count: 3 });
    mockPrisma.reminder.findMany.mockResolvedValueOnce([]);

    const beforeCall = Date.now();
    const result = await worker.processPendingReminders();
    const afterCall = Date.now();

    expect(mockPrisma.reminder.updateMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          status: ReminderStatus.PROCESSING,
          claimedAt: { lt: expect.any(Date) },
        }),
        data: {
          status: ReminderStatus.PENDING,
          claimedAt: null,
          claimedBy: null,
        },
      }),
    );

    const callArgs = mockPrisma.reminder.updateMany.mock.calls[0][0];
    const threshold = callArgs.where.claimedAt.lt.getTime();
    expect(threshold).toBeLessThanOrEqual(afterCall - 5 * 60 * 1000 + 100);
    expect(threshold).toBeGreaterThanOrEqual(beforeCall - 5 * 60 * 1000 - 1000);

    expect(result.processed).toBe(0);
    expect(result.skipped).toBe(0);
  });

  it('deve retornar aviso quando o worker já estiver em execução', async () => {
    mockPrisma.reminder.updateMany.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve({ count: 0 }), 50);
        }),
    );

    const firstRunPromise = worker.processPendingReminders();
    const concurrentRun = await worker.processPendingReminders();

    expect(concurrentRun).toEqual({
      processed: 0,
      skipped: 0,
      message: 'Worker já está em execução neste momento',
    });

    await firstRunPromise;
  });
});
