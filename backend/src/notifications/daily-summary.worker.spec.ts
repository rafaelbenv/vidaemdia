import { AppointmentStatus } from '@prisma/client';
import {
  DailySummaryWorker,
  saoPauloHour,
  buildDailySummaryMessage,
} from './daily-summary.worker';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';
import { MetricsService } from '../monitoring/metrics.service';

describe('DailySummaryWorker', () => {
  let worker: DailySummaryWorker;
  let mockPrisma: any;
  let mockTelegramService: any;
  let mockMetricsService: any;

  beforeEach(() => {
    mockPrisma = {
      user: {
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      appointment: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    mockTelegramService = {
      sendMessage: jest.fn().mockResolvedValue({ ok: true, result: null }),
    };

    mockMetricsService = {
      incrementDailySummarySent: jest.fn(),
      incrementDailySummaryFailed: jest.fn(),
    };

    worker = new DailySummaryWorker(
      mockPrisma as unknown as PrismaService,
      mockTelegramService as unknown as TelegramService,
      mockMetricsService as unknown as MetricsService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('saoPauloHour', () => {
    it('deve converter 2026-11-16T10:00:00Z para a hora 7 de São Paulo', () => {
      expect(saoPauloHour(new Date('2026-11-16T10:00:00Z'))).toBe(7);
    });
  });

  describe('buildDailySummaryMessage', () => {
    it('lista vazia gera o texto com "Dia livre"', () => {
      const msg = buildDailySummaryMessage('Carlos', [], '2026-11-16');
      expect(msg).toContain('Dia livre! 🎉');
      expect(msg).toContain(
        '☀️ <b>Bom dia, Carlos!</b> Você não tem compromissos hoje (16/11). Dia livre! 🎉',
      );
      expect(msg).toContain(
        '💡 <i>Para desligar ou mudar o horário, acesse Minha conta no VidaEmDia.</i>',
      );
    });

    it('compromisso de dia inteiro aparece como "Dia inteiro" antes dos que têm horário', () => {
      const appts = [
        {
          title: 'Consulta Médica',
          startTime: new Date('2026-11-16T13:00:00Z'),
          endTime: new Date('2026-11-16T14:00:00Z'),
          allDay: false,
          calendar: { name: 'Saúde' },
        },
        {
          title: 'Feriado Municipal',
          startTime: new Date('2026-11-16T03:00:00Z'),
          endTime: new Date('2026-11-17T03:00:00Z'),
          allDay: true,
          calendar: { name: 'Principal' },
        },
      ];

      const msg = buildDailySummaryMessage('Carlos', appts, '2026-11-16');
      expect(msg).toContain('• <b>Dia inteiro</b> — Feriado Municipal <i>(Principal)</i>');
      expect(msg).toContain('• <b>10:00</b> — Consulta Médica <i>(Saúde)</i>');
      const idxAllDay = msg.indexOf('Dia inteiro');
      const idxTimed = msg.indexOf('10:00');
      expect(idxAllDay).toBeLessThan(idxTimed);
    });

    it('o horário sai em São Paulo: 2026-11-16T12:00:00Z vira 09:00', () => {
      const appts = [
        {
          title: 'Reunião de Equipe',
          startTime: new Date('2026-11-16T12:00:00Z'),
          endTime: new Date('2026-11-16T13:00:00Z'),
          allDay: false,
          calendar: { name: 'Trabalho' },
        },
      ];

      const msg = buildDailySummaryMessage('Carlos', appts, '2026-11-16');
      expect(msg).toContain('• <b>09:00</b> — Reunião de Equipe <i>(Trabalho)</i>');
    });

    it('título com <b> é escapado', () => {
      const appts = [
        {
          title: '<b>Dentista urgente</b> & Revisão',
          startTime: new Date('2026-11-16T12:00:00Z'),
          endTime: new Date('2026-11-16T13:00:00Z'),
          allDay: false,
          calendar: { name: 'Saúde <1>' },
        },
      ];

      const msg = buildDailySummaryMessage('<Carlos>', appts, '2026-11-16');
      expect(msg).toContain('&lt;b&gt;Dentista urgente&lt;/b&gt; &amp; Revisão');
      expect(msg).toContain('Saúde &lt;1&gt;');
      expect(msg).toContain('&lt;Carlos&gt;');
      expect(msg).not.toContain('<b>Dentista urgente</b>');
    });

    it('compromisso iniciado ontem aparece como "Em andamento"', () => {
      const appts = [
        {
          title: 'Plantão Noturno',
          startTime: new Date('2026-11-16T02:00:00Z'),
          endTime: new Date('2026-11-16T10:00:00Z'),
          allDay: false,
          calendar: { name: 'Hospital' },
        },
      ];

      const msg = buildDailySummaryMessage('Carlos', appts, '2026-11-16');
      expect(msg).toContain('• <b>Em andamento</b> — Plantão Noturno <i>(Hospital)</i>');
    });
  });

  describe('run', () => {
    it('o findMany de usuários é chamado com dailySummaryHour igual à hora de São Paulo e dailySummaryEnabled: true', async () => {
      const date = new Date('2026-11-16T10:00:00Z'); // 07:00 São Paulo

      await worker.run(date);

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        where: {
          dailySummaryEnabled: true,
          dailySummaryHour: 7,
          telegramChatId: { not: null },
          OR: [
            { dailySummaryLastSentOn: null },
            { dailySummaryLastSentOn: { not: '2026-11-16' } },
          ],
        },
        select: {
          id: true,
          name: true,
          telegramChatId: true,
          dailySummaryLastSentOn: true,
        },
        take: 200,
      });
    });

    it('envia para o candidato, grava a reserva com today e conta sent', async () => {
      const date = new Date('2026-11-16T10:00:00Z');
      const candidate = {
        id: 'u-1',
        name: 'Carlos Silva',
        telegramChatId: '123456',
        dailySummaryLastSentOn: null,
      };

      mockPrisma.user.findMany.mockResolvedValue([candidate]);
      mockPrisma.user.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.appointment.findMany.mockResolvedValue([
        {
          title: 'Reunião',
          startTime: new Date('2026-11-16T12:00:00Z'),
          endTime: new Date('2026-11-16T13:00:00Z'),
          allDay: false,
          calendar: { name: 'Principal' },
        },
      ]);

      const result = await worker.run(date);

      expect(mockPrisma.user.updateMany).toHaveBeenCalledWith({
        where: { id: 'u-1', dailySummaryLastSentOn: null },
        data: { dailySummaryLastSentOn: '2026-11-16' },
      });

      expect(mockPrisma.appointment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: AppointmentStatus.SCHEDULED,
            calendar: { ownerId: 'u-1' },
          }),
        }),
      );

      expect(mockTelegramService.sendMessage).toHaveBeenCalledWith(
        '123456',
        expect.stringContaining('Sua agenda de hoje (16/11):'),
      );

      expect(mockMetricsService.incrementDailySummarySent).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        today: '2026-11-16',
        hour: 7,
        candidates: 1,
        sent: 1,
        failed: 0,
        skipped: 0,
      });
    });

    it('quando a reserva devolve count: 0, não envia e conta skipped', async () => {
      const date = new Date('2026-11-16T10:00:00Z');
      const candidate = {
        id: 'u-1',
        name: 'Carlos Silva',
        telegramChatId: '123456',
        dailySummaryLastSentOn: null,
      };

      mockPrisma.user.findMany.mockResolvedValue([candidate]);
      mockPrisma.user.updateMany.mockResolvedValue({ count: 0 });

      const result = await worker.run(date);

      expect(mockPrisma.user.updateMany).toHaveBeenCalledTimes(1);
      expect(mockTelegramService.sendMessage).not.toHaveBeenCalled();
      expect(mockMetricsService.incrementDailySummarySent).not.toHaveBeenCalled();
      expect(result).toEqual({
        today: '2026-11-16',
        hour: 7,
        candidates: 1,
        sent: 0,
        failed: 0,
        skipped: 1,
      });
    });

    it('quando o sendMessage lança erro, desfaz a reserva (2ª chamada de updateMany volta o valor anterior), conta failed, chama incrementDailySummaryFailed e mesmo assim segue para o próximo usuário', async () => {
      const date = new Date('2026-11-16T10:00:00Z');
      const user1 = {
        id: 'u-1',
        name: 'Carlos Silva',
        telegramChatId: '111',
        dailySummaryLastSentOn: '2026-11-15',
      };
      const user2 = {
        id: 'u-2',
        name: 'Ana Souza',
        telegramChatId: '222',
        dailySummaryLastSentOn: null,
      };

      mockPrisma.user.findMany.mockResolvedValue([user1, user2]);
      mockPrisma.user.updateMany.mockResolvedValue({ count: 1 });
      mockTelegramService.sendMessage
        .mockRejectedValueOnce(new Error('Falha na API do Telegram'))
        .mockResolvedValueOnce({ ok: true });

      const result = await worker.run(date);

      // Chamada 1: reserva user1
      expect(mockPrisma.user.updateMany).toHaveBeenNthCalledWith(1, {
        where: { id: 'u-1', dailySummaryLastSentOn: '2026-11-15' },
        data: { dailySummaryLastSentOn: '2026-11-16' },
      });

      // Chamada 2: rollback user1 voltando '2026-11-15'
      expect(mockPrisma.user.updateMany).toHaveBeenNthCalledWith(2, {
        where: { id: 'u-1', dailySummaryLastSentOn: '2026-11-16' },
        data: { dailySummaryLastSentOn: '2026-11-15' },
      });

      // Chamada 3: reserva user2
      expect(mockPrisma.user.updateMany).toHaveBeenNthCalledWith(3, {
        where: { id: 'u-2', dailySummaryLastSentOn: null },
        data: { dailySummaryLastSentOn: '2026-11-16' },
      });

      expect(mockMetricsService.incrementDailySummaryFailed).toHaveBeenCalledTimes(1);
      expect(mockMetricsService.incrementDailySummarySent).toHaveBeenCalledTimes(1);

      expect(result).toEqual({
        today: '2026-11-16',
        hour: 7,
        candidates: 2,
        sent: 1,
        failed: 1,
        skipped: 0,
      });
    });

    it('impede execuções concorrentes com isRunning', async () => {
      let resolveFirst: () => void;
      const promise = new Promise<any[]>((resolve) => {
        resolveFirst = () => resolve([]);
      });

      mockPrisma.user.findMany.mockReturnValueOnce(promise);

      const firstRun = worker.run(new Date('2026-11-16T10:00:00Z'));
      const secondRun = await worker.run(new Date('2026-11-16T10:00:00Z'));

      expect(secondRun).toEqual({
        today: '2026-11-16',
        hour: 7,
        candidates: 0,
        sent: 0,
        failed: 0,
        skipped: 0,
      });

      resolveFirst!();
      await firstRun;
    });
  });
});
