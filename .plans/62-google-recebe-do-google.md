# 62 — Google Agenda, parte 4: o que muda no Google vem para o VidaEmDia (roteiro 8.4)

Depende dos planos 58, 59 e 60. Referência: seção 2.5 do `.plans/29-google-agenda-analise.md`.
Não execute comandos de terminal. Use só ferramentas de arquivo. **A migration é gerada pelo orquestrador depois.**

## Como funciona
1. Um worker novo (cron, padrão a cada 1 minuto) percorre as agendas do VidaEmDia ligadas ao Google (`googleCalendarId` preenchido).
2. Para cada uma, chama `events.list` do Google com o token do **dono** da agenda:
   - sem `googleSyncToken` → **carga completa**: `timeMin` = agora − 1 dia, `timeMax` = agora + 60 dias, `singleEvents=true`;
   - com `googleSyncToken` → **incremental**: só `syncToken` e `singleEvents=true` (o Google não aceita `timeMin/timeMax` junto com `syncToken`);
   - responde `410` → o token expirou: apaga o `googleSyncToken` e refaz a carga completa no mesmo ciclo.
   - Percorre todas as páginas (`pageToken`); grava o `nextSyncToken` da última página.
3. Cada evento recebido é aplicado direto no banco pelo Prisma (**não** usar `AppointmentsService.create/update`: eles recusam conflito
   e enfileiram envio ao Google, o que criaria eco). Regras na seção "Aplicar um evento".

Fora deste passo (fica para o 8.5): `allDay`, `hasConflict`, `isPrivate`, convites recusados, "última alteração vence" por data. Neste passo:
- evento de **dia inteiro** (`start.date` sem `start.dateTime`) é **ignorado** (não importa, não altera; se já existia importado, não mexe);
- conflito de horário **não** é verificado (evento do Google nunca é recusado).

## Arquivos
- Editar: `backend/prisma/schema.prisma`, `backend/src/google/google-calendar.client.ts`, `backend/src/google/google-event.mapper.ts`,
  `backend/src/google/google-sync.worker.ts`, `backend/src/google/google-calendar-link.service.ts`, `backend/src/google/google.module.ts`,
  `backend/src/google/google.controller.ts`, `backend/src/audit/audit.service.ts` (só se precisar de tipo), `backend/src/monitoring/metrics.service.ts`,
  `backend/src/google/google-sync.worker.spec.ts`, `backend/src/google/google-event.mapper.spec.ts`
- Criar: `backend/src/google/google-pull.service.ts`, `backend/src/google/google-pull.service.spec.ts`

## Passos

### 1. Schema (`schema.prisma`)
- `Calendar`: `googleSyncToken String? @map("google_sync_token")`, `googleLastSyncAt DateTime? @map("google_last_sync_at")`,
  `googleSyncError String? @map("google_sync_error")`.
- `Appointment`: `googleEtag String? @map("google_etag")` e `@@unique([calendarId, googleEventId])` (nulos não colidem no Postgres).
- Não mexer em mais nada do schema.

### 2. Client (`google-calendar.client.ts`)
Novo método:
```ts
async listEvents(token: string, calendarId: string, opts: {
  syncToken?: string; timeMin?: string; timeMax?: string; pageToken?: string;
}): Promise<{ items: any[]; nextPageToken?: string; nextSyncToken?: string }>
```
GET `${baseUrl}/calendars/${encodeURIComponent(calendarId)}/events` com `singleEvents=true`, `maxResults=250`, e os parâmetros presentes em `opts`
(com `syncToken`, **não** mandar `timeMin`/`timeMax`). Erro HTTP → `handleHttpError` (já lança `GoogleApiError` com `status`, então 410 chega como `status === 410`).
`items` vazio quando o Google não manda.

