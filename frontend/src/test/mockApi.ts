import { vi } from 'vitest';
import { Appointment, Calendar, Reminder, User } from '../types';

export interface ApiCall {
  method: string;
  path: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any;
}

export const USER_CARLOS: User = {
  id: 'user-carlos',
  name: 'Carlos Silva (Usuário)',
  email: 'carlos@vidaemdia.com.br',
  role: 'USER',
  phoneWhatsapp: '5511999991111',
  telegramChatId: '123456789',
  telegramLinked: true,
  preferredChannel: 'TELEGRAM',
};

export const USER_DR_JOAO: User = {
  id: 'user-dr-joao',
  name: 'Dr. João Mendes (Cardiologista)',
  email: 'dr.joao@vidaemdia.com.br',
  role: 'PROFESSIONAL',
  phoneWhatsapp: '5511999992222',
  telegramChatId: undefined,
  telegramLinked: false,
  preferredChannel: 'TELEGRAM',
};

export const USER_MARIA: User = {
  id: 'user-maria',
  name: 'Maria Oliveira (Secretária)',
  email: 'secretaria.maria@vidaemdia.com.br',
  role: 'SECRETARY',
  phoneWhatsapp: '5511999994444',
  telegramChatId: undefined,
  telegramLinked: false,
  preferredChannel: 'TELEGRAM',
};

export const CALENDAR_CARLOS_PESSOAL: Calendar = {
  id: 'cal-carlos-pessoal',
  ownerId: USER_CARLOS.id,
  type: 'PERSONAL',
  name: 'Agenda Pessoal - Carlos',
  description: 'Compromissos pessoais',
  color: '#2563EB',
  owner: USER_CARLOS,
  permissions: [],
  _count: { appointments: 0 },
};

export const CALENDAR_DR_JOAO_PROF: Calendar = {
  id: 'cal-dr-joao-prof',
  ownerId: USER_DR_JOAO.id,
  type: 'PROFESSIONAL',
  name: 'Consultório Dr. João Mendes',
  description: 'Agenda médica de consultas e retornos',
  color: '#16A34A',
  owner: USER_DR_JOAO,
  permissions: [
    {
      id: 'perm-maria',
      granteeUser: USER_MARIA,
      canView: true,
      canCreate: true,
      canUpdate: true,
      canCancel: true,
    },
  ],
  _count: { appointments: 3 },
};

export const CALENDAR_DR_JOAO_PESSOAL: Calendar = {
  id: 'cal-dr-joao-pessoal',
  ownerId: USER_DR_JOAO.id,
  type: 'PERSONAL',
  name: 'Agenda Pessoal - Dr. João',
  description: 'Compromissos particulares',
  color: '#4F46E5',
  owner: USER_DR_JOAO,
  permissions: [],
  _count: { appointments: 0 },
};

function createInitialAppointments(): Appointment[] {
  return [
    {
      id: 'appt-1',
      calendarId: CALENDAR_DR_JOAO_PROF.id,
      createdById: USER_DR_JOAO.id,
      title: 'Consulta inicial',
      description: 'Primeira consulta cardiológica',
      startTime: '2026-11-10T08:00:00.000-03:00',
      endTime: '2026-11-10T09:00:00.000-03:00',
      reminderMinutesBefore: 30,
      status: 'SCHEDULED',
      createdVia: 'WEB',
      createdBy: USER_DR_JOAO,
      calendar: {
        id: CALENDAR_DR_JOAO_PROF.id,
        name: CALENDAR_DR_JOAO_PROF.name,
        ownerId: USER_DR_JOAO.id,
        owner: {
          id: USER_DR_JOAO.id,
          name: USER_DR_JOAO.name,
          telegramChatId: USER_DR_JOAO.telegramChatId,
        },
      },
      reminders: [
        {
          id: 'rem-1',
          appointmentId: 'appt-1',
          remindAt: '2026-11-10T07:30:00.000-03:00',
          channel: 'TELEGRAM',
          status: 'PENDING',
          retryCount: 0,
        },
      ],
    },
    {
      id: 'appt-2',
      calendarId: CALENDAR_DR_JOAO_PROF.id,
      createdById: USER_DR_JOAO.id,
      title: 'Retorno cardiológico',
      description: 'Avaliação de exames',
      startTime: '2026-11-10T10:30:00.000-03:00',
      endTime: '2026-11-10T11:30:00.000-03:00',
      reminderMinutesBefore: 30,
      status: 'SCHEDULED',
      createdVia: 'WEB',
      createdBy: USER_DR_JOAO,
      calendar: {
        id: CALENDAR_DR_JOAO_PROF.id,
        name: CALENDAR_DR_JOAO_PROF.name,
        ownerId: USER_DR_JOAO.id,
        owner: {
          id: USER_DR_JOAO.id,
          name: USER_DR_JOAO.name,
          telegramChatId: USER_DR_JOAO.telegramChatId,
        },
      },
      reminders: [
        {
          id: 'rem-2',
          appointmentId: 'appt-2',
          remindAt: '2026-11-10T10:00:00.000-03:00',
          channel: 'TELEGRAM',
          status: 'PENDING',
          retryCount: 0,
        },
      ],
    },
    {
      id: 'appt-3',
      calendarId: CALENDAR_DR_JOAO_PROF.id,
      createdById: USER_DR_JOAO.id,
      title: 'Exame cancelado',
      description: 'Eletrocardiograma',
      startTime: '2026-11-10T14:00:00.000-03:00',
      endTime: '2026-11-10T15:00:00.000-03:00',
      reminderMinutesBefore: 30,
      status: 'CANCELLED',
      createdVia: 'WEB',
      createdBy: USER_DR_JOAO,
      calendar: {
        id: CALENDAR_DR_JOAO_PROF.id,
        name: CALENDAR_DR_JOAO_PROF.name,
        ownerId: USER_DR_JOAO.id,
        owner: {
          id: USER_DR_JOAO.id,
          name: USER_DR_JOAO.name,
          telegramChatId: USER_DR_JOAO.telegramChatId,
        },
      },
      reminders: [],
    },
  ];
}

