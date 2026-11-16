import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { MetricsService } from '../monitoring/metrics.service';
import {
  TelegramApiResponse,
  TelegramMode,
  TelegramUpdate,
  TelegramUpdateHandler,
} from './telegram.types';

export function escapeHtml(s: string | null | undefined): string {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function maskTelegramToken(text: string): string {
  if (!text) return '';
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  let result = text;
  if (token) {
    result = result.split(token).join('***');
  }
  return result.replace(/\/bot[^/?#\s]+/gi, '/bot***');
}

const NETWORK_ERROR_CODES = new Set([
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
]);

export function describeFetchError(err: any): string {
  if (!err) return '';
  const message = err?.message || String(err);
  const causeCode = err?.cause?.code;
  const causeMessage = err?.cause?.message;

  let causeDetails = '';
  if (causeCode && causeMessage) {
    causeDetails = `${causeCode}: ${causeMessage}`;
  } else if (causeCode) {
    causeDetails = String(causeCode);
  } else if (causeMessage) {
    causeDetails = String(causeMessage);
  } else if (typeof err?.cause === 'string' && err.cause.trim()) {
    causeDetails = err.cause.trim();
  }

  const full = causeDetails ? `${message} (${causeDetails})` : message;
  return maskTelegramToken(full);
}

export function isNetworkError(err: any): boolean {
  if (!err) return false;
  if (
    (err instanceof TypeError || err?.name === 'TypeError') &&
    err?.message === 'fetch failed'
  ) {
    return true;
  }
  const causeCode = err?.cause?.code;
  if (causeCode && NETWORK_ERROR_CODES.has(causeCode)) {
    return true;
  }
  const code = err?.code;
  if (code && NETWORK_ERROR_CODES.has(code)) {
    return true;
  }
  return false;
}

export interface PollingErrorDecision {
  delayMs: number;
  countMetric: boolean;
  level: 'warn' | 'error';
}

@Injectable()
export class TelegramService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramService.name);
  private readonly updateHandlers: TelegramUpdateHandler[] = [];
  private isPolling = false;
  private abortController: AbortController | null = null;
  private lastUpdateId = 0;
  consecutiveNetworkFailures = 0;

  constructor(
    @Optional() private readonly metricsService?: MetricsService,
  ) {}

  getMode(): TelegramMode {
    const envMode = process.env.TELEGRAM_MODE?.trim().toLowerCase();
    if (envMode === 'polling' || envMode === 'webhook' || envMode === 'mock') {
      return envMode;
    }
    if (!process.env.TELEGRAM_MODE && process.env.TELEGRAM_MOCK_MODE === 'false') {
      return 'polling';
    }
    return 'mock';
  }

  async onModuleInit(): Promise<void> {
    const mode = this.getMode();
    this.logger.log(`TelegramService inicializado em modo: ${mode.toUpperCase()}`);

    if (mode === 'mock') {
      return;
    }

    if (mode === 'webhook') {
      await this.setWebhook();
    } else if (mode === 'polling') {
      await this.deleteWebhook();
      this.startPollingLoop();
    }
  }

  onModuleDestroy(): void {
    this.isPolling = false;
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  onUpdate(handler: TelegramUpdateHandler): void {
    this.updateHandlers.push(handler);
  }

  async dispatchUpdate(update: TelegramUpdate): Promise<void> {
    this.metricsService?.incrementTelegramUpdateReceived();
    for (const handler of this.updateHandlers) {
      try {
        await handler(update);
      } catch (err: any) {
        this.logger.error(
          `Erro no processamento do update ${update.update_id}: ${maskTelegramToken(err?.message || String(err))}`,
        );
      }
    }
  }

  async sendMessage(
    chatId: string | number,
    text: string,
  ): Promise<TelegramApiResponse> {
    const mode = this.getMode();

    if (mode === 'mock') {
      this.logger.log(
        `✈️ [Telegram Bot API - MOCK] sendMessage para chat_id=${chatId}: ${text.replace(/\n/g, ' | ')}`,
      );
      return { ok: true, result: null };
    }

    const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
    if (!token) {
      throw new Error('TELEGRAM_BOT_TOKEN não configurado');
    }

    const cleanChatId = typeof chatId === 'string' ? chatId.trim() : chatId;
    const url = `https://api.telegram.org/bot${token}/sendMessage`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: cleanChatId,
          text,
          parse_mode: 'HTML',
        }),
      });
    } catch (err: any) {
      this.metricsService?.incrementTelegramApiError();
      const masked = maskTelegramToken(err?.message || 'Falha de conexão com a Telegram Bot API');
      this.logger.error(`Erro de conexão ao enviar mensagem Telegram para ${cleanChatId}: ${masked}`);
      throw new Error(masked);
    }

    if (!response.ok) {
      this.metricsService?.incrementTelegramApiError();
      let description = response.statusText;
      try {
        const errorJson = (await response.json()) as any;
        if (errorJson && errorJson.description) {
          description = errorJson.description;
        }
      } catch {
        try {
          description = await response.text();
        } catch {
          // corpo ilegível: mantém a descrição padrão
        }
      }
      const safeDesc = maskTelegramToken(description);
      const errorMsg = `Telegram API HTTP ${response.status}: ${safeDesc}`;
      this.logger.error(`Falha no envio Telegram para ${cleanChatId}: ${errorMsg}`);
      throw new Error(errorMsg);
    }

    return (await response.json()) as TelegramApiResponse;
  }

  async deleteWebhook(): Promise<void> {
    const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
    if (!token) {
      this.logger.warn('TELEGRAM_BOT_TOKEN não configurado; deleteWebhook ignorado');
      return;
    }

    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/deleteWebhook`, {
        method: 'POST',
      });
      if (!response.ok) {
        const errText = await response.text();
        this.logger.warn(
          `Aviso ao remover webhook do Telegram: HTTP ${response.status} - ${maskTelegramToken(errText)}`,
        );
      } else {
        this.logger.log('Webhook do Telegram removido com sucesso (modo polling)');
      }
    } catch (err: any) {
      this.logger.warn(
        `Erro ao chamar deleteWebhook do Telegram: ${maskTelegramToken(err?.message || String(err))}`,
      );
    }
  }

  async setWebhook(): Promise<void> {
    const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
    const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL?.trim();
    const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();

    if (!token) {
      this.logger.error('TELEGRAM_BOT_TOKEN não configurado para modo webhook');
      return;
    }
    if (!webhookUrl) {
      this.logger.error('TELEGRAM_WEBHOOK_URL não configurado para modo webhook');
      return;
    }

    try {
      const body: Record<string, any> = {
        url: webhookUrl,
        allowed_updates: ['message'],
      };
      if (webhookSecret) {
        body.secret_token = webhookSecret;
      }

      const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`HTTP ${response.status}: ${errBody}`);
      }

      const resJson = await response.json();
      this.logger.log(
        `Webhook do Telegram configurado com sucesso em ${webhookUrl}: ${JSON.stringify(resJson)}`,
      );
    } catch (err: any) {
      this.logger.error(
        `Falha ao configurar webhook do Telegram: ${maskTelegramToken(err?.message || String(err))}`,
      );
    }
  }

  resetPollingFailures(): void {
    this.consecutiveNetworkFailures = 0;
  }

  handlePollingError(err: any): PollingErrorDecision {
    if (isNetworkError(err)) {
      this.consecutiveNetworkFailures++;
      if (this.consecutiveNetworkFailures === 1) {
        return {
          level: 'warn',
          countMetric: false,
          delayMs: 1000,
        };
      }
      const delays: Record<number, number> = {
        2: 5000,
        3: 10000,
        4: 20000,
      };
      const delayMs = delays[this.consecutiveNetworkFailures] ?? 30000;
      return {
        level: 'error',
        countMetric: true,
        delayMs,
      };
    }

    this.consecutiveNetworkFailures = 0;
    return {
      level: 'error',
      countMetric: true,
      delayMs: 5000,
    };
  }

  private startPollingLoop(): void {
    this.isPolling = true;
    this.abortController = new AbortController();
    this.logger.log('Iniciando loop assíncrono de polling do Telegram...');

    void (async () => {
      while (this.isPolling) {
        try {
          const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
          if (!token) {
            this.logger.warn('TELEGRAM_BOT_TOKEN ausente no modo polling. Aguardando 5s...');
            await this.sleep(5000);
            continue;
          }

          const params = new URLSearchParams({
            timeout: '30',
            allowed_updates: JSON.stringify(['message']),
          });
          if (this.lastUpdateId > 0) {
            params.set('offset', String(this.lastUpdateId + 1));
          }

          const url = `https://api.telegram.org/bot${token}/getUpdates?${params.toString()}`;
          const response = await fetch(url, {
            signal: this.abortController?.signal,
          });

          if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Telegram getUpdates HTTP ${response.status}: ${errText}`);
          }

          const data = (await response.json()) as {
            ok: boolean;
            result?: TelegramUpdate[];
            description?: string;
          };

          if (data.ok && Array.isArray(data.result)) {
            this.resetPollingFailures();
            for (const update of data.result) {
              if (!this.isPolling) break;
              if (typeof update.update_id === 'number') {
                this.lastUpdateId = Math.max(this.lastUpdateId, update.update_id);
              }
              await this.dispatchUpdate(update);
            }
          } else if (!data.ok) {
            throw new Error(`Telegram getUpdates falhou: ${data.description || 'erro desconhecido'}`);
          }
        } catch (err: any) {
          if (!this.isPolling || err?.name === 'AbortError') {
            break;
          }
          const decision = this.handlePollingError(err);
          const desc = describeFetchError(err);
          if (decision.level === 'warn') {
            this.logger.warn(
              `Conexão do polling do Telegram caiu (${desc}); tentando de novo em 1 s.`,
            );
          } else {
            this.logger.error(`Erro no polling do Telegram: ${desc}`);
          }
          if (decision.countMetric) {
            this.metricsService?.incrementTelegramApiError();
          }
          await this.sleep(decision.delayMs);
        }
      }
    })();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const timer = setTimeout(resolve, ms);
      if (this.abortController?.signal) {
        this.abortController.signal.addEventListener(
          'abort',
          () => {
            clearTimeout(timer);
            resolve();
          },
          { once: true },
        );
      }
    });
  }
}
