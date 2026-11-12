# 49 — Worker reserva o lembrete antes de enviar (roteiro 7.2, item S9)

## Problema
`NotificationWorker.processPendingReminders` busca os lembretes PENDING e envia um a um. A trava `isRunning` só vale dentro de um processo:
com duas réplicas do backend, as duas pegam os mesmos lembretes e a pessoa recebe o aviso em dobro.

## Solução
Cada lembrete é **reservado** com uma atualização condicional no banco (`updateMany` com `status: PENDING` no `where`) antes do envio.
Só quem conseguir a reserva (`count === 1`) envia. Reserva esquecida (processo caiu no meio) volta a PENDING depois de 5 minutos.

Não execute comandos de terminal. Use só ferramentas de arquivo. **A migration é gerada pelo orquestrador depois** (não criar pasta em `prisma/migrations`).

## Arquivos
- Editar: `backend/prisma/schema.prisma`, `backend/src/notifications/notification.worker.ts`,
  `frontend/src/types.ts`, `frontend/src/lib/reminderText.ts`, e onde o front mostrar o status do lembrete nos Bastidores (`frontend/src/pages/LembretesPage.tsx`)
- Criar: `backend/src/notifications/notification.worker.spec.ts`

## Passos

### 1. Schema
- `enum ReminderStatus { PENDING PROCESSING SENT FAILED }` (acrescentar `PROCESSING` entre PENDING e SENT).
- `model Reminder`: `claimedAt DateTime? @map("claimed_at")` e `claimedBy String? @map("claimed_by")`.

### 2. Worker
- Identificador da instância: `private readonly instanceId = `${os.hostname()}-${process.pid}`` (`import * as os from 'os'`).
- No início de cada ciclo (dentro do `try`), **recuperar reservas esquecidas**:
  `reminder.updateMany({ where: { status: PROCESSING, claimedAt: { lt: new Date(Date.now() - 5 * 60 * 1000) } }, data: { status: PENDING, claimedAt: null, claimedBy: null } })`;
  se `count > 0`, `logger.warn` com a quantidade.
- Para cada lembrete da busca atual, **antes** de montar a mensagem:
  ```ts
  const claim = await this.prisma.reminder.updateMany({
    where: { id: reminder.id, status: ReminderStatus.PENDING, OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }] },
    data: { status: ReminderStatus.PROCESSING, claimedAt: new Date(), claimedBy: this.instanceId },
  });
  if (claim.count === 0) { skippedCount++; continue; } // outra instância pegou
  ```
- Nos dois `reminder.update` de resultado (sucesso e falha), acrescentar `claimedAt: null, claimedBy: null`
  (o status final continua SENT, PENDING para nova tentativa ou FAILED, como hoje).
- Se o envio lançar exceção (não só `success: false`), tratar como falha do mesmo jeito (envolver o envio em `try/catch` e cair no ramo de falha),
  para o lembrete não ficar preso em PROCESSING.
- No retorno do ciclo, acrescentar `skipped: skippedCount` e citar na `message` quando for maior que zero ("… N reservado(s) por outra instância").

### 3. Front
- `types.ts`: `ReminderStatus` inclui `'PROCESSING'`.
- `reminderText.ts`: `PROCESSING` → `{ text: 'Enviando lembrete…', tone: 'muted' }`.
- `LembretesPage.tsx`: o selo de status mostra `PROCESSING` como "ENVIANDO" (mesmo estilo dos outros selos técnicos dessa página).

### 4. Testes (`notification.worker.spec.ts`, mocks no estilo de `bot.service.spec.ts`)
- Reserva bem-sucedida (`updateMany` → `{ count: 1 }`) e envio ok → `reminder.update` com `status: SENT`, `claimedAt: null`.
- Reserva perdida (`{ count: 0 }`) → `sendReminderMessage` **não** é chamado; retorno com `skipped: 1`.
- Falha de envio com tentativas sobrando → status `PENDING`, `retryCount + 1`, `nextRetryAt` definido, reserva limpa.
- Falha na última tentativa → `FAILED`.
- Exceção no envio → tratado como falha (não fica PROCESSING).
- Recuperação: o primeiro `updateMany` do ciclo tem `status: PROCESSING` e `claimedAt: { lt: <data> }`.

## Critérios de aceite
- `npm run build`, `npm run lint` (0 erros) e `npm test` no backend; `npm run build` e `npm test` no front.

## O que NÃO alterar
- `prisma/migrations/` (o orquestrador gera), `seed.ts`, controllers, `appointments.service.ts`.
