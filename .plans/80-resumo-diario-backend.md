# 80 — Resumo diário da agenda pelo Telegram, no backend

## Objetivo

Todo dia, na hora escolhida pelo usuário (padrão 07:00, fuso de São Paulo), o bot manda pelo Telegram a lista dos compromissos **de hoje**. Vem **ligado por padrão** para quem tem o Telegram vinculado. Em dia sem compromissos, manda uma mensagem curta de "dia livre". Nunca manda duas vezes no mesmo dia, mesmo com mais de uma instância do backend rodando.

## Arquivos envolvidos (só estes)

- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/20261115100000_resumo_diario/migration.sql` (novo)
- `backend/src/notifications/daily-summary.worker.ts` (novo)
- `backend/src/notifications/daily-summary.worker.spec.ts` (novo)
- `backend/src/notifications/notifications.module.ts`
- `backend/src/monitoring/metrics.service.ts`
- `backend/src/auth/dto/auth.dto.ts`
- `backend/src/auth/dto/auth.dto.spec.ts`
- `backend/src/auth/auth.controller.ts`
- `backend/src/auth/auth.service.ts`
- `backend/src/auth/auth.service.spec.ts`

## Passos

### 1. Banco (`schema.prisma` + migração)

No `model User`, logo depois de `preferredChannel`:

```prisma
  dailySummaryEnabled    Boolean  @default(true) @map("daily_summary_enabled")
  dailySummaryHour       Int      @default(7) @map("daily_summary_hour")
  dailySummaryLastSentOn String?  @map("daily_summary_last_sent_on") // 'AAAA-MM-DD' (São Paulo)
```

Migração `20261115100000_resumo_diario/migration.sql`, escrita à mão no mesmo estilo das outras:

```sql
-- AlterTable
ALTER TABLE "users" ADD COLUMN     "daily_summary_enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "daily_summary_hour" INTEGER NOT NULL DEFAULT 7,
ADD COLUMN     "daily_summary_last_sent_on" TEXT;
```

Depois rodar `npx prisma generate` (dentro de `backend/`).

### 2. Métrica (`metrics.service.ts`)

- Contadores novos `dailySummariesSent` e `dailySummariesFailed` (começam em 0).
- Métodos `incrementDailySummarySent()` e `incrementDailySummaryFailed()`.
- No texto Prometheus, seguindo o formato dos outros contadores:
  - `vidaemdia_daily_summaries_sent_total` (HELP: `Total de resumos diários enviados pelo Telegram`)
  - `vidaemdia_daily_summaries_failed_total` (HELP: `Total de falhas ao enviar o resumo diário`)

### 3. Worker (`daily-summary.worker.ts`)

`@Injectable() export class DailySummaryWorker`, com `PrismaService`, `TelegramService` (o mesmo `sendMessage(chatId, text)` usado em `password-reset.service.ts`) e `MetricsService` injetados. **Não alterar `telegram.service.ts`.**

Usar os utilitários de `../appointments/all-day.util`: `toSaoPauloDateString`, `startOfSaoPauloDay`, `addDays`.

Função exportada e pura (para testar): `saoPauloHour(d: Date): number`. Ela devolve a hora 0–23 em `America/Sao_Paulo` via `Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hourCycle: 'h23' })` e `Number(...)`.

Método `@Cron(process.env.DAILY_SUMMARY_CRON_EXPRESSION || '*/5 * * * *') async run(now = new Date())`:

1. Uma flag `isRunning` impede duas execuções simultâneas na mesma instância, como no `NotificationWorker`.
2. `today = toSaoPauloDateString(now)` e `hour = saoPauloHour(now)`.
3. Buscar candidatos: `prisma.user.findMany({ where: { dailySummaryEnabled: true, dailySummaryHour: hour, telegramChatId: { not: null }, OR: [{ dailySummaryLastSentOn: null }, { dailySummaryLastSentOn: { not: today } }] }, select: { id, name, telegramChatId, dailySummaryLastSentOn }, take: 200 })`.
4. Para cada um:
   - **Reservar** com `prisma.user.updateMany({ where: { id, dailySummaryLastSentOn: <valor lido> }, data: { dailySummaryLastSentOn: today } })`. Se `count === 0`, outra instância já pegou: pular. (Quando o valor lido for `null`, o `where` usa `dailySummaryLastSentOn: null`.)
   - Buscar os compromissos de hoje: `dayStart = startOfSaoPauloDay(today)` e `dayEnd = addDays(dayStart, 1)`. `prisma.appointment.findMany({ where: { status: 'SCHEDULED', calendar: { ownerId: user.id }, startTime: { lt: dayEnd }, endTime: { gt: dayStart } }, include: { calendar: { select: { name: true } } }, orderBy: [{ allDay: 'desc' }, { startTime: 'asc' }], take: 30 })`. Assim entram os compromissos de dia inteiro e os de vários dias que cobrem hoje.
   - Montar a mensagem com `buildDailySummaryMessage(name, appointments, today)` (veja abaixo) e enviar com `telegramService.sendMessage(chatId, msg)`.
   - Se der certo: `incrementDailySummarySent()`.
   - Se der erro: `logger.error` com a mensagem, `incrementDailySummaryFailed()` e **desfazer a reserva** com `updateMany({ where: { id, dailySummaryLastSentOn: today }, data: { dailySummaryLastSentOn: <valor lido antes> } })`, para tentar de novo no próximo ciclo (dentro da mesma hora). O erro de um usuário não interrompe os outros.
5. Devolver `{ today, hour, candidates, sent, failed, skipped }`. O `finally` volta `isRunning` para `false`.

Função exportada e pura `buildDailySummaryMessage(name: string, appointments: Array<{ title: string; startTime: Date; endTime: Date; allDay: boolean; calendar: { name: string } }>, today: string): string`:

- Data do cabeçalho: `DD/MM` a partir de `today` (ex.: `'2026-11-16'` vira `16/11`).
- Com compromissos:
  ```
  ☀️ <b>Bom dia, {nome}!</b> Sua agenda de hoje ({DD/MM}):

  • <b>Dia inteiro</b> — {título} <i>({agenda})</i>
  • <b>09:00</b> — {título} <i>({agenda})</i>
  ```
  - Hora em `pt-BR` com `hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo'`. Se o compromisso começou antes de hoje (`startTime < startOfSaoPauloDay(today)`) e não é de dia inteiro, mostrar `<b>Em andamento</b>` no lugar da hora.
  - No fim: `\n\n💡 <i>Para desligar ou mudar o horário, acesse Minha conta no VidaEmDia.</i>`
