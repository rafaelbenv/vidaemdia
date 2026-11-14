# 64 — Regras da sincronização: conflito, privacidade, convite recusado, última alteração vence (roteiro 8.5, parte 2)

Depende dos planos 62 e 63. Referência: `.plans/29-google-agenda-analise.md`, seção 2.6 itens 1, 2 e 7.
Não execute comandos de terminal. Use só ferramentas de arquivo. **A migration é gerada pelo orquestrador depois.**
Só backend (e os tipos no front). As marcas na tela são outro passo (8.6).

## Arquivos
- Editar: `backend/prisma/schema.prisma`, `backend/src/appointments/appointments.service.ts`, `backend/src/appointments/appointments.module.ts`,
  `backend/src/google/google-event.mapper.ts`, `backend/src/google/google-pull.service.ts`, `backend/src/google/google.module.ts`,
  `backend/src/notifications/bot-webhook.controller.ts`, `frontend/src/types.ts` e os specs correspondentes
  (`appointments.service.spec.ts`, `google-event.mapper.spec.ts`, `google-pull.service.spec.ts`, `bot-webhook.controller.spec.ts` se quebrar)
- Criar: `backend/src/appointments/conflict.service.ts` e `backend/src/appointments/conflict.service.spec.ts`

## 1. Schema
`Appointment`: `hasConflict Boolean @default(false) @map("has_conflict")` e `isPrivate Boolean @default(false) @map("is_private")`.

## 2. Conflito sinalizado (`conflict.service.ts`)
`@Injectable() ConflictService` (só depende do `PrismaService`), com `recalculateCalendar(calendarId: string): Promise<void>`:
1. Busca os compromissos da agenda com `status SCHEDULED`, `allDay false` e `endTime >= agora − 1 dia`, ordenados por `startTime`
   (`select: { id, startTime, endTime, hasConflict }`).
2. Em memória, marca como em conflito todo compromisso que se sobrepõe a outro (`a.startTime < b.endTime && b.startTime < a.endTime`).
   Varredura ordenada: guarde o maior `endTime` visto e o id dele; se o atual começa antes desse `endTime`, os dois entram no conjunto.
3. Atualiza em no máximo duas `updateMany`: `hasConflict: true` para os ids do conjunto que estão `false`; `hasConflict: false` para os
   **demais compromissos da agenda** (qualquer status, incluindo cancelados e dia inteiro) que estão `true`.
Testes: sem sobreposição → nada marcado; A e B sobrepostos → os dois; A longo cobrindo B e C → os três; cancelado e dia inteiro não contam e são desmarcados;
encostado (fim de A == início de B) não é conflito.

Chamadas:
- `AppointmentsService`: no fim de `create` e de `update` (o `cancel` passa pelo `update`), `await this.conflictService.recalculateCalendar(calendarId)`.
  O objeto devolvido deve refletir o `hasConflict` novo: recalcular **antes** da leitura final do `update`; no `create`, reler o `hasConflict` do compromisso
  depois do recálculo e ajustar o objeto devolvido. O `ConflictService` é provider e export do `AppointmentsModule`.
  A recusa de conflito que já existe para agenda PROFISSIONAL (quem cria/altera pelo VidaEmDia) **continua** igual.
- `GooglePullService`: no fim do `pullCalendar`, se `created + updated + cancelled > 0`, chamar `recalculateCalendar(calendar.id)`.
  Para não criar dependência circular (`AppointmentsModule` importa o `GoogleModule`), registrar o `ConflictService` **também** como provider do
  `GoogleModule` (ele só depende do `PrismaService`, que é global). Não importar o `AppointmentsModule` no `GoogleModule`.
- Evento vindo do Google continua **nunca** sendo recusado.

