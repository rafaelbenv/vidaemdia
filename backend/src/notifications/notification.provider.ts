import { Injectable, Logger } from '@nestjs/common';
import { NotificationChannel } from '@prisma/client';
import { TelegramService } from '../telegram/telegram.service';

export interface DispatchedMessageLog {
  id: string;
  channel: 'TELEGRAM';
  recipient: string;
  recipientName: string;
  message: string;
  appointmentId: string;
  reminderId: string;
  success: boolean;
  providerMode: 'MOCK' | 'LIVE_API';
  error?: string;
  timestamp: string;
}

@Injectable()
export class NotificationProvider {
  private readonly logger = new Logger(NotificationProvider.name);
  private readonly dispatchedMessages: DispatchedMessageLog[] = [];
  private simulateFailureNextCount = 0;

  constructor(private readonly telegramService: TelegramService) {}

  /**
   * Permite simular falhas temporárias da API do Telegram para demonstrar e testar
   * o fluxo de Retry (máx. 3 tentativas) do diagrama VidaEmDia_Fluxo.drawio.html
   */
  setSimulateFailureCount(count: number) {
    this.simulateFailureNextCount = count;
    return { simulateFailureNextCount: this.simulateFailureNextCount };
  }

  getDispatchedMessages(): DispatchedMessageLog[] {
    return this.dispatchedMessages.slice().reverse();
  }

  async sendReminderMessage(params: {
    reminderId: string;
    appointmentId: string;
    channel: NotificationChannel;
    recipientName: string;
    telegramChatId?: string | null;
    messageText: string;
  }): Promise<{ success: boolean; error?: string }> {
    if (this.simulateFailureNextCount > 0) {
      this.simulateFailureNextCount--;
      const errorMsg = '503 Service Unavailable: Timeout simulado na API externa de mensageria';
      this.recordLog({
        channel: 'TELEGRAM',
        recipient: params.telegramChatId || 'desconhecido',
        recipientName: params.recipientName,
        message: params.messageText,
        appointmentId: params.appointmentId,
        reminderId: params.reminderId,
        success: false,
        providerMode: 'MOCK',
        error: errorMsg,
      });
      return { success: false, error: errorMsg };
    }

    const chatId = params.telegramChatId?.trim();
    if (!chatId) {
      const errorMsg = 'Usuário sem Telegram vinculado';
      this.recordLog({
        channel: 'TELEGRAM',
        recipient: 'desconhecido',
        recipientName: params.recipientName,
        message: params.messageText,
        appointmentId: params.appointmentId,
        reminderId: params.reminderId,
        success: false,
        providerMode: this.telegramService.getMode() === 'mock' ? 'MOCK' : 'LIVE_API',
        error: errorMsg,
      });
      return { success: false, error: errorMsg };
    }

    return this.sendViaTelegram(
      chatId,
      params.recipientName,
      params.messageText,
      params.appointmentId,
      params.reminderId,
    );
  }

  private async sendViaTelegram(
    chatId: string,
    recipientName: string,
    message: string,
    appointmentId: string,
    reminderId: string,
  ): Promise<{ success: boolean; error?: string }> {
    if (!chatId || !chatId.trim()) {
      const errorMsg = 'Usuário sem Telegram vinculado';
      this.recordLog({
        channel: 'TELEGRAM',
        recipient: 'desconhecido',
        recipientName,
        message,
        appointmentId,
        reminderId,
        success: false,
        providerMode: this.telegramService.getMode() === 'mock' ? 'MOCK' : 'LIVE_API',
        error: errorMsg,
      });
      return { success: false, error: errorMsg };
    }

    const isMock = this.telegramService.getMode() === 'mock';

    try {
      await this.telegramService.sendMessage(chatId, message);

      this.recordLog({
        channel: 'TELEGRAM',
        recipient: chatId,
        recipientName,
        message,
        appointmentId,
        reminderId,
        success: true,
        providerMode: isMock ? 'MOCK' : 'LIVE_API',
      });
      return { success: true };
    } catch (err: any) {
      const errorMsg = err?.message || 'Erro desconhecido ao comunicar com Telegram Bot API';
      this.logger.error(`Falha no envio Telegram para ${chatId}: ${errorMsg}`);
      this.recordLog({
        channel: 'TELEGRAM',
        recipient: chatId,
        recipientName,
        message,
        appointmentId,
        reminderId,
        success: false,
        providerMode: isMock ? 'MOCK' : 'LIVE_API',
        error: errorMsg,
      });
      return { success: false, error: errorMsg };
    }
  }

  private recordLog(entry: Omit<DispatchedMessageLog, 'id' | 'timestamp'>) {
    this.dispatchedMessages.push({
      ...entry,
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
    });
    if (this.dispatchedMessages.length > 200) {
      this.dispatchedMessages.shift();
    }
  }
}

