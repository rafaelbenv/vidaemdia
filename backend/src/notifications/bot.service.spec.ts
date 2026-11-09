import { BotService } from './bot.service';
import { PrismaService } from '../prisma/prisma.service';
import { AppointmentsService } from '../appointments/appointments.service';
import { TelegramService } from '../telegram/telegram.service';
import { TelegramLinkService } from '../telegram/telegram-link.service';

describe('BotService', () => {
  let botService: BotService;
  let mockPrisma: any;
  let mockAppointmentsService: any;
  let mockTelegramService: any;
  let mockTelegramLinkService: any;

  beforeEach(() => {
    mockPrisma = {
      user: {
        findFirst: jest.fn(),
      },
      appointment: {
        findMany: jest.fn(),
      },
    };

    mockAppointmentsService = {
      create: jest.fn(),
    };

    mockTelegramService = {
      onUpdate: jest.fn(),
      sendMessage: jest.fn(),
    };

    mockTelegramLinkService = {
      consume: jest.fn(),
    };

    botService = new BotService(
      mockPrisma as unknown as PrismaService,
      mockAppointmentsService as unknown as AppointmentsService,
      mockTelegramService as unknown as TelegramService,
      mockTelegramLinkService as unknown as TelegramLinkService,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('parseNaturalLanguageAppointment', () => {
    it('deve extrair compromisso com "amanhã" e horário específico (Marcar Dentista amanhã às 15:30)', () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-11-08T10:00:00.000-03:00'));

      const result = botService.parseNaturalLanguageAppointment(
        'Marcar Dentista amanhã às 15:30',
      );

      expect(result.title).toBe('Dentista');
      expect(result.startTime.getFullYear()).toBe(2026);
      expect(result.startTime.getMonth()).toBe(10); // Novembro (mês 0-indexado)
      expect(result.startTime.getDate()).toBe(9);
      expect(result.startTime.getHours()).toBe(15);
      expect(result.startTime.getMinutes()).toBe(30);
    });

    it('deve extrair data exata e horário (Reunião 30/12/2026 às 09:00)', () => {
      const result = botService.parseNaturalLanguageAppointment(
        'Reunião 30/12/2026 às 09:00',
      );

      expect(result.title).toBe('Reunião');
      expect(result.startTime.getFullYear()).toBe(2026);
      expect(result.startTime.getMonth()).toBe(11); // Dezembro
      expect(result.startTime.getDate()).toBe(30);
      expect(result.startTime.getHours()).toBe(9);
      expect(result.startTime.getMinutes()).toBe(0);
    });

    it('deve assumir 09:00 caso o usuário não informe o horário', () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-11-08T10:00:00.000-03:00'));

      const result = botService.parseNaturalLanguageAppointment('Marcar Dentista amanhã');

      expect(result.title).toBe('Dentista');
      expect(result.startTime.getFullYear()).toBe(2026);
      expect(result.startTime.getMonth()).toBe(10);
      expect(result.startTime.getDate()).toBe(9);
      expect(result.startTime.getHours()).toBe(9);
      expect(result.startTime.getMinutes()).toBe(0);
    });

    const formatosTabela = [
      { input: 'Marcar dentista amanhã às 9', expectedHours: 9, expectedMinutes: 0 },
      { input: 'Marcar dentista amanhã as 9', expectedHours: 9, expectedMinutes: 0 },
      { input: 'Marcar dentista amanhã às 15', expectedHours: 15, expectedMinutes: 0 },
      { input: 'Marcar dentista amanhã 9h', expectedHours: 9, expectedMinutes: 0 },
      { input: 'Marcar dentista amanhã às 9h', expectedHours: 9, expectedMinutes: 0 },
      { input: 'Marcar dentista amanhã 15h', expectedHours: 15, expectedMinutes: 0 },
      { input: 'Marcar dentista amanhã 9h30', expectedHours: 9, expectedMinutes: 30 },
      { input: 'Marcar dentista amanhã 9:30', expectedHours: 9, expectedMinutes: 30 },
      { input: 'Marcar dentista amanhã às 09:30', expectedHours: 9, expectedMinutes: 30 },
      { input: 'Marcar dentista amanhã às 9 horas', expectedHours: 9, expectedMinutes: 0 },
      { input: 'Marcar dentista amanhã 9 hrs', expectedHours: 9, expectedMinutes: 0 },
    ];

    test.each(formatosTabela)(
      'deve reconhecer formato "$input" com título "dentista"',
      ({ input, expectedHours, expectedMinutes }) => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-11-08T10:00:00.000-03:00'));

        const result = botService.parseNaturalLanguageAppointment(input);

        expect(result.title).toBe('dentista');
        expect(result.startTime.getFullYear()).toBe(2026);
        expect(result.startTime.getMonth()).toBe(10);
        expect(result.startTime.getDate()).toBe(9);
        expect(result.startTime.getHours()).toBe(expectedHours);
        expect(result.startTime.getMinutes()).toBe(expectedMinutes);
      },
    );

    it('deve extrair compromisso com data específica e horário sem minutos (Criar Prova 30/11/2026 às 14)', () => {
      const result = botService.parseNaturalLanguageAppointment(
        'Criar Prova 30/11/2026 às 14',
      );

      expect(result.title).toBe('Prova');
      expect(result.startTime.getFullYear()).toBe(2026);
      expect(result.startTime.getMonth()).toBe(10);
      expect(result.startTime.getDate()).toBe(30);
      expect(result.startTime.getHours()).toBe(14);
      expect(result.startTime.getMinutes()).toBe(0);
    });

    it('deve retornar erro para horário inválido "às 25"', () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-11-08T10:00:00.000-03:00'));

      const result = botService.parseNaturalLanguageAppointment(
        'Marcar dentista amanhã às 25',
      );

      expect(result.error).toBe(
        'Horário inválido: "às 25". Use de 0 a 23 horas, por exemplo "às 15" ou "15:30".',
      );
    });

    it('deve retornar erro para horário inválido "25h"', () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-11-08T10:00:00.000-03:00'));

      const result = botService.parseNaturalLanguageAppointment(
        'Marcar dentista amanhã 25h',
      );

      expect(result.error).toBe(
        'Horário inválido: "25h". Use de 0 a 23 horas, por exemplo "às 15" ou "15:30".',
      );
    });

    it('deve retornar erro para horário inválido "10:75"', () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-11-08T10:00:00.000-03:00'));

      const result = botService.parseNaturalLanguageAppointment(
        'Marcar dentista amanhã 10:75',
      );

      expect(result.error).toBe(
        'Horário inválido: "10:75". Use de 0 a 23 horas, por exemplo "às 15" ou "15:30".',
      );
    });

    it('deve retornar erro para data inexistente "31/02"', () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-11-08T10:00:00.000-03:00'));

      const result = botService.parseNaturalLanguageAppointment(
        'Marcar prova 31/02',
      );

      expect(result.error).toBe(
        'Data inválida: "31/02". Use dia/mês existentes, por exemplo "30/11" ou "30/11/2026".',
      );
    });

    it('deve retornar erro para mês inválido "15/13/2026"', () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-11-08T10:00:00.000-03:00'));

      const result = botService.parseNaturalLanguageAppointment(
        'Marcar prova 15/13/2026',
      );

      expect(result.error).toBe(
        'Data inválida: "15/13/2026". Use dia/mês existentes, por exemplo "30/11" ou "30/11/2026".',
      );
    });

    it('deve retornar erro para data inválida em ano não bissexto "29/02/2027"', () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-11-08T10:00:00.000-03:00'));

      const result = botService.parseNaturalLanguageAppointment(
        'Marcar prova 29/02/2027',
      );

      expect(result.error).toBe(
        'Data inválida: "29/02/2027". Use dia/mês existentes, por exemplo "30/11" ou "30/11/2026".',
      );
    });

    it('deve aceitar data válida em ano bissexto "29/02/2028"', () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-11-08T10:00:00.000-03:00'));

      const result = botService.parseNaturalLanguageAppointment(
        'Marcar prova 29/02/2028',
      );

      expect(result.error).toBeUndefined();
      expect(result.startTime.getFullYear()).toBe(2028);
      expect(result.startTime.getMonth()).toBe(1);
      expect(result.startTime.getDate()).toBe(29);
      expect(result.startTime.getHours()).toBe(9);
      expect(result.startTime.getMinutes()).toBe(0);
    });
  });

  describe('handleMessage', () => {
    it('"oi" não deve criar compromisso e deve retornar ajuda para usuário vinculado', () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'user-1',
        name: 'Carlos Silva',
        role: 'USER',
        telegramChatId: '12345',
        ownedCalendars: [{ id: 'cal-1', name: 'Pessoal' }],
      });

      return botService
        .handleMessage({
          channel: 'TELEGRAM',
          chatId: '12345',
          text: 'oi',
        })
        .then((reply) => {
          expect(mockAppointmentsService.create).not.toHaveBeenCalled();
          expect(reply).toContain('Comandos do Assistente VidaEmDia');
        });
    });

    it('usuário não vinculado recebe pedido de vínculo ao enviar qualquer mensagem', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      const reply = await botService.handleMessage({
        channel: 'TELEGRAM',
        chatId: '99999',
        text: 'oi',
      });

      expect(mockAppointmentsService.create).not.toHaveBeenCalled();
      expect(reply).toContain('Conta não vinculada');
      expect(reply).toContain('acesse o sistema web');
    });

    it('usuário não vinculado recebe pedido de vínculo ao tentar agendar compromisso', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      const reply = await botService.handleMessage({
        channel: 'TELEGRAM',
        chatId: '99999',
        text: 'Marcar Dentista amanhã às 15:30',
      });

      expect(mockAppointmentsService.create).not.toHaveBeenCalled();
      expect(reply).toContain('Conta não vinculada');
    });

    it('deve vincular conta com sucesso quando usuário envia /start <código válido>', async () => {
      mockTelegramLinkService.consume.mockResolvedValue({
        ok: true,
        userName: 'Carlos Silva',
      });

      const reply = await botService.handleMessage({
        channel: 'TELEGRAM',
        chatId: '12345',
        text: '/start token_valido_123',
      });

      expect(mockTelegramLinkService.consume).toHaveBeenCalledWith(
        'token_valido_123',
        '12345',
      );
      expect(reply).toContain('Conta vinculada, Carlos Silva!');
    });

    it('deve exibir mensagem de erro quando usuário envia /start com código inválido', async () => {
      mockTelegramLinkService.consume.mockResolvedValue({
        ok: false,
        reason: 'Código de vinculação inexistente ou inválido.',
      });

      const reply = await botService.handleMessage({
        channel: 'TELEGRAM',
        chatId: '12345',
        text: '/start token_invalido',
      });

      expect(mockTelegramLinkService.consume).toHaveBeenCalledWith(
        'token_invalido',
        '12345',
      );
      expect(reply).toContain('Falha ao vincular conta');
      expect(reply).toContain('Código de vinculação inexistente ou inválido');
    });

    const invalidInputs = [
      {
        text: 'Marcar consulta amanhã às 25',
        expectedError: 'Horário inválido: "às 25". Use de 0 a 23 horas, por exemplo "às 15" ou "15:30".',
      },
      {
        text: 'Marcar consulta amanhã 25h',
        expectedError: 'Horário inválido: "25h". Use de 0 a 23 horas, por exemplo "às 15" ou "15:30".',
      },
      {
        text: 'Marcar consulta amanhã 10:75',
        expectedError: 'Horário inválido: "10:75". Use de 0 a 23 horas, por exemplo "às 15" ou "15:30".',
      },
      {
        text: 'Marcar prova 31/02',
        expectedError: 'Data inválida: "31/02". Use dia/mês existentes, por exemplo "30/11" ou "30/11/2026".',
      },
      {
        text: 'Marcar prova 15/13/2026',
        expectedError: 'Data inválida: "15/13/2026". Use dia/mês existentes, por exemplo "30/11" ou "30/11/2026".',
      },
      {
        text: 'Marcar prova 29/02/2027',
        expectedError: 'Data inválida: "29/02/2027". Use dia/mês existentes, por exemplo "30/11" ou "30/11/2026".',
      },
    ];

    test.each(invalidInputs)(
      'deve retornar erro e não chamar create para "$text"',
      async ({ text, expectedError }) => {
        mockPrisma.user.findFirst.mockResolvedValue({
          id: 'user-1',
          name: 'Carlos Silva',
          role: 'USER',
          telegramChatId: '12345',
          ownedCalendars: [{ id: 'cal-1', name: 'Pessoal' }],
        });

        const reply = await botService.handleMessage({
          channel: 'TELEGRAM',
          chatId: '12345',
          text,
        });

        expect(mockAppointmentsService.create).not.toHaveBeenCalled();
        expect(reply).toContain('⚠️ <b>Não consegui agendar.</b>');
        expect(reply).toContain(expectedError);
      },
    );

    it('deve chamar create com sucesso para data válida em ano bissexto "29/02/2028"', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-11-08T10:00:00.000-03:00'));

      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'user-1',
        name: 'Carlos Silva',
        role: 'USER',
        telegramChatId: '12345',
        ownedCalendars: [{ id: 'cal-1', name: 'Pessoal' }],
      });

      mockAppointmentsService.create.mockResolvedValue({
        id: 'apt-1',
        title: 'prova',
        startTime: new Date('2028-02-29T12:00:00.000Z'),
      });

      const reply = await botService.handleMessage({
        channel: 'TELEGRAM',
        chatId: '12345',
        text: 'Marcar prova 29/02/2028 às 14:00',
      });

      expect(mockAppointmentsService.create).toHaveBeenCalled();
      expect(reply).toContain('Compromisso agendado com sucesso');
    });
  });
});