let recordedCalls: ApiCall[] = [];
let currentUsers: User[] = [];
let currentCalendars: Calendar[] = [];
let currentAppointments: Appointment[] = [];
let nextId = 100;

export function calls(): ApiCall[] {
  return [...recordedCalls];
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function resolveUserFromToken(token: string | null): User | null {
  if (!token) return null;
  const clean = token.replace(/^Bearer\s+/i, '').trim();
  for (const u of currentUsers) {
    if (clean === `token-${u.id}` || clean === `token-${u.id.replace('user-', '')}`) {
      return u;
    }
  }
  return null;
}

function getAuthHeader(init?: RequestInit): string | null {
  if (!init || !init.headers) return null;
  const h = init.headers;
  if (h instanceof Headers) {
    return h.get('Authorization') || h.get('authorization');
  }
  if (Array.isArray(h)) {
    const found = h.find(([k]) => k.toLowerCase() === 'authorization');
    return found ? found[1] : null;
  }
  const rec = h as Record<string, string>;
  return rec['Authorization'] || rec['authorization'] || null;
}

export interface MockApiSeed {
  users?: User[];
  calendars?: Calendar[];
  appointments?: Appointment[];
}

export function installMockApi(seed?: MockApiSeed) {
  recordedCalls = [];
  nextId = 100;
  currentUsers = seed?.users ? [...seed.users] : [USER_CARLOS, USER_DR_JOAO, USER_MARIA];
  currentCalendars = seed?.calendars
    ? [...seed.calendars]
    : [CALENDAR_CARLOS_PESSOAL, CALENDAR_DR_JOAO_PROF, CALENDAR_DR_JOAO_PESSOAL];
  currentAppointments = seed?.appointments
    ? [...seed.appointments]
    : createInitialAppointments();

  const mockFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const method = (init?.method || 'GET').toUpperCase();
    const urlStr =
      typeof input === 'string'
        ? input
        : input instanceof URL
        ? input.toString()
        : input.url;

    let pathname = '';
    let search = '';
    try {
      const parsed = new URL(urlStr, 'http://localhost');
      pathname = parsed.pathname;
      search = parsed.search;
    } catch {
      const parts = urlStr.split('?');
      pathname = parts[0];
      search = parts[1] ? `?${parts[1]}` : '';
    }

    const fullPath = pathname + search;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let body: any = null;
    if (init?.body) {
      if (typeof init.body === 'string') {
        try {
          body = JSON.parse(init.body);
        } catch {
          body = init.body;
        }
      } else {
        body = init.body;
      }
    }

    recordedCalls.push({ method, path: fullPath, body });

    const route = pathname.startsWith('/api') ? pathname.slice('/api'.length) : pathname;
    const searchParams = new URLSearchParams(search);

    // POST /auth/login
    if (route === '/auth/login' && method === 'POST') {
      const email = body?.email?.trim();
      const password = body?.password;
      if (password === '123456') {
        const found = currentUsers.find((u) => u.email === email);
        if (found) {
          return jsonResponse({ accessToken: `token-${found.id}`, user: found });
        }
      }
      return jsonResponse({ message: 'E-mail ou senha incorretos' }, 401);
    }

    // Token check for all other routes
    const authHeader = getAuthHeader(init);
    const currentUser = resolveUserFromToken(authHeader);
    if (!currentUser) {
      return jsonResponse({ message: 'Não autorizado' }, 401);
    }

    // GET /auth/me
    if (route === '/auth/me' && method === 'GET') {
      return jsonResponse(currentUser);
    }

    // GET /agendas
    if (route === '/agendas' && method === 'GET') {
      const owned = currentCalendars
        .filter((c) => c.ownerId === currentUser.id)
        .map((c) => ({
          ...c,
          _count: {
            appointments: currentAppointments.filter((a) => a.calendarId === c.id).length,
          },
        }));

      const delegated = currentCalendars
        .filter((c) => c.ownerId !== currentUser.id)
        .filter((c) =>
          c.permissions?.some((p) => p.granteeUser?.id === currentUser.id && p.canView),
        )
        .map((c) => {
          const perm = c.permissions?.find((p) => p.granteeUser?.id === currentUser.id);
          return {
            ...c,
            myPermissions: perm
              ? {
                  canView: perm.canView,
                  canCreate: perm.canCreate,
                  canUpdate: perm.canUpdate,
                  canCancel: perm.canCancel,
                }
              : undefined,
            _count: {
              appointments: currentAppointments.filter((a) => a.calendarId === c.id).length,
            },
          };
        });

      return jsonResponse({ owned, delegated });
    }

    // GET /telegram/status
    if (route === '/telegram/status' && method === 'GET') {
      return jsonResponse({
        linked: Boolean(currentUser.telegramLinked),
        botUsername: 'VidaEmDiaBot',
      });
    }

    // GET /auditoria
    if (route === '/auditoria' && method === 'GET') {
      return jsonResponse([]);
    }

    // GET /compromissos
    if (route === '/compromissos' && method === 'GET') {
      const calId = searchParams.get('calendarId');
      const list = calId
        ? currentAppointments.filter((a) => a.calendarId === calId)
        : currentAppointments;
      return jsonResponse(list);
    }

    // POST /compromissos
    if (route === '/compromissos' && method === 'POST') {
      const id = `appt-${++nextId}`;
      const reminderMinutesBefore = body?.reminderMinutesBefore ?? 30;
      const reminders: Reminder[] = [];
      const start = new Date(body.startTime);
      const end = body.endTime
        ? new Date(body.endTime)
        : new Date(start.getTime() + 60 * 60 * 1000);

      if (body.reminderEnabled !== false && body.reminder !== 'none') {
        const remindAt = new Date(
          start.getTime() - reminderMinutesBefore * 60 * 1000,
        ).toISOString();
        reminders.push({
          id: `rem-${++nextId}`,
          appointmentId: id,
          remindAt,
          channel: 'TELEGRAM',
          status: 'PENDING',
          retryCount: 0,
        });
      }

      const cal = currentCalendars.find((c) => c.id === body.calendarId);
      const newAppt: Appointment = {
        id,
        calendarId: body.calendarId,
        createdById: currentUser.id,
        title: body.title,
        description: body.description || null,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        reminderMinutesBefore,
        status: 'SCHEDULED',
        createdVia: 'WEB',
        createdBy: currentUser,
        calendar: cal
          ? {
              id: cal.id,
              name: cal.name,
              ownerId: cal.ownerId,
              owner: cal.owner
                ? {
                    id: cal.owner.id,
                    name: cal.owner.name,
                    telegramChatId: cal.owner.telegramChatId,
                  }
                : undefined,
            }
          : undefined,
        reminders,
      };

      currentAppointments.push(newAppt);
      return jsonResponse(newAppt, 201);
    }

    // PATCH /compromissos/:id
    if (route.startsWith('/compromissos/') && method === 'PATCH') {
      const id = route.replace('/compromissos/', '');
      const appt = currentAppointments.find((a) => a.id === id);
      if (!appt) {
        return jsonResponse({ message: 'Compromisso não encontrado' }, 404);
      }

      if (body.title !== undefined) appt.title = body.title.trim();
      if (body.description !== undefined) {
        appt.description = body.description ? body.description.trim() : null;
      }
      if (body.startTime !== undefined) {
        appt.startTime = new Date(body.startTime).toISOString();
        if (body.endTime !== undefined) {
          appt.endTime = new Date(body.endTime).toISOString();
        } else {
          appt.endTime = new Date(
            new Date(body.startTime).getTime() + 60 * 60 * 1000,
          ).toISOString();
        }
      }
      if (body.reminderMinutesBefore !== undefined) {
        appt.reminderMinutesBefore = body.reminderMinutesBefore;
      }
      if (body.reminderEnabled === false) {
        appt.reminders = [];
      } else if (body.reminderEnabled || body.startTime !== undefined) {
        const startMs = new Date(appt.startTime).getTime();
        const minutes = appt.reminderMinutesBefore ?? 30;
        const remindAt = new Date(startMs - minutes * 60 * 1000).toISOString();
        if (appt.reminders && appt.reminders.length > 0) {
          appt.reminders[0].remindAt = remindAt;
        } else {
          appt.reminders = [
            {
              id: `rem-${++nextId}`,
              appointmentId: appt.id,
              remindAt,
              channel: 'TELEGRAM',
              status: 'PENDING',
              retryCount: 0,
            },
          ];
        }
      }

      return jsonResponse(appt, 200);
    }

    // DELETE /compromissos/:id
    if (route.startsWith('/compromissos/') && method === 'DELETE') {
      const id = route.replace('/compromissos/', '');
      const appt = currentAppointments.find((a) => a.id === id);
      if (!appt) {
        return jsonResponse({ message: 'Compromisso não encontrado' }, 404);
      }
      appt.status = 'CANCELLED';
      return jsonResponse(appt, 200);
    }

    return jsonResponse({});
  };

  globalThis.fetch = vi.fn(mockFetch);

  return {
    calls,
    users: currentUsers,
    calendars: currentCalendars,
    appointments: currentAppointments,
  };
}
