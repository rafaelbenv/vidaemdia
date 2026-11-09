import { Injectable, Logger } from '@nestjs/common';
import { NotificationChannel } from '@prisma/client';
import { TelegramService } from '../telegram/telegram.service';

export interface DispatchedMessageLog {
  id: string;
  channel: 'WHATSAPP' | 'TELEGRAM';
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
   * Permite simular falhas temporárias da API do WhatsApp/Telegram para demonstrar e testar
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
    phoneWhatsapp?: string | null;
    telegramChatId?: string | null;
    messageText: string;
  }): Promise<{ success: boolean; error?: string }> {
    if (this.simulateFailureNextCount > 0) {
      this.simulateFailureNextCount--;
      const errorMsg = '503 Service Unavailable: Timeout simulado na API externa de mensageria';
      this.recordLog({
        channel: params.channel === 'TELEGRAM' ? 'TELEGRAM' : 'WHATSAPP',
        recipient: params.phoneWhatsapp || params.telegramChatId || 'desconhecido',
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

    const channelsToSend: Array<'WHATSAPP' | 'TELEGRAM'> =
      params.channel === NotificationChannel.BOTH
        ? (process.env.WHATSAPP_ENABLED === 'true' ? ['WHATSAPP', 'TELEGRAM'] : ['TELEGRAM'])
        : [params.channel];

    for (const ch of channelsToSend) {
      if (ch === 'WHATSAPP') {
        const res = await this.sendViaWhatsApp(
          params.phoneWhatsapp || '5511999990000',
          params.recipientName,
          params.messageText,
          params.appointmentId,
          params.reminderId,
        );
        if (!res.success) return res;
      } else if (ch === 'TELEGRAM') {
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

        const res = await this.sendViaTelegram(
          chatId,
          params.recipientName,
          params.messageText,
          params.appointmentId,
          params.reminderId,
        );
        if (!res.success) return res;
      }
    }

    return { success: true };
  }

  private async sendViaWhatsApp(
    phone: string,
    recipientName: string,
    message: string,
    appointmentId: string,
    reminderId: string,
  ): Promise<{ success: boolean; error?: string }> {
    if (process.env.WHATSAPP_ENABLED !== 'true') {
      return { success: false, error: 'Canal WhatsApp desabilitado' };
    }

    const isMock = process.env.WHATSAPP_MOCK_MODE !== 'false';

    if (isMock) {
      this.logger.log(`📲 [WhatsApp Business API - MOCK] Enviado para ${phone} (${recipientName}): ${message.replace(/\n/g, ' | ')}`);
      this.recordLog({
        channel: 'WHATSAPP',
        recipient: phone,
        recipientName,
        message,
        appointmentId,
        reminderId,
        success: true,
        providerMode: 'MOCK',
      });
      return { success: true };
    }

    try {
      const apiUrl = process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v20.0';
      const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
      const token = process.env.WHATSAPP_ACCESS_TOKEN;

      const response = await fetch(`${apiUrl}/${phoneId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: phone,
          type: 'text',
          text: { body: message },
        }),
      });

      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`WhatsApp API HTTP ${response.status}: ${errBody}`);
      }

      this.recordLog({
        channel: 'WHATSAPP',
        recipient: phone,
        recipientName,
        message,
        appointmentId,
        reminderId,
        success: true,
        providerMode: 'LIVE_API',
      });
      return { success: true };
    } catch (err: any) {
      const errorMsg = err?.message || 'Erro desconhecido ao comunicar com WhatsApp Business API';
      this.logger.error(`Falha no envio WhatsApp para ${phone}: ${errorMsg}`);
      this.recordLog({
        channel: 'WHATSAPP',
        recipient: phone,
        recipientName,
        message,
        appointmentId,
        reminderId,
        success: false,
        providerMode: 'LIVE_API',
        error: errorMsg,
      });
      return { success: false, error: errorMsg };
    }
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

