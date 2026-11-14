# 63 — Compromisso de dia inteiro (roteiro 8.5, parte 1)

Depende do plano 62. Referência: `.plans/29-google-agenda-analise.md`, seção 2.6 item 4.
Não execute comandos de terminal. Use só ferramentas de arquivo. **A migration é gerada pelo orquestrador depois.**
Só backend (e o tipo no front). A tela com a opção "Dia inteiro" é outro passo (8.6).

## Regra
- Campo novo `Appointment.allDay` (Boolean, padrão false).
- Com `allDay`, `startTime` = 00:00 do primeiro dia e `endTime` = 00:00 do dia **seguinte** ao último dia, no fuso de São Paulo.
  São Paulo não tem horário de verão: usar o deslocamento fixo `-03:00`.
- Lembrete às **08:00 do primeiro dia** (São Paulo). Se esse horário já passou, o lembrete fica para agora (hora da criação/alteração).
  `reminderMinutesBefore` é ignorado nesse caso (fica gravado como veio, mas não é usado).
- Não entra na checagem de conflito de horário (nem como compromisso novo, nem como compromisso existente).
- No Google: `start.date` / `end.date` (`AAAA-MM-DD`, o `end.date` é exclusivo, igual ao nosso `endTime`).

## Arquivos
- Editar: `backend/prisma/schema.prisma`, `backend/src/appointments/dto/appointment.dto.ts`, `backend/src/appointments/appointments.service.ts`,
  `backend/src/google/google-event.mapper.ts`, `backend/src/google/google-pull.service.ts`, `backend/src/notifications/notification.worker.ts`,
  `backend/src/notifications/bot.service.ts`, `frontend/src/types.ts`, e os specs: `appointments.service.spec.ts`, `google-event.mapper.spec.ts`,
  `google-pull.service.spec.ts`, `notification.worker.spec.ts` (só se algum teste existente quebrar pela mudança; e os testes novos abaixo)
- Criar: `backend/src/appointments/all-day.util.ts` e `backend/src/appointments/all-day.util.spec.ts`

## Passos

### 1. Schema
`Appointment`: `allDay Boolean @default(false) @map("all_day")`. Nada mais.

### 2. `all-day.util.ts`
```ts
export const SAO_PAULO_OFFSET = '-03:00';
export function toSaoPauloDateString(d: Date): string            // 'AAAA-MM-DD' da data em São Paulo (Intl, timeZone 'America/Sao_Paulo', locale 'en-CA')
export function startOfSaoPauloDay(day: string | Date): Date     // string 'AAAA-MM-DD' → new Date(`${day}T00:00:00-03:00`); Date → usa toSaoPauloDateString antes
export function addDays(d: Date, n: number): Date                // + n * 24h
export function normalizeAllDayRange(start: Date, endInclusive?: Date): { startTime: Date; endTime: Date }
  // startTime = startOfSaoPauloDay(start); endTime = addDays(startOfSaoPauloDay(endInclusive ?? start), 1); se endTime <= startTime, usa addDays(startTime, 1)
export function allDayRemindAt(startTime: Date, now = new Date()): Date
  // new Date(`${toSaoPauloDateString(startTime)}T08:00:00-03:00`); se < now, devolve now
```
Testes: data 2026-11-20 às 23:30 de São Paulo (02:30Z do dia 21) cai no dia 20; faixa de um dia; faixa de 3 dias; lembrete às 08:00 (11:00Z);
lembrete que já passou vira `now`.

### 3. DTO
`CreateAppointmentDto` e `UpdateAppointmentDto`: `allDay?: boolean` (`@IsOptional() @IsBoolean()`, `@ApiPropertyOptional` com
descrição "Dia inteiro: ignora a hora; endTime é o último dia (inclusive)"). Se o `UpdateAppointmentDto` herda do create (PartialType), basta no create.

### 4. `appointments.service.ts`
- `create`: `allDay = dto.allDay === true`. Se `allDay`: `{ startTime, endTime } = normalizeAllDayRange(new Date(dto.startTime), dto.endTime ? new Date(dto.endTime) : undefined)`
  (pula o "padrão 1 hora" e a validação de término posterior, que o normalize já garante), pula a checagem de conflito,
  e o lembrete usa `allDayRemindAt(startTime)`. Grava `allDay` no `data`.
