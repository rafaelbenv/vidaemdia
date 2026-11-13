# 60 — Google Agenda, parte 3: o que muda no VidaEmDia vai para o Google (roteiro 8.3)

Depende dos planos 58 e 59. Referência: seções 2.4 e 2.6 do `.plans/29-google-agenda-analise.md`.
Não execute comandos de terminal. Use só ferramentas de arquivo. **A migration é gerada pelo orquestrador depois.**

## Como funciona
1. Criar, alterar ou cancelar um compromisso numa agenda ligada ao Google grava um **pedido de sincronização** na fila (tabela `google_sync_jobs`),
   na mesma operação do compromisso. A requisição do usuário não espera o Google.
2. Um worker (a cada minuto) reserva os pedidos (mesmo padrão do worker de lembretes, plano 49), chama o Google e grava o resultado. Falhou → tenta de novo depois.
3. Decisão do usuário (plano 29, 2.6 item 3): o evento vai para o Google **com os lembretes padrão do Google** (`reminders.useDefault: true`); a pessoa recebe nos dois lugares.

## Arquivos
- Editar: `backend/prisma/schema.prisma`, `backend/src/appointments/appointments.service.ts`, `backend/src/appointments/appointments.module.ts`,
  `backend/src/google/google.module.ts`, `backend/src/google/google-calendar-link.service.ts`, `backend/src/monitoring/metrics.service.ts`, `frontend/src/types.ts`
- Criar: `backend/src/google/google-sync-queue.service.ts`, `backend/src/google/google-sync.worker.ts`, `backend/src/google/google-event.mapper.ts` e specs de cada um

## Passos

### 1. Schema
- `Appointment`: `googleEventId String? @map("google_event_id")`, `googleSyncError String? @map("google_sync_error")`, `googleSyncedAt DateTime? @map("google_synced_at")`.
- Novo:
```prisma
enum GoogleSyncOperation { UPSERT DELETE }
enum GoogleSyncStatus { PENDING PROCESSING DONE FAILED }
model GoogleSyncJob {
  id            String              @id @default(uuid())
  appointmentId String              @map("appointment_id")
  operation     GoogleSyncOperation
  status        GoogleSyncStatus    @default(PENDING)
  retryCount    Int                 @default(0) @map("retry_count")
  nextRetryAt   DateTime?           @map("next_retry_at")
  lastError     String?             @map("last_error")
  claimedAt     DateTime?           @map("claimed_at")
  claimedBy     String?             @map("claimed_by")
  createdAt     DateTime            @default(now()) @map("created_at")
  updatedAt     DateTime            @updatedAt @map("updated_at")
  appointment Appointment @relation(fields: [appointmentId], references: [id], onDelete: Cascade)
  @@index([status, nextRetryAt])
  @@map("google_sync_jobs")
}
```
  `Appointment` ganha `googleSyncJobs GoogleSyncJob[]`.

### 2. `google-sync-queue.service.ts` (exportado pelo `GoogleModule`)
`enqueue(appointmentId, operation, tx?)`: se já existe um job **PENDING** do mesmo compromisso, atualiza a `operation` dele (o último pedido vale) e zera `nextRetryAt`;
senão cria um novo. Aceita um `tx` (cliente de transação do Prisma) opcional.
`enqueueCalendar(calendarId)`: enfileira `UPSERT` para os compromissos `SCHEDULED` da agenda com `endTime >= agora - 1 dia` (carga inicial ao ligar).
`dropCalendar(calendarId)`: apaga os jobs PENDING dos compromissos da agenda e zera `googleEventId`, `googleSyncError` e `googleSyncedAt` deles (ao desligar).

### 3. Compromissos (`appointments.service.ts`)
Depois de gravar (em `create`, `update` e no `cancel`, que passa por `update`): se a agenda tem `googleCalendarId`, `enqueue(id, status === CANCELLED ? 'DELETE' : 'UPSERT')`.
O compromisso criado pelo bot do Telegram entra sozinho (usa `create`). Importar o `GoogleModule` no `AppointmentsModule` (cuidar para não criar dependência circular;
o `GoogleSyncQueueService` só depende do `PrismaService`).

### 4. Ligar/desligar (`google-calendar-link.service.ts`)
`afterLink` → `queue.enqueueCalendar(calendarId)`; `afterUnlink` → `queue.dropCalendar(calendarId)`.

