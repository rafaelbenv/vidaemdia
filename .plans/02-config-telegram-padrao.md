# 02 — Telegram como padrão, WhatsApp desligado, cron e fuso

## Objetivo
Configuração coerente antes de mexer na integração.

## Arquivos
- `backend/prisma/schema.prisma`
- `backend/prisma/seed.ts`
- `backend/src/auth/dto/auth.dto.ts`
- `backend/src/appointments/dto/appointment.dto.ts`
- `backend/src/notifications/notification.provider.ts`
- `backend/src/notifications/notification.worker.ts`
- `docker-compose.yml`, `.env.example`

## Passos
1. `schema.prisma`: `User.preferredChannel` e `Reminder.channel` com `@default(TELEGRAM)`. Não remover o valor `WHATSAPP` do enum.
2. `seed.ts`: todos os usuários e lembretes com `NotificationChannel.TELEGRAM`. Manter `phoneWhatsapp`. Trocar os `telegramChatId` fictícios por `null` (vínculo real virá na tarefa 05), exceto Carlos, que mantém `'100001111'` para demo em modo mock.
3. DTOs: default/exemplo de canal → `TELEGRAM`.
4. `notification.provider.ts`: se `WHATSAPP_ENABLED !== 'true'`, `sendViaWhatsApp` retorna `{ success: false, error: 'Canal WhatsApp desabilitado' }` sem chamar API; canal `BOTH` envia só Telegram quando WhatsApp está desligado.
5. `notification.worker.ts`: trocar `@Cron('*/1 * * * *')` por `@Cron(process.env.WORKER_CRON_EXPRESSION || '*/1 * * * *')`.
6. Fuso: em todo `toLocaleDateString`/`toLocaleTimeString` do worker e do bot, passar `timeZone: process.env.APP_TIMEZONE || 'America/Sao_Paulo'`.
7. `docker-compose.yml` (serviço backend): adicionar `TZ: America/Sao_Paulo`, `APP_TIMEZONE`, `WHATSAPP_ENABLED: ${WHATSAPP_ENABLED:-false}`. Mesmo default em `.env.example`.

## Critérios de aceite
- `npx prisma validate` e `npm run build` passam.
- Nenhuma referência nova a WhatsApp como padrão.

## NÃO alterar
- Lógica de RBAC, calendars, audit, frontend.