- Sem compromissos:
  `☀️ <b>Bom dia, {nome}!</b> Você não tem compromissos hoje ({DD/MM}). Dia livre! 🎉` + a mesma linha 💡.
- Passar **todo** texto do usuário (nome, título, nome da agenda) por `escapeHtml` de `../telegram/telegram.service`.

### 4. Módulo (`notifications.module.ts`)

Adicionar `DailySummaryWorker` em `providers`. Se o `TelegramService` ainda não estiver disponível no módulo, importar o módulo que o exporta, do mesmo jeito que o `NotificationProvider` já faz.

### 5. Preferência pela API (auth)

- **DTO** `UpdateDailySummaryDto` (em `auth.dto.ts`):
  - `enabled: boolean` com `@IsBoolean({ message: 'Informe se o resumo diário fica ligado' })`.
  - `hour: number` com `@IsInt({ message: 'A hora deve ser um número inteiro' })`, `@Min(0, …)` e `@Max(23, { message: 'A hora deve estar entre 0 e 23' })`. Usar a mesma mensagem no `@Min`.
  - `@ApiProperty` em ambos (exemplos `true` e `7`).
- **Service** `updateDailySummary(userId, dto, ipAddress?)`:
  - Fazer `prisma.user.update` com `dailySummaryEnabled` e `dailySummaryHour`.
  - Registrar auditoria no mesmo formato do `updateProfile` (`entityType: 'AUTH'`, `action: 'UPDATE'`), com `details`: `Resumo diário ligado às HH:00.` ou `Resumo diário desligado.`.
  - Devolver `this.getProfile(userId)`.
- **`getProfile`**: incluir `dailySummaryEnabled` e `dailySummaryHour` no `select`. Eles saem no retorno sem mudança. **Não** expor `dailySummaryLastSentOn`.
- **Controller**: `@Patch('me/resumo-diario')`, com `@UseGuards(JwtAuthGuard)`, `@ApiBearerAuth()` e `@ApiOperation({ summary: 'Liga/desliga o resumo diário no Telegram e define a hora' })`, chama `updateDailySummary(req.user.sub, dto, req.ip)`.

### 6. Testes

`daily-summary.worker.spec.ts` usa Prisma, Telegram e Metrics simulados com `jest.fn()`, no estilo de `notification.worker.spec.ts`:
- `saoPauloHour(new Date('2026-11-16T10:00:00Z'))` → `7`.
- Envia para o candidato, grava a reserva com `today` e conta `sent`.
- Quando a reserva devolve `count: 0`, não envia e conta `skipped`.
- Quando o `sendMessage` lança erro, desfaz a reserva (2ª chamada de `updateMany` volta o valor anterior), conta `failed`, chama `incrementDailySummaryFailed` e mesmo assim segue para o próximo usuário.
- O `findMany` de usuários é chamado com `dailySummaryHour` igual à hora de São Paulo e `dailySummaryEnabled: true`.
- `buildDailySummaryMessage`:
  - Lista vazia gera o texto com "Dia livre".
  - Compromisso de dia inteiro aparece como "Dia inteiro" antes dos que têm horário.
  - O horário sai em São Paulo: `2026-11-16T12:00:00Z` vira `09:00`.
  - Título com `<b>` é escapado.
  - Compromisso iniciado ontem aparece como "Em andamento".

`auth.dto.spec.ts` (`UpdateDailySummaryDto`): recusa `hour` 24, -1 e 7.5; recusa `enabled` como string `'sim'`; aceita `{ enabled: false, hour: 0 }`.

`auth.service.spec.ts`: `updateDailySummary` grava os dois campos, registra auditoria "Resumo diário ligado às 07:00." (e "desligado" quando `enabled: false`) e devolve o perfil.

## Critérios de aceite

- Dentro de `backend/`, todos passam sem erros:
  - `npx prisma generate`
  - `npx tsc --noEmit`
  - `npm run lint`
  - `npm test`
- A migração só adiciona as três colunas. Nenhuma outra tabela muda.

## O que NÃO alterar

- `backend/src/telegram/telegram.service.ts` (está com mudanças de outro plano, o 79).
- `README.md`, os arquivos de `frontend/`, `infra/` e `.plans/` (exceto este).
- O `NotificationWorker` e o fluxo de lembretes atuais.
- Nenhuma migração antiga.