### 3. Mapper (`google-event.mapper.ts`)
Nova função `fromGoogleEvent(ev)` que devolve `null` para evento de dia inteiro (sem `ev.start?.dateTime`) ou sem `ev.end?.dateTime`; senão:
```ts
{ title: (ev.summary ?? '').trim() || '(Sem título)', description: ev.description ?? null,
  startTime: new Date(ev.start.dateTime), endTime: new Date(ev.end.dateTime),
  reminderMinutesBefore: <minutos do primeiro override com method 'popup' em ev.reminders.overrides; senão 30>,
  vidaemdiaId: ev.extendedProperties?.private?.vidaemdiaId ?? null }
```
Testes no `google-event.mapper.spec.ts`: dia inteiro → null; popup override usado; sem override → 30; sem título → "(Sem título)".

### 4. Envio guarda o etag (`google-sync.worker.ts`)
No UPSERT, ao gravar `googleEventId`, gravar também `googleEtag: <resultado do insert/patch>.etag ?? null`. Ajustar o spec existente se ele conferir o `data` exato.

### 5. `google-pull.service.ts` (novo, `@Injectable`, provider do `GoogleModule`)
Dependências: `PrismaService`, `GoogleAccountService`, `GoogleCalendarClient`, `AuditService`, `MetricsService`.

- `@Cron(process.env.GOOGLE_PULL_CRON_EXPRESSION || '*/1 * * * *') async pullAll()`: se `googleConfig().configured` é falso, retorna.
  Trava `isRunning` igual ao `GoogleSyncWorker` (não roda dois ciclos juntos). Busca as agendas com `googleCalendarId` não nulo e chama `pullCalendar(id)`
  para cada uma, dentro de try/catch individual (o erro de uma não para as outras). Retorna `{ calendars, created, updated, cancelled, ignored, errors }`.
- `async pullCalendar(calendarId)`: retorna contadores `{ created, updated, cancelled, ignored }`.
  1. Lê a agenda; sem `googleCalendarId` → retorna zeros.
  2. Token: `googleAccountService.getAccessToken(calendar.ownerId)`. Erro → grava `calendar.googleSyncError` com a mensagem
     (`GoogleInvalidGrantError` → "Conexão com o Google expirou; conecte de novo."; `NotFoundException` → "O dono da agenda não tem o Google conectado."),
     `metricsService.incrementGoogleSync('erro')` e relança.
  3. Lista as páginas conforme "Como funciona" item 2 (410 → zera `googleSyncToken` no banco e recomeça como carga completa, uma vez só).
  4. Aplica cada evento (seção abaixo).
  5. Sucesso: grava `googleSyncToken = nextSyncToken`, `googleLastSyncAt = agora`, `googleSyncError = null`; `incrementGoogleSync('ok')`.
     Erro que não seja de token: grava `googleSyncError = 'Não foi possível receber do Google: ' + mensagem`, `incrementGoogleSync('erro')` e relança.

#### Aplicar um evento (`applyEvent(calendar, ev)`)
1. Achar o compromisso local, nesta ordem: `{ calendarId, googleEventId: ev.id }`; senão, se `ev.extendedProperties?.private?.vidaemdiaId`,
   `{ id: vidaemdiaId, calendarId }`. Chamar o achado de `appt`.
2. **Envio pendente vence:** se `appt` existe e há `googleSyncJob` dele com status `PENDING` ou `PROCESSING` → ignorar (contar `ignored`).
   Se o `appt` foi achado pelo `vidaemdiaId` e está sem `googleEventId`, gravar `googleEventId = ev.id` e `googleEtag = ev.etag` mesmo assim.
3. `ev.status === 'cancelled'`:
   - sem `appt` ou `appt.status === CANCELLED` → ignorar;
   - senão: `appt.status = CANCELLED`, `googleEtag = ev.etag ?? appt.googleEtag`, `googleSyncedAt = agora`; apagar os lembretes `PENDING` dele;
     auditoria `{ actorUserId: undefined, targetCalendarId, entityType: 'APPOINTMENT', entityId: appt.id, action: 'CANCEL',
     details: 'Compromisso "<título>" cancelado via Google Agenda', metadata: { source: 'GOOGLE', googleEventId: ev.id } }`. Conta `cancelled`.
   - **Não** enfileirar DELETE (o evento já sumiu do Google).
