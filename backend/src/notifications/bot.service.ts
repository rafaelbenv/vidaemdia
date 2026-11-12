import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { NotificationChannel } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AppointmentsService } from '../appointments/appointments.service';
import { escapeHtml, TelegramService } from '../telegram/telegram.service';
import { TelegramLinkService } from '../telegram/telegram-link.service';
import { TelegramUpdate } from '../telegram/telegram.types';

export interface HandleBotMessageParams {
  channel: 'TELEGRAM';
  chatId: string;
  text?: string | null;
  ip?: string;
}

@Injectable()
export class BotService implements OnModuleInit {
  private readonly logger = new Logger(BotService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly appointmentsService: AppointmentsService,
    private readonly telegramService: TelegramService,
    private readonly telegramLinkService: TelegramLinkService,
  ) {}

  onModuleInit(): void {
    this.telegramService.onUpdate(async (update: TelegramUpdate) => {
      await this.processTelegramUpdate(update);
    });
  }

  async processTelegramUpdate(update: TelegramUpdate): Promise<void> {
    const message = update.message;
    if (!message || !message.chat) {
      return;
    }

    const chatId = message.chat.id;
    const text = message.text;

    try {
      const reply = await this.handleMessage({
        channel: 'TELEGRAM',
        chatId: String(chatId),
        text: text ?? '',
      });

      if (reply) {
        await this.telegramService.sendMessage(chatId, reply);
      }
    } catch (err: any) {
      this.logger.error(
        `Erro ao processar mensagem do Telegram para chat ${chatId}: ${err?.message || err}`,
      );
    }
  }

  async handleMessage({ channel, chatId, text, ip }: HandleBotMessageParams): Promise<string> {
    const rawText = (text || '').trim();

    // Mensagens sem text (foto, figurinha) -> responder com a ajuda
    if (!rawText) {
      return this.getHelpMessage();
    }

    // Comando /start
    const startMatch = rawText.match(/^\/start(?:\s+(.+))?$/i);
    if (startMatch) {
      const code = startMatch[1]?.trim();
      if (code) {
        const result = await this.telegramLinkService.consume(code, chatId);
        if (result.ok) {
          return (
            `✅ <b>Conta vinculada, ${escapeHtml(result.userName)}!</b>\n\n` +
            `Sua conta do Telegram agora está conectada ao <b>VidaEmDia</b>.\n` +
            `Você já pode consultar e agendar compromissos diretamente por aqui!\n\n` +
            `💡 <i>Digite <b>/ajuda</b> para ver os comandos disponíveis ou <b>/agenda</b> para ver seus próximos compromissos.</i>`
          );
        }

        return (
          `❌ <b>Falha ao vincular conta:</b>\n\n` +
          `${escapeHtml(result.reason)}\n\n` +
          `💡 <i>Acesse o sistema web para gerar um novo link de vinculação.</i>`
        );
      }

      return (
        `👋 <b>Olá! Bem-vindo ao assistente VidaEmDia!</b>\n\n` +
        `Eu sou seu assistente virtual para gestão de agenda e compromissos.\n\n` +
        `Para vincular sua conta do Telegram ao nosso sistema:\n` +
        `1. Acesse o sistema web <b>VidaEmDia</b>.\n` +
        `2. Conecte sua conta do Telegram nas configurações do seu perfil.\n` +
        `3. Após a confirmação, você poderá consultar e agendar compromissos diretamente por aqui!\n\n` +
        `💡 <i>Digite <b>/ajuda</b> a qualquer momento para ver os comandos disponíveis.</i>`
      );
    }

    // Comando /ajuda ou ajuda
    const lower = rawText.toLowerCase();
    if (lower === '/ajuda' || lower === 'ajuda' || lower === '/help' || lower === 'help') {
      return this.getHelpMessage();
    }

    // Busca do usuário somente pelo chat_id
    const user = await this.prisma.user.findFirst({
      where: { telegramChatId: chatId },
      include: {
        ownedCalendars: { orderBy: { createdAt: 'asc' } },
      },
    });

    // Usuário não vinculado
    if (!user) {
      return (
        `❌ <b>Conta não vinculada!</b>\n\n` +
        `Não encontrei nenhuma conta do VidaEmDia vinculada a este Telegram.\n` +
        `Por favor, acesse o sistema web <b>VidaEmDia</b> para vincular sua conta antes de utilizar o assistente.`
      );
    }

    if (!user.ownedCalendars || user.ownedCalendars.length === 0) {
      return (
        `⚠️ <b>Nenhuma agenda encontrada!</b>\n\n` +
        `Você ainda não possui nenhuma agenda criada no sistema web <b>VidaEmDia</b>. Crie uma agenda para começar a agendar compromissos.`
      );
    }

    const defaultCalendar = user.ownedCalendars[0];

    // Comando /agenda ou "agenda"
    if (
      lower === '/agenda' ||
      lower === 'agenda' ||
      lower.startsWith('/agenda ') ||
      lower === 'minha agenda' ||
      lower === 'meus compromissos'
    ) {
      const now = new Date();
      const upcoming = await this.prisma.appointment.findMany({
        where: {
          calendarId: defaultCalendar.id,
          status: 'SCHEDULED',
          startTime: { gte: now },
        },
        orderBy: { startTime: 'asc' },
        take: 5,
      });

      if (upcoming.length === 0) {
        return `📅 Olá, <b>${escapeHtml(user.name)}</b>! Você não possui compromissos pendentes a partir de agora na agenda <b>${escapeHtml(defaultCalendar.name)}</b>.`;
      }

      const timeZone = process.env.APP_TIMEZONE || 'America/Sao_Paulo';
      const listText = upcoming
        .map((a, idx) => {
          const dt = a.startTime.toLocaleDateString('pt-BR', { timeZone });
          const tm = a.startTime.toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone,
          });
          return `${idx + 1}. <b>${escapeHtml(a.title)}</b> — ${dt} às ${tm}`;
        })
        .join('\n');