- `create` e `update`, na checagem de conflito existente: acrescentar `allDay: false` no `where` (compromisso de dia inteiro não conflita).
- `update`: `allDay = dto.allDay ?? existing.allDay`. Se `allDay`: normalizar com `normalizeAllDayRange(dto.startTime ? new Date(dto.startTime) : existing.startTime,
  dto.endTime ? new Date(dto.endTime) : (dto.startTime ? undefined : addDays(existing.endTime, -1)))`, sem checagem de conflito.
  Se deixou de ser `allDay` (era true, agora false) e não veio `endTime`, `endTime = startTime + 1 hora`.
  `timeChanged` também é true quando `allDay` mudou. Grava `allDay` no update. No recálculo do lembrete, `remindAt = allDay ? allDayRemindAt(startTime) : computeRemindAt(...)`.
- Na auditoria (`metadata`), incluir `allDay`.

### 5. Mapper (`google-event.mapper.ts`)
- `AppointmentForGoogleEvent` ganha `allDay?: boolean`.
- `toGoogleEvent`: se `allDay`: `start: { date: toSaoPauloDateString(startTime), dateTime: null, timeZone: null }`,
  `end: { date: toSaoPauloDateString(endTime), dateTime: null, timeZone: null }`.
  Senão como hoje, mas com `date: null` em `start` e `end` (para o PATCH trocar de dia inteiro para horário). Ajustar o tipo `GoogleEventPayload`.
- `fromGoogleEvent`: deixa de devolver `null` para dia inteiro. Se `ev.start?.date` (sem `dateTime`): `allDay: true`,
  `startTime = startOfSaoPauloDay(ev.start.date)`, `endTime = startOfSaoPauloDay(ev.end?.date ?? ev.start.date)` (se `endTime <= startTime`, `addDays(startTime, 1)`).
  Com `dateTime`: `allDay: false`, como hoje. Devolve `null` só se não tem nem `date` nem `dateTime`. Tipo `MappedFromGoogleEvent` ganha `allDay`.

### 6. `google-pull.service.ts`
- `create` e `update` gravam `allDay: mapped.allDay`.
- Lembrete: quando `mapped.allDay`, o horário é `allDayRemindAt(mapped.startTime)` (no create, cria o lembrete mesmo que isso seja "agora", desde que
  `mapped.startTime` ainda não tenha passado... na prática: criar se `mapped.endTime > agora`); senão, a regra de hoje.
- O comentário/regra "dia inteiro é ignorado" sai.

### 7. Mensagens
- `notification.worker.ts`: se `appt.allDay`, a linha vira `${título} em ${data} (dia inteiro).` em vez de `às ${hora}`.
- `bot.service.ts` (`/agenda`): se `a.allDay`, `— ${dt} (dia inteiro)` em vez de `— ${dt} às ${tm}`.

### 8. Front (`frontend/src/types.ts`)
No tipo do compromisso, `allDay?: boolean`. Nada mais no front.

### 9. Testes novos
- `appointments.service.spec.ts`: criar com `allDay` normaliza para 00:00 −03:00 e dia seguinte, lembrete às 08:00, sem checagem de conflito mesmo em agenda PROFISSIONAL.
- `google-event.mapper.spec.ts`: `toGoogleEvent` com `allDay` usa `date`; `fromGoogleEvent` com `start.date` → `allDay: true` e horários certos
  (o teste antigo "dia inteiro → null" passa a esperar o objeto).
- `google-pull.service.spec.ts`: evento de dia inteiro é criado com `allDay: true` (o teste antigo "dia inteiro → ignorado" muda).
- `notification.worker.spec.ts`: mensagem de dia inteiro sem horário.

## Critérios de aceite
- `npm run lint`, `npm run build`, `npm test` do backend passam (o orquestrador roda).
- Criar pelo Swagger com `allDay: true` aparece no Google como evento de dia inteiro; evento de dia inteiro no Google aparece no VidaEmDia.

## Não alterar
- `google-sync.worker.ts` (já usa `toGoogleEvent`), `google-sync-queue.service.ts`, o restante do front, as migrations existentes.
