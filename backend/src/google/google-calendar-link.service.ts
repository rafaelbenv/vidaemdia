import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { GoogleAccountService } from './google-account.service';
import {
  GoogleCalendarClient,
  GoogleCalendarItem,
} from './google-calendar.client';
import { googleConfig } from './google.config';
import { GoogleSyncQueueService } from './google-sync-queue.service';

@Injectable()
export class GoogleCalendarLinkService {
  onLinked?: (calendarId: string) => Promise<void> | void;
  onUnlinked?: (calendarId: string) => Promise<void> | void;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly googleAccountService: GoogleAccountService,
    private readonly calendarClient: GoogleCalendarClient,
    @Optional() private readonly syncQueue?: GoogleSyncQueueService,
  ) {}

  async listCalendars(userId: string): Promise<GoogleCalendarItem[]> {
    const cfg = googleConfig();
    if (!cfg.configured) {
      throw new ServiceUnavailableException(
        'Integração com o Google Agenda não configurada',
      );
    }

    let token: string;
    try {
      token = await this.googleAccountService.getAccessToken(userId);
    } catch (err) {
      if (err instanceof NotFoundException) {
        throw new BadRequestException('Conecte sua conta Google primeiro.');
      }
      throw err;
    }

    return this.calendarClient.listWritableCalendars(token);
  }

  async link(userId: string, calendarId: string, googleCalendarId: string) {
    const cfg = googleConfig();
    if (!cfg.configured) {
      throw new ServiceUnavailableException(
        'Integração com o Google Agenda não configurada',
      );
    }

    const calendar = await this.prisma.calendar.findUnique({
      where: { id: calendarId },
    });

    if (!calendar) {
      throw new NotFoundException('Agenda não encontrada');
    }

    if (calendar.ownerId !== userId) {
      throw new ForbiddenException('Só o dono da agenda pode ligá-la ao Google.');
    }

    const googleCalendars = await this.listCalendars(userId);
    const googleCal = googleCalendars.find((c) => c.id === googleCalendarId);
    if (!googleCal) {
      throw new BadRequestException(
        'Agenda do Google não encontrada ou sem permissão de escrita.',
      );
    }

    const summary = googleCal.summary;

    const updateData = {
      googleCalendarId,
      googleCalendarName: summary,
      googleLinkedAt: new Date(),
      googleSyncToken: null,
      googleLastSyncAt: null,
      googleSyncError: null,
    };

    const updated = await this.prisma.calendar.update({
      where: { id: calendarId },
      data: updateData,
    });

    await this.auditService.log({
      actorUserId: userId,
      targetCalendarId: calendarId,
      entityType: 'AUTH',
      action: 'UPDATE',
      details: `Agenda ligada ao Google Agenda "${summary}"`,
      metadata: {
        googleCalendarId,
        googleCalendarName: summary,
      },
    });

    await this.afterLink(calendarId);

    return updated;
  }

  async unlink(userId: string, calendarId: string) {
    const cfg = googleConfig();
    if (!cfg.configured) {
      throw new ServiceUnavailableException(
        'Integração com o Google Agenda não configurada',
      );
    }

    const calendar = await this.prisma.calendar.findUnique({
      where: { id: calendarId },
    });

    if (!calendar) {
      throw new NotFoundException('Agenda não encontrada');
    }

    if (calendar.ownerId !== userId) {
      throw new ForbiddenException('Só o dono da agenda pode ligá-la ao Google.');
    }

    const updateData = {
      googleCalendarId: null,
      googleCalendarName: null,
      googleLinkedAt: null,
      googleSyncToken: null,
      googleLastSyncAt: null,
      googleSyncError: null,
    };

    const updated = await this.prisma.calendar.update({
      where: { id: calendarId },
      data: updateData,
    });

    await this.auditService.log({
      actorUserId: userId,
      targetCalendarId: calendarId,
      entityType: 'AUTH',
      action: 'UPDATE',
      details: 'Agenda desligada do Google Agenda',
    });

    await this.afterUnlink(calendarId);

    return updated;
  }

  protected async afterLink(calendarId: string): Promise<void> {
    if (this.syncQueue) {
      await this.syncQueue.enqueueCalendar(calendarId);
    }
    if (typeof this.onLinked === 'function') {
      await this.onLinked(calendarId);
    }
  }

  protected async afterUnlink(calendarId: string): Promise<void> {
    if (this.syncQueue) {
      await this.syncQueue.dropCalendar(calendarId);
    }
    if (typeof this.onUnlinked === 'function') {
      await this.onUnlinked(calendarId);
    }
  }
}
