import { Injectable } from '@nestjs/common';

export class GoogleApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'GoogleApiError';
  }
}

export interface GoogleCalendarItem {
  id: string;
  summary: string;
  primary?: boolean;
  backgroundColor?: string;
}

@Injectable()
export class GoogleCalendarClient {
  private readonly baseUrl = 'https://www.googleapis.com/calendar/v3';

  async listWritableCalendars(token: string): Promise<GoogleCalendarItem[]> {
    const calendars: GoogleCalendarItem[] = [];
    let pageToken: string | undefined;

    do {
      const url = new URL(`${this.baseUrl}/users/me/calendarList`);
      url.searchParams.set('minAccessRole', 'writer');
      url.searchParams.set('showHidden', 'false');
      if (pageToken) {
        url.searchParams.set('pageToken', pageToken);
      }

      const res = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        await this.handleHttpError(res);
      }

      const data = (await res.json()) as any;
      if (Array.isArray(data.items)) {
        for (const item of data.items) {
          calendars.push({
            id: item.id,
            summary: item.summary ?? '',
            primary: Boolean(item.primary),
            backgroundColor: item.backgroundColor,
          });
        }
      }

      pageToken = data.nextPageToken;
    } while (pageToken);

    return calendars;
  }

  async listEvents(
    token: string,
    calendarId: string,
    opts: {
      syncToken?: string;
      timeMin?: string;
      timeMax?: string;
      pageToken?: string;
    } = {},
  ): Promise<{ items: any[]; nextPageToken?: string; nextSyncToken?: string }> {
    const url = new URL(
      `${this.baseUrl}/calendars/${encodeURIComponent(calendarId)}/events`,
    );
    url.searchParams.set('singleEvents', 'true');
    url.searchParams.set('maxResults', '250');

    if (opts.syncToken) {
      url.searchParams.set('syncToken', opts.syncToken);
    } else {
      if (opts.timeMin) {
        url.searchParams.set('timeMin', opts.timeMin);
      }
      if (opts.timeMax) {
        url.searchParams.set('timeMax', opts.timeMax);
      }
    }

    if (opts.pageToken) {
      url.searchParams.set('pageToken', opts.pageToken);
    }

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      await this.handleHttpError(res);
    }

    const data = (await res.json()) as any;
    return {
      items: Array.isArray(data?.items) ? data.items : [],
      nextPageToken: data?.nextPageToken,
      nextSyncToken: data?.nextSyncToken,
    };
  }

  async insertEvent(
    token: string,
    calendarId: string,
    body: any,
  ): Promise<any> {
    const url = `${this.baseUrl}/calendars/${encodeURIComponent(calendarId)}/events`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      await this.handleHttpError(res);
    }

    return res.json();
  }

  async patchEvent(
    token: string,
    calendarId: string,
    eventId: string,
    body: any,
  ): Promise<any> {
    const url = `${this.baseUrl}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`;
    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      await this.handleHttpError(res);
    }

    return res.json();
  }

  async deleteEvent(
    token: string,
    calendarId: string,
    eventId: string,
  ): Promise<void> {
    const url = `${this.baseUrl}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`;
    const res = await fetch(url, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      await this.handleHttpError(res);
    }
  }

  private async handleHttpError(res: Response): Promise<never> {
    let message = `Erro HTTP ${res.status}`;
    try {
      const data = await res.json();
      if (data?.error?.message) {
        message = data.error.message;
      } else if (typeof data?.error === 'string') {
        message = data.error_description || data.error;
      }
    } catch {
      try {
        const text = await res.text();
        if (text) message = text;
      } catch {
        // Ignora erro de leitura do corpo
      }
    }
    throw new GoogleApiError(res.status, message);
  }
}