      return (
        `📅 <b>Agenda VidaEmDia (${escapeHtml(defaultCalendar.name)})</b>:\n\n` +
        `${listText}\n\n` +
        `💡 <i>Para agendar pelo chat, envie por exemplo: "Marcar Reunião amanhã às 14:00"</i>`
      );
    }

    // Texto livre começando com marcar/agendar/criar -> cria compromisso
    if (/^(marcar|agendar|criar)\b/i.test(rawText)) {
      const parsed = this.parseNaturalLanguageAppointment(rawText);
      const now = new Date();

      if (parsed.error) {
        return `⚠️ <b>Não consegui agendar.</b>\n${escapeHtml(parsed.error)}`;
      }

      if (isNaN(parsed.startTime.getTime()) || parsed.startTime.getTime() <= now.getTime()) {
        return '⚠️ <b>Erro ao agendar:</b> A data e horário do compromisso não podem ser no passado.';
      }

      try {
        const created = await this.appointmentsService.create(
          user.id,
          user.role,
          {
            calendarId: defaultCalendar.id,
            title: parsed.title,
            description: `Criado via Chatbot (${channel}): "${rawText}"`,
            startTime: parsed.startTime.toISOString(),
            reminderMinutesBefore: 30,
            reminderChannel: NotificationChannel.TELEGRAM,
          },
          'TELEGRAM',
          ip,
        );

        const timeZone = process.env.APP_TIMEZONE || 'America/Sao_Paulo';
        const dtFormatted = parsed.startTime.toLocaleDateString('pt-BR', { timeZone });
        const tmFormatted = parsed.startTime.toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone,
        });

        return (
          `✅ <b>Compromisso agendado com sucesso pelo Bot VidaEmDia!</b>\n\n` +
          `📌 <b>Título:</b> ${escapeHtml(created.title)}\n` +
          `📆 <b>Data:</b> ${dtFormatted} às ${tmFormatted}\n` +
          `📂 <b>Agenda:</b> ${escapeHtml(defaultCalendar.name)}\n` +
          `🔔 <b>Lembrete:</b> Ativado via ${escapeHtml(channel)} (30 minutos antes)`
        );
      } catch (err: any) {
        if (
          err instanceof ConflictException ||
          err?.status === 409 ||
          (err instanceof BadRequestException && /conflito/i.test(err.message)) ||
          (err?.message && /conflito/i.test(err.message))
        ) {
          return '⚠️ <b>Conflito de horário</b>: Já existe um compromisso agendado para este período.';
        }
        if (err instanceof BadRequestException) {
          return `⚠️ <b>Erro ao agendar:</b> ${escapeHtml(err.message)}`;
        }
        this.logger.error(`Erro ao criar compromisso via bot: ${err?.message || err}`);
        return '⚠️ <b>Erro ao agendar:</b> Não foi possível criar o compromisso. Verifique os dados e tente novamente.';
      }
    }

    // Outro texto -> mensagem de ajuda (não criar compromisso por engano)
    return this.getHelpMessage();
  }

  getHelpMessage(): string {
    return (
      `🤖 <b>Comandos do Assistente VidaEmDia:</b>\n\n` +
      `📅 <b>/agenda</b> — Visualiza seus próximos 5 compromissos\n` +
      `❓ <b>/ajuda</b> — Exibe esta mensagem de ajuda\n\n` +
      `<b>Como agendar compromissos:</b>\n` +
      `Envie uma mensagem iniciando com <b>marcar</b>, <b>agendar</b> ou <b>criar</b>. Exemplos:\n` +
      `• <i>Marcar Consulta Médica amanhã às 15:30</i>\n` +
      `• <i>Agendar Reunião de Projeto hoje às 18:00</i>\n` +
      `• <i>Criar Dentista 30/11/2026 às 14:00</i>`
    );
  }

  parseNaturalLanguageAppointment(input: string): {
    title: string;
    startTime: Date;
    error?: string;
  } {
    const now = new Date();
    let hours = 9;
    let minutes = 0;
    let matchedTimeText: string | null = null;

    // Extração de horário por regex única com ordem de prioridade:
    // a) (\d{1,2})\s*[:h]\s*(\d{2}) (com minutos);
    // b) (?:^|\s)[aà]s\s+(\d{1,2})(?:\s*(?:h|hs|hrs?|horas?))?(?=\s|$|[.,!?]) (às + hora);
    // c) (?:^|\s)(\d{1,2})\s*(?:h|hs|hrs?|horas?)(?=\s|$|[.,!?]) (hora com sufixo).
    const timeMatch = input.match(
      /(?:^|\s)((?:[aàAÀ]s\s+)?(\d{1,2})\s*[:h]\s*(\d{2})|[aàAÀ]s\s+(\d{1,2})(?:\s*(?:h|hs|hrs?|horas?))?|(\d{1,2})\s*(?:h|hs|hrs?|horas?))(?=\s|$|[.,!?])/i,
    );

    if (timeMatch) {
      let h = 9;
      let m = 0;
      if (timeMatch[2] !== undefined) {
        h = parseInt(timeMatch[2], 10);
        m = parseInt(timeMatch[3], 10);
      } else if (timeMatch[4] !== undefined) {
        h = parseInt(timeMatch[4], 10);
        m = 0;
      } else if (timeMatch[5] !== undefined) {
        h = parseInt(timeMatch[5], 10);
        m = 0;
      }

      if (h > 23 || m > 59) {
        return {
          title: '',
          startTime: now,
          error: `Horário inválido: "${timeMatch[1].trim()}". Use de 0 a 23 horas, por exemplo "às 15" ou "15:30".`,
        };
      }

      hours = h;
      minutes = m;
      matchedTimeText = timeMatch[1];
    }

    let targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, hours, minutes, 0);

    // Extrai data DD/MM/YYYY ou DD/MM ou "hoje" / "amanhã"
    const dateMatch = input.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\b/);
    if (dateMatch) {
      const day = parseInt(dateMatch[1], 10);
      const month = parseInt(dateMatch[2], 10);
      const year = dateMatch[3] ? parseInt(dateMatch[3], 10) : now.getFullYear();

      const testDate = new Date(year, month - 1, day, hours, minutes, 0);
      if (
        month < 1 ||
        month > 12 ||
        day < 1 ||
        day > 31 ||
        testDate.getFullYear() !== year ||
        testDate.getMonth() !== month - 1 ||
        testDate.getDate() !== day
      ) {
        return {
          title: '',
          startTime: now,
          error: `Data inválida: "${dateMatch[0]}". Use dia/mês existentes, por exemplo "30/11" ou "30/11/2026".`,
        };
      }

      targetDate = testDate;
    } else if (/(^|\s)hoje(?=\s|$|[.,!?])/i.test(input)) {
      targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0);
    } else if (/(^|\s)amanh[aã](?=\s|$|[.,!?])/i.test(input)) {
      targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, hours, minutes, 0);
    } else {
      targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, hours, minutes, 0);
    }

    // Limpa palavras de comando para extrair o título
    let cleanTitle = input
      .replace(/^(marcar|agendar|criar|novo compromisso|lembrar de)\s+/i, '');

    if (matchedTimeText) {
      cleanTitle = cleanTitle.replace(matchedTimeText, ' ');
    }

    cleanTitle = cleanTitle
      .replace(/(^|\s)(hoje|amanh[aã])(?=\s|$|[.,!?])/gi, ' ')
      .replace(/\b\d{1,2}\/\d{1,2}(?:\/\d{4})?\b/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanTitle || cleanTitle.length < 2) {
      cleanTitle = 'Compromisso via Chatbot';
    }

    return { title: cleanTitle, startTime: targetDate };
  }
}