4. `fromGoogleEvent(ev)` devolve `null` (dia inteiro) → ignorar.
5. Existe `appt` e `appt.googleEtag === ev.etag` → ignorar (é o eco do próprio envio).
6. Existe `appt` (etag diferente) → `update` com `title`, `description`, `startTime`, `endTime`, `googleEventId = ev.id`, `googleEtag = ev.etag`,
   `googleSyncedAt = agora`, `googleSyncError = null`. Se estava `CANCELLED` e o evento voltou ativo, volta para `SCHEDULED`.
   Lembretes: se há lembrete `PENDING`, atualizar o `remindAt` para `startTime − appt.reminderMinutesBefore` minutos; se `startTime` mudou para o futuro
   e não há lembrete `PENDING` nem `SENT`, criar um `PENDING` (canal `TELEGRAM`). Auditoria `action: 'UPDATE'`, details
   `'Compromisso "<título>" alterado via Google Agenda'`. Conta `updated`. **Não** enfileirar envio.
7. Não existe `appt`:
   - se `endTime < agora − 1 dia` → ignorar;
   - senão `create`: `calendarId`, `createdById = calendar.ownerId`, `title`, `description`, `startTime`, `endTime`, `reminderMinutesBefore`,
     `status: SCHEDULED`, `createdVia: 'GOOGLE'`, `googleEventId = ev.id`, `googleEtag = ev.etag`, `googleSyncedAt = agora`; e, se
     `startTime − reminderMinutesBefore` ainda está no futuro, um lembrete `PENDING` canal `TELEGRAM` nesse horário.
     Auditoria `action: 'CREATE'`, details `'Compromisso "<título>" importado do Google Agenda'`. Conta `created`. **Não** enfileirar envio.
   - Se o `create` falhar por unicidade (`P2002`, outro ciclo criou ao mesmo tempo) → ignorar.

### 6. Ligar e desligar (`google-calendar-link.service.ts`)
Ao ligar (`link`) e ao desligar (`unlink`), gravar também `googleSyncToken: null`, `googleLastSyncAt: null`, `googleSyncError: null` na agenda
(ao ligar, a próxima rodada faz a carga completa). Os compromissos importados ficam no VidaEmDia ao desligar.

### 7. Sincronizar agora (`google.controller.ts`, no `GoogleAgendaLinkController`)
`POST /agendas/:id/google/sincronizar`: 503 se não configurado (igual aos outros); 404 se a agenda não existe; **403 se o usuário não é o dono**;
400 se a agenda não está ligada. Chama `pullService.pullCalendar(id)` e devolve os contadores. Swagger como os vizinhos.
Mantenha a checagem de dono no service (`pullCalendarForOwner(userId, calendarId)`), não no controller.

### 8. Métricas
Reusar `incrementGoogleSync('ok' | 'erro')`. Não criar métrica nova.

### 9. Testes (`google-pull.service.spec.ts`, mocks de Prisma, client, account, audit, metrics — mesmo estilo do `google-sync.worker.spec.ts`)
- carga completa sem token manda `timeMin/timeMax` e grava `nextSyncToken`; incremental manda só `syncToken`;
- 410 zera o token e refaz como carga completa;
- evento novo cria com `createdVia 'GOOGLE'`, lembrete e auditoria com `actorUserId` vazio, sem chamar a fila;
- mesmo `etag` → ignorado; etag diferente → atualiza;
- `cancelled` cancela e apaga lembretes pendentes; `cancelled` desconhecido → ignorado;
- job PENDING do compromisso → ignorado;
- achado pelo `vidaemdiaId` sem `googleEventId` → grava o `googleEventId`;
- dia inteiro → ignorado;
- token expirado grava `googleSyncError`;
- `pullCalendarForOwner` com quem não é dono → `ForbiddenException`.

## Critérios de aceite
- `npm run lint`, `npm run build` e `npm test` do backend passam (o orquestrador roda).
- Criar/alterar/apagar um evento na agenda do Google ligada aparece no VidaEmDia em até 1 minuto, sem voltar ao Google (sem eco).

## Não alterar
- `appointments.service.ts`, `google-sync-queue.service.ts`, o front, o worker de lembretes do Telegram, o `docker-compose.yml`, as migrations existentes.
