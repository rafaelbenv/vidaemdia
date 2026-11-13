import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { GoogleAccountService } from './google-account.service';
import { GoogleCalendarClient } from './google-calendar.client';
import { GoogleCalendarLinkService } from './google-calendar-link.service';

describe('GoogleCalendarLinkService', () => {
  let service: GoogleCalendarLinkService;
  let mockPrisma: any;
  let mockAuditService: any;
  let mockGoogleAccountService: any;
  let mockCalendarClient: any;

  const originalEnv = { ...process.env };
  const validHexKey =
    '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      GOOGLE_CLIENT_ID: 'google-client-id-test',
      GOOGLE_CLIENT_SECRET: 'google-client-secret-test',
      GOOGLE_TOKEN_ENC_KEY: validHexKey,
      GOOGLE_REDIRECT_URI: 'http://localhost:8080/api/google/callback',
      FRONTEND_URL: 'http://localhost:8080',
    };

    mockPrisma = {
      calendar: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    mockAuditService = {
      log: jest.fn().mockResolvedValue({ id: 'audit-1' }),
    };

    mockGoogleAccountService = {
      getAccessToken: jest.fn(),
    };

    mockCalendarClient = {
      listWritableCalendars: jest.fn(),
      insertEvent: jest.fn(),
      patchEvent: jest.fn(),
      deleteEvent: jest.fn(),
    };

    service = new GoogleCalendarLinkService(
      mockPrisma as unknown as PrismaService,
      mockAuditService as unknown as AuditService,
      mockGoogleAccountService as unknown as GoogleAccountService,
      mockCalendarClient as unknown as GoogleCalendarClient,
    );
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('listCalendars', () => {
    it('com conta conectada retorna a lista de agendas com escrita', async () => {
      mockGoogleAccountService.getAccessToken.mockResolvedValue('token-abc');
      mockCalendarClient.listWritableCalendars.mockResolvedValue([
        {
          id: 'primary-id',
          summary: 'Agenda Principal',
          primary: true,
          backgroundColor: '#ffffff',
        },
      ]);

      const result = await service.listCalendars('user-1');

      expect(mockGoogleAccountService.getAccessToken).toHaveBeenCalledWith('user-1');
      expect(mockCalendarClient.listWritableCalendars).toHaveBeenCalledWith('token-abc');
      expect(result).toHaveLength(1);
      expect(result[0].summary).toBe('Agenda Principal');
    });

    it('sem conta conectada (getAccessToken lança NotFoundException) lança BadRequestException', async () => {
      mockGoogleAccountService.getAccessToken.mockRejectedValue(
        new NotFoundException('Conta do Google não vinculada'),
      );

      await expect(service.listCalendars('user-1')).rejects.toThrow(
        new BadRequestException('Conecte sua conta Google primeiro.'),
      );
    });

    it('com integração desativada lança ServiceUnavailableException', async () => {
      delete process.env.GOOGLE_CLIENT_ID;

      await expect(service.listCalendars('user-1')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });

  describe('link', () => {
    const calendarFixture = {
      id: 'cal-vida-1',
      ownerId: 'user-1',
      name: 'Consultório',
      googleCalendarId: null,
      googleCalendarName: null,
      googleLinkedAt: null,
    };

    const googleCalendarsFixture = [
      {
        id: 'g-cal-1',
        summary: 'Trabalho Google',
        primary: false,
        backgroundColor: '#123456',
      },
    ];

    it('ligar como dono com agenda válida grava os campos, audita e chama ponto de extensão', async () => {
      mockPrisma.calendar.findUnique.mockResolvedValue(calendarFixture);
      mockGoogleAccountService.getAccessToken.mockResolvedValue('token-abc');
      mockCalendarClient.listWritableCalendars.mockResolvedValue(googleCalendarsFixture);

      const updatedCalendar = {
        ...calendarFixture,
        googleCalendarId: 'g-cal-1',
        googleCalendarName: 'Trabalho Google',
        googleLinkedAt: new Date(),
      };
      mockPrisma.calendar.update.mockResolvedValue(updatedCalendar);

      const onLinkedMock = jest.fn();
      service.onLinked = onLinkedMock;

      const result = await service.link('user-1', 'cal-vida-1', 'g-cal-1');

      expect(result).toEqual(updatedCalendar);
      expect(mockPrisma.calendar.update).toHaveBeenCalledWith({
        where: { id: 'cal-vida-1' },
        data: {
          googleCalendarId: 'g-cal-1',
          googleCalendarName: 'Trabalho Google',
          googleLinkedAt: expect.any(Date),
        },
      });

      expect(mockAuditService.log).toHaveBeenCalledWith({
        actorUserId: 'user-1',
        targetCalendarId: 'cal-vida-1',
        entityType: 'AUTH',
        action: 'UPDATE',
        details: 'Agenda ligada ao Google Agenda "Trabalho Google"',
        metadata: {
          googleCalendarId: 'g-cal-1',
          googleCalendarName: 'Trabalho Google',
        },
      });

      expect(onLinkedMock).toHaveBeenCalledWith('cal-vida-1');
    });

    it('quem não é dono recebe 403 (ForbiddenException)', async () => {
      mockPrisma.calendar.findUnique.mockResolvedValue({
        ...calendarFixture,
        ownerId: 'outro-dono',
      });

      await expect(
        service.link('user-1', 'cal-vida-1', 'g-cal-1'),
      ).rejects.toThrow(ForbiddenException);

      expect(mockPrisma.calendar.update).not.toHaveBeenCalled();
      expect(mockAuditService.log).not.toHaveBeenCalled();
    });

    it('agenda inexistente lança 404 (NotFoundException)', async () => {
      mockPrisma.calendar.findUnique.mockResolvedValue(null);

      await expect(
        service.link('user-1', 'cal-inexistente', 'g-cal-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('agenda do Google fora da lista de agendas com permissão lança 400 (BadRequestException)', async () => {
      mockPrisma.calendar.findUnique.mockResolvedValue(calendarFixture);
      mockGoogleAccountService.getAccessToken.mockResolvedValue('token-abc');
      mockCalendarClient.listWritableCalendars.mockResolvedValue(googleCalendarsFixture);

      await expect(
        service.link('user-1', 'cal-vida-1', 'g-cal-inexistente-no-google'),
      ).rejects.toThrow(
        new BadRequestException(
          'Agenda do Google não encontrada ou sem permissão de escrita.',
        ),
      );

      expect(mockPrisma.calendar.update).not.toHaveBeenCalled();
    });

    it('sem conta conectada ao tentar ligar lança 400 (BadRequestException)', async () => {
      mockPrisma.calendar.findUnique.mockResolvedValue(calendarFixture);
      mockGoogleAccountService.getAccessToken.mockRejectedValue(
        new NotFoundException('Conta do Google não vinculada'),
      );

      await expect(
        service.link('user-1', 'cal-vida-1', 'g-cal-1'),
      ).rejects.toThrow(
        new BadRequestException('Conecte sua conta Google primeiro.'),
      );
    });

    it('com integração desativada lança ServiceUnavailableException', async () => {
      delete process.env.GOOGLE_CLIENT_ID;

      await expect(
        service.link('user-1', 'cal-vida-1', 'g-cal-1'),
      ).rejects.toThrow(ServiceUnavailableException);
    });
  });

  describe('unlink', () => {
    const linkedCalendarFixture = {
      id: 'cal-vida-1',
      ownerId: 'user-1',
      name: 'Consultório',
      googleCalendarId: 'g-cal-1',
      googleCalendarName: 'Trabalho Google',
      googleLinkedAt: new Date(),
    };

    it('desligar zera os campos, audita e chama ponto de extensão', async () => {
      mockPrisma.calendar.findUnique.mockResolvedValue(linkedCalendarFixture);

      const unlinkedCalendar = {
        ...linkedCalendarFixture,
        googleCalendarId: null,
        googleCalendarName: null,
        googleLinkedAt: null,
      };
      mockPrisma.calendar.update.mockResolvedValue(unlinkedCalendar);

      const onUnlinkedMock = jest.fn();
      service.onUnlinked = onUnlinkedMock;

      const result = await service.unlink('user-1', 'cal-vida-1');

      expect(result).toEqual(unlinkedCalendar);
      expect(mockPrisma.calendar.update).toHaveBeenCalledWith({
        where: { id: 'cal-vida-1' },
        data: {
          googleCalendarId: null,
          googleCalendarName: null,
          googleLinkedAt: null,
        },
      });

      expect(mockAuditService.log).toHaveBeenCalledWith({
        actorUserId: 'user-1',
        targetCalendarId: 'cal-vida-1',
        entityType: 'AUTH',
        action: 'UPDATE',
        details: 'Agenda desligada do Google Agenda',
      });

      expect(onUnlinkedMock).toHaveBeenCalledWith('cal-vida-1');
    });

    it('quem não é dono recebe 403 (ForbiddenException)', async () => {
      mockPrisma.calendar.findUnique.mockResolvedValue({
        ...linkedCalendarFixture,
        ownerId: 'outro-dono',
      });

      await expect(service.unlink('user-1', 'cal-vida-1')).rejects.toThrow(
        ForbiddenException,
      );

      expect(mockPrisma.calendar.update).not.toHaveBeenCalled();
      expect(mockAuditService.log).not.toHaveBeenCalled();
    });

    it('agenda inexistente lança 404 (NotFoundException)', async () => {
      mockPrisma.calendar.findUnique.mockResolvedValue(null);

      await expect(service.unlink('user-1', 'cal-inexistente')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('com integração desativada lança ServiceUnavailableException', async () => {
      delete process.env.GOOGLE_CLIENT_ID;

      await expect(service.unlink('user-1', 'cal-vida-1')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });
});
