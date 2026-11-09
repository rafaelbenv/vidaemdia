# 04 — BotService: lógica do chatbot independente do canal

## Objetivo
Tirar a lógica do chatbot do controller, identificar usuários **somente pelo chat_id** e responder no próprio Telegram.

## Arquivos
- NOVO `backend/src/notifications/bot.service.ts`
- `backend/src/notifications/bot-webhook.controller.ts`
- `backend/src/notifications/notifications.module.ts`
- `backend/src/telegram/telegram.module.ts` (import circular: usar o padrão `onUpdate` da tarefa 03, registrado no `onModuleInit` do BotService)

## Passos
1. Mover `parseNaturalLanguageAppointment` e a lógica de `/agenda` e criação para `BotService.handleMessage({ channel, chatId, text, ip? }): Promise<string>` (retorna o texto da resposta em HTML).
2. Busca do usuário: `prisma.user.findFirst({ where: { telegramChatId: chatId } })`. **Remover** a busca por e-mail e telefone.
3. Comandos:
   - `/start` sem código → boas-vindas + instruções para vincular pelo site.
   - `/start <codigo>` → chamar `TelegramLinkService.consume(codigo, chatId)` (criado na tarefa 05; nesta tarefa deixar um TODO e responder "vínculo em breve").
   - `/agenda` ou "agenda" → próximos 5 compromissos SCHEDULED a partir de agora (`startTime >= now`).
   - `/ajuda` → lista de comandos e exemplos.
   - Texto livre começando com marcar/agendar/criar → cria compromisso (lógica atual). Outro texto → mensagem de ajuda (não criar compromisso por engano).
   - Usuário não vinculado → mensagem pedindo para vincular.
4. Na criação: `reminderMinutesBefore` = 30 (não 0); se a data cair no passado, responder erro sem criar. Capturar `ConflictException` do AppointmentsService e responder "Conflito de horário".
5. Registrar `BotService` no `TelegramService.onUpdate`: para cada `update.message.text`, chamar `handleMessage` e enviar a resposta via `TelegramService.sendMessage(chat.id, resposta)`.
6. Manter `POST /notificacoes/bot/webhook` como **simulador** protegido por `JwtAuthGuard`: recebe `{ text }`, usa o `telegramChatId` do usuário logado (ou o id dele prefixado `sim:` se não vinculado) e retorna `{ botReply }`. Renomear o summary no Swagger para "Simulador do chatbot".

## Critérios de aceite
- `npm run build` passa.
- Nenhum caminho do bot aceita e-mail como identificação.
- Mensagem "oi" não cria compromisso.

## NÃO alterar
- Worker, provider, frontend, schema.

## Complementos (definidos após a tarefa 03)
- `TelegramModule` é `@Global()`: injetar `TelegramService` direto no `BotService`; não importar `TelegramModule` em `NotificationsModule` nem alterar `telegram.module.ts`.
- Respostas do bot em HTML: escapar todo dado do usuário/banco com `escapeHtml` (de `../telegram/telegram.service`); usar `<b>`/`<i>`, nunca `*`/`_`.
- Datas/horas nas respostas: `toLocaleDateString/TimeString('pt-BR', { timeZone: process.env.APP_TIMEZONE || 'America/Sao_Paulo', ... })`.
- Parser de data: os valores digitados ("amanhã às 15:30") são horário de Brasília. Montar a data assumindo o fuso `APP_TIMEZONE` (no Docker `TZ=America/Sao_Paulo` já resolve; não adicionar bibliotecas).
- Mensagens sem `text` (foto, figurinha) → responder com a ajuda.

## Correção pós-revisão (rodada 2)
Motivo: em JS sem flag `u`, `\b` não reconhece letras acentuadas. "Marcar Dentista amanhã às 15:30" não detecta "amanhã" e o título sai "Dentista amanhã às".

Arquivo: SOMENTE `backend/src/notifications/bot.service.ts`.
1. Em `parseNaturalLanguageAppointment`, trocar todo `\b` que encosta em palavras com acento por limites explícitos:
   - detecção: `/(^|\s)amanh[aã](?=\s|$|[.,!?])/i` e `/(^|\s)hoje(?=\s|$|[.,!?])/i`
   - limpeza do título: `.replace(/(^|\s)(hoje|amanh[aã])(?=\s|$|[.,!?])/gi, ' ')` e `.replace(/(^|\s)[aà]s\s*\d{1,2}[:h]\d{2}(?=\s|$|[.,!?])/gi, ' ')`
2. Em `getHelpMessage`, trocar o exemplo "Agendar Reunião de Projeto sexta às 10:00" por "Agendar Reunião de Projeto hoje às 18:00" (o parser não entende dias da semana).
3. Esperado: "Marcar Dentista amanhã às 15:30" → título "Dentista", amanhã 15:30; "Agendar Reunião hoje às 18:00" → título "Reunião"; "Criar Prova 30/11/2026 às 14:00" → título "Prova".
4. Não alterar mais nada.
