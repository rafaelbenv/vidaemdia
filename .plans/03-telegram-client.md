# 03 — TelegramService (envio, polling e webhook)

## Objetivo
Uma camada única para conversar com a Bot API do Telegram, sem biblioteca externa (usar `fetch` nativo do Node 20).

## Arquivos
- NOVO `backend/src/telegram/telegram.service.ts`
- NOVO `backend/src/telegram/telegram.module.ts`
- NOVO `backend/src/telegram/telegram.types.ts` (tipos mínimos: `TelegramUpdate`, `TelegramMessage`, `TelegramChat`)
- `backend/src/notifications/notification.provider.ts` (usar o novo service em `sendViaTelegram`)
- `backend/src/app.module.ts`

## Variáveis de ambiente
| Var | Valores | Padrão |
|-----|---------|--------|
| `TELEGRAM_MODE` | `mock` \| `polling` \| `webhook` | `mock` |
| `TELEGRAM_BOT_TOKEN` | token do BotFather | — |
| `TELEGRAM_BOT_USERNAME` | username sem @ | — |
| `TELEGRAM_WEBHOOK_URL` | URL pública HTTPS (só modo webhook) | — |
| `TELEGRAM_WEBHOOK_SECRET` | string aleatória | — |
Substitui `TELEGRAM_MOCK_MODE` (manter compatibilidade: se `TELEGRAM_MODE` ausente e `TELEGRAM_MOCK_MODE=false`, usar `polling`).

## Passos
1. `TelegramService.sendMessage(chatId, text)`: POST `https://api.telegram.org/bot<token>/sendMessage` com `parse_mode: 'HTML'`. Exportar helper `escapeHtml(s)` (`&`, `<`, `>`). Em erro HTTP, lançar `Error` com status e `description` da resposta. Em modo `mock`, só logar e retornar sucesso.
2. Handler de updates: o service expõe `onUpdate(handler: (u: TelegramUpdate) => Promise<void>)` para a tarefa 04 registrar.
3. Modo `polling` (em `onModuleInit`): chamar `deleteWebhook`, depois loop assíncrono `getUpdates?timeout=30&offset=<último update_id + 1>&allowed_updates=["message"]`. Erro → log + espera 5 s e continua. Parar o loop em `onModuleDestroy` (flag + AbortController).
4. Modo `webhook` (em `onModuleInit`): chamar `setWebhook` com `url=TELEGRAM_WEBHOOK_URL`, `secret_token=TELEGRAM_WEBHOOK_SECRET`, `allowed_updates=["message"]`.
5. NOVO controller `backend/src/telegram/telegram-webhook.controller.ts`: `POST /telegram/webhook`. Rejeitar com 401 se header `x-telegram-bot-api-secret-token` ≠ `TELEGRAM_WEBHOOK_SECRET`. Responder 200 rápido e processar o update.
6. Nunca logar o token (mascarar URLs em logs de erro).
7. `notification.provider.ts`: `sendViaTelegram` delega ao `TelegramService`; mensagens do worker passam a usar HTML (`<b>`, `<i>`) com títulos/descrições escapados. Se o usuário não tiver `telegramChatId`, retornar falha `'Usuário sem Telegram vinculado'` (remover o fallback `'100000000'`).

## Critérios de aceite
- `npm run build` passa.
- Com `TELEGRAM_MODE=mock`, o backend sobe sem token e sem chamadas externas.
- Webhook sem o header correto → 401.

## NÃO alterar
- `bot-webhook.controller.ts` (fica para a tarefa 04), frontend.

## Correção pós-revisão (rodada 2)
Motivo: `formatTelegramHtmlMessage` converte `*`/`_` depois de escapar e deixa passar a mensagem sem escapar se ela contiver `<b>`. Título com `_` vira itálico errado; título com `<b>` quebra o HTML e o lembrete falha.

Arquivos: `backend/src/notifications/notification.worker.ts`, `backend/src/notifications/notification.provider.ts`.
1. Worker: montar `messageText` direto em HTML, escapando cada dado com `escapeHtml` (importar de `../telegram/telegram.service`):
   `🔔 <b>Lembrete VidaEmDia</b>\n${escapeHtml(appt.title)} em ${dateFormatted} às ${timeFormatted}.\n` + (descrição ? `📝 <i>${escapeHtml(appt.description)}</i>\n` : '') + `📂 Agenda: ${escapeHtml(appt.calendar.name)}`
2. Provider: remover `formatTelegramHtmlMessage` e enviar `message` sem transformação (o texto já chega pronto em HTML).
3. Não alterar mais nada.
