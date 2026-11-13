# 59 — Google Agenda, parte 2: ligar uma agenda do VidaEmDia a uma do Google (roteiro 8.2)

Depende do plano 58 (conta Google conectada, `GoogleAccountService.getAccessToken`).
Não execute comandos de terminal. Use só ferramentas de arquivo. **A migration é gerada pelo orquestrador depois.**

## Decisões (plano 29, seção 2.6, item 7)
- Só o **dono** da agenda (ou ADMIN agindo como dono não; só o dono) liga ou desliga. Quem tem acesso delegado não mexe.
- Uma agenda do VidaEmDia ↔ uma agenda do Google; só agendas do Google em que a conta pode escrever (`accessRole` `owner` ou `writer`).
- Desligar não apaga nada no Google; só para de sincronizar.

## Arquivos
- Editar: `backend/prisma/schema.prisma`, `backend/src/google/google.module.ts`, `backend/src/google/google.controller.ts` (ou um controller novo no mesmo módulo),
  `backend/src/google/google-account.service.ts` (se precisar), `frontend/src/types.ts` (campos novos de `Calendar`, opcionais)
- Criar: `backend/src/google/google-calendar.client.ts`, `backend/src/google/google-calendar-link.service.ts`, `backend/src/google/google-calendar-link.service.spec.ts`

## Passos

### 1. Schema (`Calendar`)
`googleCalendarId String? @map("google_calendar_id")`, `googleCalendarName String? @map("google_calendar_name")`, `googleLinkedAt DateTime? @map("google_linked_at")`.

### 2. `google-calendar.client.ts` (injetável, `fetch`)
Base `https://www.googleapis.com/calendar/v3`. Todas as chamadas recebem o `accessToken` e mandam `Authorization: Bearer`.
- `listWritableCalendars(token)` → `GET /users/me/calendarList?minAccessRole=writer&showHidden=false` → `{ id, summary, primary, backgroundColor }[]` (seguir `nextPageToken` se houver).
- (Para o passo 8.3, já deixar prontos) `insertEvent(token, calendarId, body)`, `patchEvent(token, calendarId, eventId, body)`, `deleteEvent(token, calendarId, eventId)`.
  `calendarId` e `eventId` com `encodeURIComponent`. Erro HTTP → lançar `GoogleApiError` com `status` e a mensagem do Google (`error.message` do JSON).

### 3. `google-calendar-link.service.ts`
- `listCalendars(userId)` → usa `getAccessToken(userId)` e `listWritableCalendars`. Sem conta conectada → `BadRequestException('Conecte sua conta Google primeiro.')`.
- `link(userId, calendarId, googleCalendarId)`:
  - agenda existe (404) e `ownerId === userId` (senão `ForbiddenException('Só o dono da agenda pode ligá-la ao Google.')`);
  - `googleCalendarId` está na lista de `listCalendars(userId)` (senão `BadRequestException('Agenda do Google não encontrada ou sem permissão de escrita.')`);
  - grava `googleCalendarId`, `googleCalendarName` (o `summary`) e `googleLinkedAt`;
  - auditoria: `entityType: 'PERMISSION'`? **não** — usar `entityType: 'APPOINTMENT'`? também não. Usar `entityType: 'AUTH'`, `action: 'UPDATE'`, `targetCalendarId: calendarId`,
    `details: 'Agenda ligada ao Google Agenda "<summary>"'`, `metadata: { googleCalendarId, googleCalendarName }`.
  - deixar um ponto de extensão: chamar `this.onLinked?.(calendarId)` — o passo 8.3 usa para enfileirar a carga inicial. (Pode ser um método vazio `protected async afterLink(calendarId: string) {}` que o 8.3 preenche.)
- `unlink(userId, calendarId)`: mesmas checagens de dono; zera os três campos; auditoria `details: 'Agenda desligada do Google Agenda'`; ponto de extensão `afterUnlink(calendarId)`.

### 4. Rotas (JWT)
- `GET /google/calendars` → `listCalendars`.
- `PUT /agendas/:id/google` com corpo `{ googleCalendarId: string }` (DTO com `@IsString() @IsNotEmpty()`) → `link`; devolve a agenda atualizada.
- `DELETE /agendas/:id/google` → `unlink`; devolve a agenda atualizada.
(Podem ficar num controller `@Controller('agendas')` dentro do `GoogleModule`.) Integração não configurada → 503 como no plano 58.

### 5. `GET /agendas`
Os campos novos já vêm porque a consulta inclui a agenda inteira; conferir que `owned` e `delegated` trazem `googleCalendarId` e `googleCalendarName`.
Front `types.ts`: `Calendar` ganha `googleCalendarId?: string | null`, `googleCalendarName?: string | null`.

### 6. Testes (`google-calendar-link.service.spec.ts`, com mocks)
Ligar como dono com agenda válida grava os campos e audita; quem não é dono → 403; agenda do Google fora da lista → 400; sem conta conectada → 400; desligar zera os campos.

## Critérios de aceite
- Build, lint (0 erros) e testes no backend; build do front.

## O que NÃO alterar
- `prisma/migrations/`, compromissos, worker, telas do front (ficam para o plano 61).
