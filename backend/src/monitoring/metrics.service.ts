import { Injectable } from '@nestjs/common';

@Injectable()
export class MetricsService {
  private readonly counters = {
    appointmentsCreatedWeb: 0,
    appointmentsCreatedTelegram: 0,
    remindersSentTelegram: 0,
    remindersFailed: 0,
    rbacAccessDenied: 0,
    authFailures: 0,
    telegramUpdatesReceived: 0,
    telegramApiErrors: 0,
    googleSyncOk: 0,
    googleSyncErro: 0,
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

  incrementGoogleSync(result: 'ok' | 'erro') {
    if (result === 'ok') {
      this.counters.googleSyncOk++;
    } else {
      this.counters.googleSyncErro++;
    }
  }

  getSummary() {
    return { ...this.counters, uptimeSeconds: Math.floor(process.uptime()) };
  }

  toPrometheusText(): string {
    return [
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
      '# HELP vidaemdia_google_sync_total Total de sincronizações de eventos com o Google Agenda',
      '# TYPE vidaemdia_google_sync_total counter',
      `vidaemdia_google_sync_total{result="ok"} ${this.counters.googleSyncOk}`,
      `vidaemdia_google_sync_total{result="erro"} ${this.counters.googleSyncErro}`,
      '',
      '# HELP vidaemdia_uptime_seconds Tempo de atividade do servidor backend em segundos',
      '# TYPE vidaemdia_uptime_seconds gauge',
      `vidaemdia_uptime_seconds ${Math.floor(process.uptime())}`,
      '',
    ].join('\n');
  }
}

