import { GoogleCalendarClient, GoogleApiError } from './google-calendar.client';

describe('GoogleCalendarClient', () => {
  let client: GoogleCalendarClient;
  const originalEnv = { ...process.env };
  const validHexKey =
    '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      GOOGLE_CLIENT_ID: 'client-id-test',
      GOOGLE_CLIENT_SECRET: 'client-secret-test',
      GOOGLE_TOKEN_ENC_KEY: validHexKey,
      GOOGLE_REDIRECT_URI: 'http://localhost:8080/api/google/callback',
    };
    client = new GoogleCalendarClient();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  describe('listWritableCalendars', () => {
    it('manda Authorization: Bearer <token> e minAccessRole=writer; percorre duas páginas e junta os itens; primary ausente vira false; summary ausente vira string vazia', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(((url: string, init?: RequestInit) => {
        if (url.includes('pageToken=page-2')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              items: [
                {
                  id: 'cal-2',
                  summary: 'Agenda Secundária',
                  primary: true,
                  backgroundColor: '#ffffff',
                },
              ],
              nextPageToken: undefined,
            }),
            text: async () => '',
          } as any);
        }

        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            items: [
              {
                id: 'cal-1',
                // summary ausente
                // primary ausente
              },
            ],
            nextPageToken: 'page-2',
          }),
          text: async () => '',
        } as any);
      }) as any);

      const result = await client.listWritableCalendars('test-token-123');

      expect(fetchSpy).toHaveBeenCalledTimes(2);

      const firstCallUrl = new URL(fetchSpy.mock.calls[0][0] as string);
      expect(firstCallUrl.searchParams.get('minAccessRole')).toBe('writer');
      expect(firstCallUrl.searchParams.get('showHidden')).toBe('false');
      expect(fetchSpy.mock.calls[0][1]?.headers).toEqual({
        Authorization: 'Bearer test-token-123',
      });

      const secondCallUrl = new URL(fetchSpy.mock.calls[1][0] as string);
      expect(secondCallUrl.searchParams.get('pageToken')).toBe('page-2');

      expect(result).toEqual([
        {
          id: 'cal-1',
          summary: '',
          primary: false,
          backgroundColor: undefined,
        },
        {
          id: 'cal-2',
          summary: 'Agenda Secundária',
          primary: true,
          backgroundColor: '#ffffff',
        },
      ]);
    });
  });

  describe('listEvents', () => {
    it('com syncToken não manda timeMin/timeMax; sem syncToken manda os dois; sempre manda singleEvents=true; repassa pageToken; devolve nextSyncToken; items ausente vira []; calendarId vai codificado na URL', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(((url: string) => {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            // items ausente
            nextSyncToken: 'next-sync-token-xyz',
          }),
          text: async () => '',
        } as any);
      }) as any);

      // 1. Chamada com syncToken
      const resWithSync = await client.listEvents('token-abc', 'user@example.com', {
        syncToken: 'sync-token-123',
        pageToken: 'page-token-1',
        timeMin: '2026-01-01T00:00:00Z',
        timeMax: '2026-02-01T00:00:00Z',
      });

      expect(resWithSync).toEqual({
        items: [],
        nextPageToken: undefined,
        nextSyncToken: 'next-sync-token-xyz',
      });

      const url1 = fetchSpy.mock.calls[0][0] as string;
      expect(url1).toContain('/calendars/user%40example.com/events');
      const parsedUrl1 = new URL(url1);
      expect(parsedUrl1.searchParams.get('singleEvents')).toBe('true');
      expect(parsedUrl1.searchParams.get('syncToken')).toBe('sync-token-123');
      expect(parsedUrl1.searchParams.get('pageToken')).toBe('page-token-1');
      expect(parsedUrl1.searchParams.has('timeMin')).toBe(false);
      expect(parsedUrl1.searchParams.has('timeMax')).toBe(false);

      // 2. Chamada sem syncToken
      fetchSpy.mockClear();
      await client.listEvents('token-abc', 'cal-simple', {
        timeMin: '2026-11-01T00:00:00Z',
        timeMax: '2026-11-30T23:59:59Z',
      });

      const url2 = fetchSpy.mock.calls[0][0] as string;
      const parsedUrl2 = new URL(url2);
      expect(parsedUrl2.searchParams.get('singleEvents')).toBe('true');
      expect(parsedUrl2.searchParams.has('syncToken')).toBe(false);
      expect(parsedUrl2.searchParams.get('timeMin')).toBe('2026-11-01T00:00:00Z');
      expect(parsedUrl2.searchParams.get('timeMax')).toBe('2026-11-30T23:59:59Z');
    });

    it('erro 410 em listEvents lança GoogleApiError com status 410 e a mensagem de error.message do corpo', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 410,
        json: async () => ({
          error: {
            message: 'Sync token is no longer valid, a full sync is required.',
          },
        }),
        text: async () => '',
      } as any);

      const err: any = await client
        .listEvents('token-abc', 'cal-1', { syncToken: 'old-token' })
        .catch((e) => e);

      expect(err).toBeInstanceOf(GoogleApiError);
      expect(err.status).toBe(410);
      expect(err.message).toBe(
        'Sync token is no longer valid, a full sync is required.',
      );
    });
  });

  describe('insertEvent, patchEvent e deleteEvent', () => {
    it('insertEvent usa POST com Content-Type: application/json e corpo em JSON', async () => {
      const payload = { summary: 'Consulta Médica', start: { date: '2026-11-20' } };
      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 'new-event-id', summary: 'Consulta Médica' }),
        text: async () => '',
      } as any);

      const result = await client.insertEvent('token-xyz', 'my-cal@group.calendar.google.com', payload);

      expect(result).toEqual({ id: 'new-event-id', summary: 'Consulta Médica' });
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://www.googleapis.com/calendar/v3/calendars/my-cal%40group.calendar.google.com/events',
        {
          method: 'POST',
          headers: {
            Authorization: 'Bearer token-xyz',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        },
      );
    });

    it('patchEvent usa PATCH na URL com o eventId', async () => {
      const payload = { summary: 'Consulta Atualizada' };
      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 'ev-123', summary: 'Consulta Atualizada' }),
        text: async () => '',
      } as any);

      const result = await client.patchEvent('token-xyz', 'cal-1', 'ev-123', payload);

      expect(result).toEqual({ id: 'ev-123', summary: 'Consulta Atualizada' });
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://www.googleapis.com/calendar/v3/calendars/cal-1/events/ev-123',
        {
          method: 'PATCH',
          headers: {
            Authorization: 'Bearer token-xyz',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        },
      );
    });

    it('deleteEvent usa DELETE', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 204,
        json: async () => ({}),
        text: async () => '',
      } as any);

      await client.deleteEvent('token-xyz', 'cal-1', 'ev-delete-id');

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://www.googleapis.com/calendar/v3/calendars/cal-1/events/ev-delete-id',
        {
          method: 'DELETE',
          headers: {
            Authorization: 'Bearer token-xyz',
          },
        },
      );
    });
  });

  describe('corpo de erro que não é JSON', () => {
    it('json rejeita e text devolve um texto → a mensagem do erro é esse texto', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 502,
        json: async () => {
          throw new Error('Unexpected token < in JSON');
        },
        text: async () => '502 Bad Gateway: Upstream server is unavailable',
      } as any);

      try {
        await client.listEvents('tok', 'cal-1');
        fail('Deveria ter lançado GoogleApiError');
      } catch (err: any) {
        expect(err).toBeInstanceOf(GoogleApiError);
        expect(err.status).toBe(502);
        expect(err.message).toBe('502 Bad Gateway: Upstream server is unavailable');
      }
    });
  });
});
