# 38 — Backend: edição segura e opções de lembrete (roteiro 4.2, parte backend; itens B1, B6, C9)

O painel de criar e editar do passo 4.2 precisa de quatro coisas que o backend ainda não faz direito. Sem mudança no banco (o 7.1 ainda não existe).
Não execute comandos de terminal. Use só ferramentas de arquivo.

## Decisões (orquestrador, 2026-11-12)
- **`reminderMinutesBefore = 0` passa a significar "na hora do compromisso"** (`remindAt = startTime`).
  Hoje significa "dispara já" (`now - 5s`). Para compromisso que já começou, o efeito é o mesmo (o worker pega no próximo ciclo);
  para compromisso futuro, o lembrete sai na hora certa. O formulário antigo que usava "Imediato" sai no 4.2.
- **Sem lembrete:** novo campo opcional `reminderEnabled?: boolean` (padrão `true`) nos DTOs de criar e alterar.
  Sem lembrete = nenhum `Reminder` PENDING para o compromisso. `reminderMinutesBefore` continua gravado (padrão do formulário ao reativar).

## Arquivos
- Editar: `backend/src/appointments/appointments.service.ts`, `backend/src/appointments/dto/appointment.dto.ts`
  (ou o arquivo de DTO que existir em `backend/src/appointments/dto/`)
- Criar: `backend/src/appointments/appointments.service.spec.ts`

## Passos

### 1. DTOs
- `CreateAppointmentDto` e `UpdateAppointmentDto`: `@ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean() reminderEnabled?: boolean;`
- Descrição de `reminderMinutesBefore`: "Minutos de antecedência do lembrete (0 = na hora do compromisso; máx. 10080 = 7 dias)".
- `UpdateAppointmentDto.reminderMinutesBefore`: acrescentar `@Max(10080)` (igual ao de criar).

### 2. Cálculo do horário do lembrete (função privada única)
```ts
private computeRemindAt(startTime: Date, minutesBefore: number): Date {
  return new Date(startTime.getTime() - minutesBefore * 60 * 1000);
}
```
Usar em `create` e `update` no lugar das duas expressões com `Date.now() - 5000`. Atualizar o comentário que fala em "disparo imediato".

### 3. `create`
- Se `dto.reminderEnabled === false`, criar o compromisso **sem** o `reminders: { create: ... }`.
- Restante igual (o canal padrão continua o que está lá).

### 4. `update`
a) **Término coerente:** se `dto.startTime` vier e `dto.endTime` não, manter a duração original:
   `endTime = new Date(startTime.getTime() + (existing.endTime.getTime() - existing.startTime.getTime()))`.
   Depois de calcular, se `endTime <= startTime` → `BadRequestException('O horário de término deve ser posterior ao horário de início')`.
b) **Conflito de horário na edição:** se a operação é `UPDATE` (não cancelamento), a agenda é `PROFESSIONAL` e o horário mudou,
   repetir a checagem de `create` excluindo o próprio compromisso (`id: { not: appointmentId }`), com a mesma mensagem.
c) **Lembrete** (só quando a operação é `UPDATE`):
   - `const enabled = dto.reminderEnabled ?? existing.reminders.some(r => r.status === 'PENDING' || r.status === 'SENT' || r.status === 'FAILED');`
     (sem informação nova, mantém como estava: tem lembrete quem já tinha algum).
   - `enabled === false` → `reminder.deleteMany({ where: { appointmentId, status: PENDING } })`.
   - `enabled === true` e (`dto.startTime` ou `dto.reminderMinutesBefore !== undefined` ou `dto.reminderEnabled === true` ou `dto.reminderChannel`):
     - Se existe lembrete PENDING → `updateMany` com o novo `remindAt` (e canal, se veio), como hoje.
     - Se não existe PENDING → `reminder.create` com `remindAt` novo, canal (`dto.reminderChannel` ou o do lembrete mais recente ou `TELEGRAM`) e status PENDING.
d) A resposta passa a incluir os lembretes atualizados: depois das alterações, buscar de novo o compromisso com
   `include: { createdBy: {...}, reminders: { orderBy: { createdAt: 'desc' } } }` e devolver esse objeto.
e) Auditoria igual; acrescentar em `metadata.before`/`after` o `endTime`.

### 5. Testes (`appointments.service.spec.ts`, com mocks, no estilo de `bot.service.spec.ts`)
Construtor do service: conferir no arquivo a ordem das dependências (prisma, calendarAccess, auditService, metricsService).
- `create` com `reminderMinutesBefore: 0` → `remindAt` igual ao `startTime`.
- `create` com `reminderMinutesBefore: 1440` → `remindAt` 24 h antes.
- `create` com `reminderEnabled: false` → `prisma.appointment.create` chamado sem a chave `reminders` em `data`.
- `update` mudando só `startTime` → `endTime` mantém a duração.
- `update` com `endTime` antes do `startTime` → `BadRequestException`.
- `update` em agenda PROFESSIONAL com conflito → `BadRequestException`; a busca de conflito exclui o próprio id.
- `update` com `reminderEnabled: false` → `reminder.deleteMany` com status PENDING.
- `update` mudando `startTime` sem lembrete PENDING (só um SENT) → `reminder.create` chamado.
- `cancel` → não mexe em lembretes e não checa conflito.

## Critérios de aceite
- `npm run build`, `npm run lint` (0 erros) e `npm test` passando no backend.

## O que NÃO alterar
- Schema do Prisma, worker, bot, controllers (a não ser que o DTO precise de import), frontend.

## Correção após revisão (devolvido ao executor)
Problema: o painel do front envia sempre `startTime` e `reminderMinutesBefore` ao salvar, mesmo sem mudança.
Com lembrete já enviado (SENT) e nenhum PENDING, salvar só uma troca de título cria um lembrete novo e a pessoa recebe o aviso de novo.

Ajuste no ramo "não existe PENDING → `reminder.create`" do passo 4c:
- Calcular `minutesChanged = dto.reminderMinutesBefore !== undefined && dto.reminderMinutesBefore !== existing.reminderMinutesBefore`.
- Só entrar no ramo de atualizar/criar se `timeChanged || minutesChanged || dto.reminderEnabled === true || dto.reminderChannel` (usar `timeChanged`, não `dto.startTime`).
- Só **criar** um lembrete novo se: `remindAt > new Date()` **e** nenhum lembrete existente (de qualquer status) tem o mesmo `remindAt` (`getTime()` igual).
- Testes a acrescentar: (1) `update` só com título e mesmo `startTime`/minutos, com um lembrete SENT → `reminder.create` NÃO é chamado;
  (2) `update` movendo o compromisso para o futuro, com um lembrete SENT antigo → `reminder.create` é chamado;
  (3) `update` com `reminderEnabled: true` e `remindAt` já no passado → `reminder.create` NÃO é chamado.
