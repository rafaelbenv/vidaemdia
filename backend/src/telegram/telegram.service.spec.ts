import { Test, TestingModule } from '@nestjs/testing';
import { MetricsService } from '../monitoring/metrics.service';
import {
  TelegramService,
  describeFetchError,
  isNetworkError,
} from './telegram.service';

describe('TelegramService - Polling Resiliente', () => {
  let service: TelegramService;
  let mockMetricsService: {
    incrementTelegramUpdateReceived: jest.Mock;
    incrementTelegramApiError: jest.Mock;
  };

  beforeEach(async () => {
    mockMetricsService = {
      incrementTelegramUpdateReceived: jest.fn(),
      incrementTelegramApiError: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TelegramService,
        { provide: MetricsService, useValue: mockMetricsService },
      ],
    }).compile();

    service = module.get<TelegramService>(TelegramService);
  });

  describe('isNetworkError', () => {
    it('retorna true para TypeError("fetch failed")', () => {
      const err = new TypeError('fetch failed');
      expect(isNetworkError(err)).toBe(true);
    });

    it('retorna true para erro com cause.code = ECONNRESET', () => {
      const err = new Error('Connection reset');
      (err as any).cause = { code: 'ECONNRESET', message: 'socket hang up' };
      expect(isNetworkError(err)).toBe(true);
    });

    it('retorna true para todos os códigos de rede mapeados', () => {
      const codes = [
        'ECONNRESET',
        'ETIMEDOUT',
        'EPIPE',
        'ECONNREFUSED',
        'EAI_AGAIN',
        'ENOTFOUND',
        'UND_ERR_SOCKET',
        'UND_ERR_CONNECT_TIMEOUT',
        'UND_ERR_HEADERS_TIMEOUT',
        'UND_ERR_BODY_TIMEOUT',
      ];
      for (const code of codes) {
        const errWithCause = { cause: { code } };
        expect(isNetworkError(errWithCause)).toBe(true);

        const errWithCode = { code };
        expect(isNetworkError(errWithCode)).toBe(true);
      }
    });

    it('retorna false para Error("Telegram getUpdates HTTP 409: ...")', () => {
      const err = new Error(
        'Telegram getUpdates HTTP 409: Conflict: terminated by other getUpdates request',
      );
      expect(isNetworkError(err)).toBe(false);
    });

    it('retorna false para outros erros e valores nulos', () => {
      expect(isNetworkError(null)).toBe(false);
      expect(isNetworkError(undefined)).toBe(false);
      expect(isNetworkError(new Error('Erro de validação'))).toBe(false);
      expect(
        isNetworkError(new TypeError('Cannot read properties of undefined')),
      ).toBe(false);
    });
  });

  describe('describeFetchError', () => {
    it('inclui o código e a mensagem da causa quando existirem', () => {
      const err = new TypeError('fetch failed');
      (err as any).cause = { code: 'ECONNRESET', message: 'socket hang up' };
      expect(describeFetchError(err)).toBe(
        'fetch failed (ECONNRESET: socket hang up)',
      );
    });

    it('inclui apenas o código quando a mensagem da causa não existir', () => {
      const err = new TypeError('fetch failed');
      (err as any).cause = { code: 'ETIMEDOUT' };
      expect(describeFetchError(err)).toBe('fetch failed (ETIMEDOUT)');
    });

    it('inclui apenas a mensagem da causa quando o código não existir', () => {
      const err = new TypeError('fetch failed');
      (err as any).cause = { message: 'socket hang up' };
      expect(describeFetchError(err)).toBe('fetch failed (socket hang up)');
    });

    it('retorna apenas a mensagem do erro se não houver cause', () => {
      const err = new Error(
        'Telegram getUpdates HTTP 500: Internal Server Error',
      );
      expect(describeFetchError(err)).toBe(
        'Telegram getUpdates HTTP 500: Internal Server Error',
      );
    });

    it('aplica maskTelegramToken ao resultado', () => {
      const originalToken = process.env.TELEGRAM_BOT_TOKEN;
      process.env.TELEGRAM_BOT_TOKEN = 'secret-token-12345';
      try {
        const err = new Error(
          'Falha ao conectar em https://api.telegram.org/botsecret-token-12345/getUpdates',
        );
        (err as any).cause = {
          code: 'ECONNRESET',
          message: 'token secret-token-12345 vazou',
        };
        const desc = describeFetchError(err);
        expect(desc).not.toContain('secret-token-12345');
        expect(desc).toContain('***');
      } finally {
        if (originalToken !== undefined) {
          process.env.TELEGRAM_BOT_TOKEN = originalToken;
        } else {
          delete process.env.TELEGRAM_BOT_TOKEN;
        }
      }
    });
  });

  describe('handlePollingError', () => {
    it('na 1ª falha de rede seguida retorna warn, countMetric: false e delay 1000ms', () => {
      const err = new TypeError('fetch failed');
      (err as any).cause = { code: 'ECONNRESET', message: 'socket hang up' };

      const decision = service.handlePollingError(err);
      expect(decision).toEqual({
        level: 'warn',
        countMetric: false,
        delayMs: 1000,
      });
      expect(service.consecutiveNetworkFailures).toBe(1);
    });

    it('na 2ª falha de rede seguida retorna error, countMetric: true e delay 5000ms', () => {
      const err = new TypeError('fetch failed');
      service.handlePollingError(err); // 1ª

      const decision = service.handlePollingError(err); // 2ª
      expect(decision).toEqual({
        level: 'error',
        countMetric: true,
        delayMs: 5000,
      });
      expect(service.consecutiveNetworkFailures).toBe(2);
    });

    it('na 3ª falha de rede seguida retorna error, countMetric: true e delay 10000ms', () => {
      const err = new TypeError('fetch failed');
      service.handlePollingError(err); // 1ª
      service.handlePollingError(err); // 2ª

      const decision = service.handlePollingError(err); // 3ª
      expect(decision).toEqual({
        level: 'error',
        countMetric: true,
        delayMs: 10000,
      });
      expect(service.consecutiveNetworkFailures).toBe(3);
    });

    it('na 4ª falha de rede seguida retorna delay 20000ms e para muitas falhas no máximo 30000ms', () => {
      const err = new TypeError('fetch failed');
      service.handlePollingError(err); // 1ª (1000)
      service.handlePollingError(err); // 2ª (5000)
      service.handlePollingError(err); // 3ª (10000)

      const decision4 = service.handlePollingError(err); // 4ª (20000)
      expect(decision4).toEqual({
        level: 'error',
        countMetric: true,
        delayMs: 20000,
      });

      const decision5 = service.handlePollingError(err); // 5ª (30000)
      expect(decision5).toEqual({
        level: 'error',
        countMetric: true,
        delayMs: 30000,
      });

      const decision6 = service.handlePollingError(err); // 6ª (30000)
      expect(decision6).toEqual({
        level: 'error',
        countMetric: true,
        delayMs: 30000,
      });

      const decision10 = service.handlePollingError(err); // 7ª (30000)
      expect(decision10.delayMs).toBe(30000);
      expect(decision10.level).toBe('error');
      expect(decision10.countMetric).toBe(true);
    });

    it('erro que não é de rede retorna error, true, 5000ms e zera o contador', () => {
      const netErr = new TypeError('fetch failed');
      service.handlePollingError(netErr); // 1ª rede
      service.handlePollingError(netErr); // 2ª rede
      expect(service.consecutiveNetworkFailures).toBe(2);

      const apiErr = new Error('Telegram getUpdates HTTP 409: Conflict');
      const decision = service.handlePollingError(apiErr);
      expect(decision).toEqual({
        level: 'error',
        countMetric: true,
        delayMs: 5000,
      });
      expect(service.consecutiveNetworkFailures).toBe(0);

      // Próxima falha de rede volta a ser tratada como 1ª
      const nextDecision = service.handlePollingError(netErr);
      expect(nextDecision).toEqual({
        level: 'warn',
        countMetric: false,
        delayMs: 1000,
      });
      expect(service.consecutiveNetworkFailures).toBe(1);
    });
  });

  describe('resetPollingFailures', () => {
    it('o contador zera quando resetPollingFailures é chamado (sucesso do getUpdates)', () => {
      const netErr = new TypeError('fetch failed');
      service.handlePollingError(netErr);
      service.handlePollingError(netErr);
      service.handlePollingError(netErr);
      expect(service.consecutiveNetworkFailures).toBe(3);

      service.resetPollingFailures();
      expect(service.consecutiveNetworkFailures).toBe(0);

      // Após sucesso, nova falha de rede deve ser tratada como 1ª
      const decision = service.handlePollingError(netErr);
      expect(decision).toEqual({
        level: 'warn',
        countMetric: false,
        delayMs: 1000,
      });
      expect(service.consecutiveNetworkFailures).toBe(1);
    });
  });
});
