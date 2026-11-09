# 05 — Vínculo da conta web com o Telegram (link com código)

## Objetivo
O usuário clica em "Conectar Telegram" no site, abre o bot e o `chat_id` é salvo sozinho.

## Fluxo
1. Usuário logado → `POST /telegram/link` → backend gera código aleatório (32 chars, `crypto.randomBytes(16).toString('hex')`), válido por 10 min, uso único.
2. Resposta: `{ url: "https://t.me/<TELEGRAM_BOT_USERNAME>?start=<codigo>", expiresAt }`.
3. Usuário abre o link → Telegram envia `/start <codigo>` ao bot.
4. Bot valida o código → grava `user.telegramChatId = chat.id` → responde "Conta vinculada, <nome>!".

## Arquivos
- `backend/prisma/schema.prisma` (novo model)
- NOVO `backend/src/telegram/telegram-link.service.ts`
- NOVO `backend/src/telegram/telegram-link.controller.ts`
- `backend/src/notifications/bot.service.ts` (trocar o TODO da tarefa 04)
- `backend/src/auth/auth.service.ts` (perfil passa a expor `telegramLinked: boolean`)

## Passos
1. Model:
   ```prisma
   model TelegramLinkToken {
     id        String    @id @default(uuid())
     code      String    @unique
     userId    String    @map("user_id")
     expiresAt DateTime  @map("expires_at")
     usedAt    DateTime? @map("used_at")
     createdAt DateTime  @default(now()) @map("created_at")
     user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
     @@map("telegram_link_tokens")
   }
   ```
   Adicionar a relação inversa em `User`. Tornar `User.telegramChatId` `@unique`.
2. `TelegramLinkService.createLink(userId)`, `consume(code, chatId)`:
   - código inexistente, expirado ou usado → erro amigável.
   - se outro usuário já tem esse `chatId`, limpar o dele antes (transação).
   - marcar `usedAt`; gravar audit log `entityType: 'AUTH', action: 'TELEGRAM_LINK'`.
3. Controller (todos com `JwtAuthGuard`): `POST /telegram/link`, `DELETE /telegram/link` (zera `telegramChatId`, audit `TELEGRAM_UNLINK`), `GET /telegram/status` → `{ linked, botUsername }`.
4. `/start <codigo>` no BotService chama `consume`.
5. Remover `telegramChatId` do DTO de registro/edição (não pode mais ser digitado à mão).

## Critérios de aceite
- `npx prisma validate`, `npx prisma db push` e `npm run build` passam.
- Código usado duas vezes → segunda falha. Código após 10 min → falha.

## NÃO alterar
- Frontend (tarefa 06), RBAC.

## Complementos (definidos após a tarefa 04)
- Registrar `TelegramLinkService` e `TelegramLinkController` em `backend/src/telegram/telegram.module.ts` (já `@Global()`), e exportar `TelegramLinkService`. Este arquivo passa a fazer parte da lista.
- Auditoria: injetar `AuditService` (global) e usar `auditService.log({ actorUserId, entityType: 'AUTH', entityId: userId, action: 'TELEGRAM_LINK' | 'TELEGRAM_UNLINK', details })`.
- `GET /telegram/status`: `botUsername` vem de `process.env.TELEGRAM_BOT_USERNAME`. Se não houver username configurado, `POST /telegram/link` responde 503 com mensagem clara.
- Perfil (`getProfile`): manter `telegramChatId` fora da resposta; expor só `telegramLinked: boolean`.
- `consume` deve devolver `{ ok: true, userName }` ou `{ ok: false, reason }`; o BotService monta a resposta em HTML com `escapeHtml`.
- No `BotService`, o `/start <codigo>` substitui o TODO atual. Quem não está vinculado ainda pode usar `/start` e `/ajuda`.
- Usuário logado via JWT: `req.user.id`.
- Validação sem banco rodando: `DATABASE_URL="postgresql://u:p@localhost:5432/db" npx prisma validate` e `npx prisma generate`. NÃO rodar `prisma db push` (será feito na etapa 08).