## 3. Privacidade
- `fromGoogleEvent`: `isPrivate: ev.visibility === 'private' || ev.visibility === 'confidential'` (tipo `MappedFromGoogleEvent` ganha `isPrivate`).
- `GooglePullService`: `create` e `update` gravam `isPrivate: mapped.isPrivate`. Nos textos de auditoria, quando `isPrivate`, usar `Compromisso privado`
  no lugar de `Compromisso "<título>"` (ex.: `'Compromisso privado importado do Google Agenda'`). Ao cancelar, usar o `appt.isPrivate`.
- `AppointmentsService.findAllForCalendar`: depois de buscar, para cada compromisso com `isPrivate` quando `userId !== calendar.ownerId`
  (o dono vem em `calendar.owner.id` no include; ADMIN também é mascarado se não for o dono), devolver `title: 'Ocupado'`, `description: null`.
  O dono vê tudo.
- `AppointmentsService.update` feito por quem não é o dono num compromisso `isPrivate`: ignorar `dto.title` e `dto.description` (manter os atuais).
- Auditoria do `create`/`update` do `AppointmentsService`: quando o compromisso é `isPrivate`, `details` usa `Compromisso privado` no lugar de
  `Compromisso "<título>"` e o `metadata` não leva `title` (nem no `before`/`after`).
- `bot-webhook.controller.ts` (lista de mensagens enviadas, quem não é ADMIN): além do filtro de agendas que já existe, esconder as mensagens de compromissos
  `isPrivate` cuja agenda não é do próprio usuário (buscar `isPrivate` e `calendar.ownerId` no `findMany` que já existe).
- O lembrete do Telegram continua indo ao dono com o título real (não mexer no `notification.worker.ts`).

## 4. Convite recusado
No `applyEvent` do `GooglePullService`, antes do tratamento de `cancelled`: se `ev.attendees?.some((a) => a.self && a.responseStatus === 'declined')`,
tratar exatamente como `ev.status === 'cancelled'` (cancela se existe e não está cancelado; senão ignora). Detalhe da auditoria:
`'Compromisso "<título>" cancelado: convite recusado no Google Agenda'` (ou `Compromisso privado ...`).

## 5. Última alteração vence
Trocar a regra "envio pendente vence" do `applyEvent` por:
1. Se existe job do compromisso com status `PROCESSING` → ignorar (o próximo ciclo vê de novo).
2. Se existe job `PENDING`: comparar `new Date(ev.updated)` com `appt.updatedAt`.
   - Google mais novo (ou `ev.updated` ausente → considera o local mais novo, ignora): marcar esse job como `DONE` com
     `lastError: 'Substituído por alteração mais recente no Google Agenda'`, `claimedAt/claimedBy: null`, e seguir aplicando o evento normalmente.
   - Local mais novo ou igual → ignorar (o job envia o local para o Google).
3. Continua valendo: achado pelo `vidaemdiaId` sem `googleEventId` grava `googleEventId`/`googleEtag` antes de decidir.

## 6. Front (`frontend/src/types.ts`)
No tipo do compromisso: `hasConflict?: boolean`, `isPrivate?: boolean`, `createdVia` aceitando `'GOOGLE'` se for união de literais.

## 7. Testes novos
- `conflict.service.spec.ts` (casos da seção 2).
- `appointments.service.spec.ts`: `findAllForCalendar` mascara para quem não é dono e não mascara para o dono; `create` chama `recalculateCalendar`;
  não-dono não altera título de privado.
- `google-pull.service.spec.ts`: `visibility: 'private'` grava `isPrivate` e auditoria "Compromisso privado"; convite recusado cancela;
  job PENDING com Google mais novo → job vira DONE e o evento é aplicado; job PENDING com local mais novo → ignorado; job PROCESSING → ignorado;
  `recalculateCalendar` chamado quando houve mudança e não chamado quando tudo foi ignorado.

## Critérios de aceite
- `npm run lint`, `npm run build`, `npm test` do backend passam (o orquestrador roda).

## Não alterar
- `google-sync.worker.ts`, `google-sync-queue.service.ts`, `notification.worker.ts`, `all-day.util.ts`, o restante do front, as migrations existentes.
