import { Injectable } from '@nestjs/common';

export interface GoogleSyncStats {
  queuePending: number;
  queueFailed: number;
  lastPullAt: Date | null;
}

@Injectable()
export class MetricsService {
  private readonly counters = {
    appointmentsCreatedWeb: 0,
    appointmentsCreatedTelegram: 0,
    remindersSentTelegram: 0,
    remindersFailed: 0,
    dailySummariesSent: 0,
    dailySummariesFailed: 0,
    rbacAccessDenied: 0,
    authFailures: 0,
    telegramUpdatesReceived: 0,
    telegramApiErrors: 0,
    googleEnvioOk: 0,
    googleEnvioErro: 0,
    googleRecebimentoOk: 0,
    googleRecebimentoErro: 0,
  };

  incrementAppointmentCreated(source: 'WEB' | 'TELEGRAM') {
    if (source === 'TELEGRAM') this.counters.appointmentsCreatedTelegram++;
    else this.counters.appointmentsCreatedWeb++;
  }

  incrementReminderSent(_channel?: string) {
    this.counters.remindersSentTelegram++;
  }

  incrementReminderFailed(_channel: string) {
    this.counters.remindersFailed++;
  }

  incrementDailySummarySent() {
    this.counters.dailySummariesSent++;
  }

  incrementDailySummaryFailed() {
    this.counters.dailySummariesFailed++;
  }

  incrementRbacDenied() {
    this.counters.rbacAccessDenied++;
  }

  incrementAuthFailure() {
    this.counters.authFailures++;
  }

  incrementTelegramUpdateReceived() {
    this.counters.telegramUpdatesReceived++;
  }

  incrementTelegramApiError() {
    this.counters.telegramApiErrors++;
  }

  incrementGoogleSync(
    direction: 'envio' | 'recebimento',
    result: 'ok' | 'erro',
  ) {
    if (direction === 'envio') {
      if (result === 'ok') this.counters.googleEnvioOk++;
      else this.counters.googleEnvioErro++;
    } else {
      if (result === 'ok') this.counters.googleRecebimentoOk++;
      else this.counters.googleRecebimentoErro++;
    }
  }

  getSummary() {
    return { ...this.counters, uptimeSeconds: Math.floor(process.uptime()) };
  }

  toPrometheusText(google?: GoogleSyncStats): string {
    const lines = [
      '# HELP vidaemdia_appointments_created_total Total de compromissos criados por canal',
      '# TYPE vidaemdia_appointments_created_total counter',
      `vidaemdia_appointments_created_total{source="WEB"} ${this.counters.appointmentsCreatedWeb}`,
      `vidaemdia_appointments_created_total{source="TELEGRAM"} ${this.counters.appointmentsCreatedTelegram}`,
      '',
      '# HELP vidaemdia_reminders_sent_total Total de lembretes enviados com sucesso pelo Worker',
      '# TYPE vidaemdia_reminders_sent_total counter',
      `vidaemdia_reminders_sent_total{channel="TELEGRAM"} ${this.counters.remindersSentTelegram}`,
      '',
      '# HELP vidaemdia_reminders_failed_total Total de falhas/retries no envio de lembretes',
      '# TYPE vidaemdia_reminders_failed_total counter',
      `vidaemdia_reminders_failed_total ${this.counters.remindersFailed}`,
      '',
      '# HELP vidaemdia_daily_summaries_sent_total Total de resumos diários enviados pelo Telegram',
      '# TYPE vidaemdia_daily_summaries_sent_total counter',
      `vidaemdia_daily_summaries_sent_total ${this.counters.dailySummariesSent}`,
      '',
      '# HELP vidaemdia_daily_summaries_failed_total Total de falhas ao enviar o resumo diário',
      '# TYPE vidaemdia_daily_summaries_failed_total counter',
      `vidaemdia_daily_summaries_failed_total ${this.counters.dailySummariesFailed}`,
      '',
      '# HELP vidaemdia_telegram_updates_received_total Total de updates recebidos da Telegram Bot API',
      '# TYPE vidaemdia_telegram_updates_received_total counter',
      `vidaemdia_telegram_updates_received_total ${this.counters.telegramUpdatesReceived}`,
      '',
      '# HELP vidaemdia_telegram_api_errors_total Total de erros na API do Telegram',
      '# TYPE vidaemdia_telegram_api_errors_total counter',
      `vidaemdia_telegram_api_errors_total ${this.counters.telegramApiErrors}`,
      '',
      '# HELP vidaemdia_rbac_access_denied_total Total de bloqueios 403 RBAC (tentativa de acesso não autorizado)',
      '# TYPE vidaemdia_rbac_access_denied_total counter',
      `vidaemdia_rbac_access_denied_total ${this.counters.rbacAccessDenied}`,
      '',
      '# HELP vidaemdia_auth_failures_total Total de falhas de autenticação JWT/Login',
      '# TYPE vidaemdia_auth_failures_total counter',
      `vidaemdia_auth_failures_total ${this.counters.authFailures}`,
      '',
      '# HELP vidaemdia_google_sync_total Total de sincronizações com o Google Agenda por sentido e resultado',
      '# TYPE vidaemdia_google_sync_total counter',
      `vidaemdia_google_sync_total{direction="envio",result="ok"} ${this.counters.googleEnvioOk}`,
      `vidaemdia_google_sync_total{direction="envio",result="erro"} ${this.counters.googleEnvioErro}`,
      `vidaemdia_google_sync_total{direction="recebimento",result="ok"} ${this.counters.googleRecebimentoOk}`,
      `vidaemdia_google_sync_total{direction="recebimento",result="erro"} ${this.counters.googleRecebimentoErro}`,
      '',
    ];

    if (google) {
      const lastPullTimestamp = google.lastPullAt
        ? Math.floor(google.lastPullAt.getTime() / 1000)
        : 0;
      lines.push(
        '# HELP vidaemdia_google_sync_queue Jobs na fila de envio para o Google, por status',
        '# TYPE vidaemdia_google_sync_queue gauge',
        `vidaemdia_google_sync_queue{status="PENDING"} ${google.queuePending}`,
        `vidaemdia_google_sync_queue{status="FAILED"} ${google.queueFailed}`,
        '',
        '# HELP vidaemdia_google_last_pull_timestamp_seconds Hora (Unix, segundos) da última sincronização recebida do Google',
        '# TYPE vidaemdia_google_last_pull_timestamp_seconds gauge',
        `vidaemdia_google_last_pull_timestamp_seconds ${lastPullTimestamp}`,
        '',
      );
    }

    lines.push(
      '# HELP vidaemdia_uptime_seconds Tempo de atividade do servidor backend em segundos',
      '# TYPE vidaemdia_uptime_seconds gauge',
      `vidaemdia_uptime_seconds ${Math.floor(process.uptime())}`,
      '',
    );

    return lines.join('\n');
  }
}