### 5. `google-event.mapper.ts`
`toGoogleEvent(appt)` → `{ summary: title, description: description ?? undefined, start: { dateTime: startTime.toISOString(), timeZone: 'America/Sao_Paulo' },
end: { dateTime: endTime.toISOString(), timeZone: 'America/Sao_Paulo' }, reminders: { useDefault: true }, extendedProperties: { private: { vidaemdiaId: appt.id } } }`.

### 6. `google-sync.worker.ts`
- `@Cron('*/1 * * * *')` e método público `processQueue()` (para testes), com a trava `isRunning` e `instanceId` como no worker de lembretes.
- Recupera reservas esquecidas (PROCESSING com `claimedAt` há mais de 5 min → PENDING).
- Busca até 50 jobs `PENDING` com `nextRetryAt` nulo ou vencido, mais antigos primeiro; reserva cada um com `updateMany` condicional (`count === 0` → pula).
- Para cada job reservado, carrega o compromisso com a agenda:
  - agenda sem `googleCalendarId` → `DONE` (nada a fazer);
  - token: `googleAccountService.getAccessToken(calendar.ownerId)`; sem conta → `FAILED`, `lastError` "O dono da agenda não tem o Google conectado.";
  - `UPSERT` (e o compromisso não está cancelado): com `googleEventId` → `patchEvent`; se o Google responder 404 ou 410, cai para `insertEvent`. Sem `googleEventId` → `insertEvent`.
    Grava `googleEventId` (do retorno), `googleSyncedAt = agora`, `googleSyncError = null`.
  - `DELETE` (ou `UPSERT` de compromisso cancelado): com `googleEventId` → `deleteEvent` (404/410 contam como sucesso); sem `googleEventId` → nada. Grava `googleSyncedAt`.
  - Sucesso → job `DONE`, reserva limpa; métrica `incrementGoogleSync('ok')`.
  - Falha → `retryCount + 1`; até 5 tentativas volta a `PENDING` com `nextRetryAt` em 1, 5, 15, 30 min; na 5ª → `FAILED`. Em qualquer falha grava `appointment.googleSyncError`
    com uma mensagem curta em português ("Não foi possível enviar ao Google: <motivo>"). `GoogleInvalidGrantError` → `FAILED` direto com "Conexão com o Google expirou; conecte de novo."
    Métrica `incrementGoogleSync('erro')`.
- Integração não configurada → o ciclo não faz nada.

### 7. Métricas (`metrics.service.ts`)
Contadores `vidaemdia_google_sync_total{result="ok"|"erro"}` e o método `incrementGoogleSync(result)`; incluir no texto do Prometheus.

### 8. Front (`types.ts`)
`Appointment` ganha `googleEventId?: string | null`, `googleSyncError?: string | null`, `googleSyncedAt?: string | null` (usados no plano 61).

### 9. Testes (mocks)
- Fila: `enqueue` cria; com job PENDING existente, atualiza a operação; `enqueueCalendar` só pega SCHEDULED recentes; `dropCalendar` apaga PENDING e zera os campos.
- Compromissos: criar/alterar/cancelar numa agenda ligada enfileiram `UPSERT`/`UPSERT`/`DELETE`; agenda não ligada não enfileira.
- Worker: insert sem `googleEventId` grava o id devolvido; patch com id; patch 404 → insert; delete 404 conta como sucesso; reserva perdida pula;
  falha com tentativas sobrando → PENDING com `nextRetryAt`; 5ª falha → FAILED e `googleSyncError`; `invalid_grant` → FAILED direto; agenda desligada → DONE.
- Mapper: fuso, `useDefault: true`, `vidaemdiaId`.

## Critérios de aceite
- Build, lint (0 erros) e testes no backend; build e testes do front.

## O que NÃO alterar
- `prisma/migrations/`, worker de lembretes, telas do front (plano 61).

## Correção após revisão
Dois testes em `backend/src/google/google-sync-queue.service.spec.ts` ("alterar compromisso numa agenda ligada enfileira UPSERT" e "… NÃO ligada não enfileira") falham com `Cannot read properties of undefined (reading "deleteMany")`: o mock do Prisma usado nesses testes não tem `reminder`. Acrescentar ao mock `reminder: { deleteMany: jest.fn(), updateMany: jest.fn(), create: jest.fn() }` (resolvendo `{ count: 0 }` / um objeto), sem mudar o que os testes verificam. Só o arquivo de teste muda.
