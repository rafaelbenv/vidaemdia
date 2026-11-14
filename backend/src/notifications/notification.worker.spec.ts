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

  it('quando nenhum lembrete pendente deve retornar processed: 0 com mensagem de aguardando próximo ciclo e não chamar sendReminderMessage', async () => {
    mockPrisma.reminder.findMany.mockResolvedValueOnce([]);

    const result = await worker.processPendingReminders();

    expect(result.processed).toBe(0);
    expect(result.message).toContain('aguardando próximo ciclo');
    expect(mockNotificationProvider.sendReminderMessage).not.toHaveBeenCalled();
  });

  it('a busca de pendentes filtra status PENDING, remindAt <= agora, retryCount < maxRetries e compromisso SCHEDULED', async () => {
    mockPrisma.reminder.findMany.mockResolvedValueOnce([]);

    const beforeCall = new Date();
    await worker.processPendingReminders();
    const afterCall = new Date();

    expect(mockPrisma.reminder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: ReminderStatus.PENDING,
          retryCount: { lt: 3 },
          appointment: {
            status: AppointmentStatus.SCHEDULED,
          },
          remindAt: {
            lte: expect.any(Date),
          },
        }),
      }),
    );

    const callArgs = mockPrisma.reminder.findMany.mock.calls[0][0];
    const remindAtLte = callArgs.where.remindAt.lte.getTime();
    expect(remindAtLte).toBeGreaterThanOrEqual(beforeCall.getTime());
    expect(remindAtLte).toBeLessThanOrEqual(afterCall.getTime());
  });

  it('formato da mensagem com APP_TIMEZONE=America/Sao_Paulo e compromisso às 2026-11-10T11:00:00Z deve conter título escapado com &lt;b&gt;, 10/11/2026 e 08:00', async () => {
    const originalTz = process.env.APP_TIMEZONE;
    process.env.APP_TIMEZONE = 'America/Sao_Paulo';

    try {
      const customReminder = {
        ...baseReminder,
        appointment: {
          ...baseReminder.appointment,
          title: '<b>Consulta Especial</b>',
          startTime: new Date('2026-11-10T11:00:00Z'),
          endTime: new Date('2026-11-10T12:00:00Z'),
        },
      };

      mockPrisma.reminder.findMany.mockResolvedValueOnce([customReminder]);
      mockPrisma.reminder.updateMany
        .mockResolvedValueOnce({ count: 0 })
        .mockResolvedValueOnce({ count: 1 });

      await worker.processPendingReminders();

      expect(mockNotificationProvider.sendReminderMessage).toHaveBeenCalledTimes(1);
      const callArgs = mockNotificationProvider.sendReminderMessage.mock.calls[0][0];
      expect(callArgs.messageText).toContain('&lt;b&gt;Consulta Especial&lt;/b&gt;');
      expect(callArgs.messageText).toContain('10/11/2026');
      expect(callArgs.messageText).toContain('08:00');
    } finally {
      if (originalTz !== undefined) {
        process.env.APP_TIMEZONE = originalTz;
      } else {
        delete process.env.APP_TIMEZONE;
      }
    }
  });

  it('mensagem de dia inteiro sem horário quando appt.allDay é true', async () => {
    const originalTz = process.env.APP_TIMEZONE;
    process.env.APP_TIMEZONE = 'America/Sao_Paulo';

    try {
      const allDayReminder = {
        ...baseReminder,
        appointment: {
          ...baseReminder.appointment,
          title: 'Congresso Anual',
          allDay: true,
          startTime: new Date('2026-11-20T03:00:00.000Z'),
          endTime: new Date('2026-11-21T03:00:00.000Z'),
        },
      };

      mockPrisma.reminder.findMany.mockResolvedValueOnce([allDayReminder]);
      mockPrisma.reminder.updateMany
        .mockResolvedValueOnce({ count: 0 })
        .mockResolvedValueOnce({ count: 1 });

      await worker.processPendingReminders();

      expect(mockNotificationProvider.sendReminderMessage).toHaveBeenCalledTimes(1);
      const callArgs = mockNotificationProvider.sendReminderMessage.mock.calls[0][0];
      expect(callArgs.messageText).toContain('Congresso Anual em 20/11/2026 (dia inteiro).');
      expect(callArgs.messageText).not.toContain('às ');
    } finally {
      if (originalTz !== undefined) {
        process.env.APP_TIMEZONE = originalTz;
      } else {
        delete process.env.APP_TIMEZONE;
      }
    }
  });

  it('maxRetries deve vir de MAX_REMINDER_RETRIES (com "5", 4ª falha ainda volta para PENDING e 5ª marca FAILED)', async () => {
    const originalMaxRetries = process.env.MAX_REMINDER_RETRIES;
    process.env.MAX_REMINDER_RETRIES = '5';

    try {
      // 4ª falha: retryCount atual = 3 -> newRetryCount = 4 (< 5), volta para PENDING
      mockPrisma.reminder.findMany.mockResolvedValueOnce([
        {
          ...baseReminder,
          id: 'rem-retry-4',
          retryCount: 3,
        },
      ]);
      mockPrisma.reminder.updateMany
        .mockResolvedValueOnce({ count: 0 })
        .mockResolvedValueOnce({ count: 1 });
      mockNotificationProvider.sendReminderMessage.mockResolvedValueOnce({
        success: false,
        error: 'Erro na 4ª tentativa',
      });

      const result4 = await worker.processPendingReminders();

      expect(mockPrisma.reminder.update).toHaveBeenCalledWith({
        where: { id: 'rem-retry-4' },
        data: {
          retryCount: 4,
          status: ReminderStatus.PENDING,
          nextRetryAt: expect.any(Date),
          lastError: 'Erro na 4ª tentativa',
          claimedAt: null,
          claimedBy: null,
        },
      });
      expect(result4.retried).toBe(1);
      expect(result4.failedPermanently).toBe(0);

      // 5ª falha: retryCount atual = 4 -> newRetryCount = 5 (>= 5), marca FAILED
      mockPrisma.reminder.findMany.mockResolvedValueOnce([
        {
          ...baseReminder,
          id: 'rem-retry-5',
          retryCount: 4,
        },
      ]);
      mockPrisma.reminder.updateMany
        .mockResolvedValueOnce({ count: 0 })
        .mockResolvedValueOnce({ count: 1 });
      mockNotificationProvider.sendReminderMessage.mockResolvedValueOnce({
        success: false,
        error: 'Erro na 5ª tentativa',
      });

      const result5 = await worker.processPendingReminders();

      expect(mockPrisma.reminder.update).toHaveBeenCalledWith({
        where: { id: 'rem-retry-5' },
        data: {
          retryCount: 5,
          status: ReminderStatus.FAILED,
          nextRetryAt: null,
          lastError: 'Erro na 5ª tentativa',
          claimedAt: null,
          claimedBy: null,
        },
      });
      expect(result5.retried).toBe(0);
      expect(result5.failedPermanently).toBe(1);
    } finally {
      if (originalMaxRetries !== undefined) {
        process.env.MAX_REMINDER_RETRIES = originalMaxRetries;
      } else {
        delete process.env.MAX_REMINDER_RETRIES;
      }
    }
  });
});
