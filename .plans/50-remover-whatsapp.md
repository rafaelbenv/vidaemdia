# 50 — Remover as sobras do WhatsApp (roteiro 7.3, item S15)

O canal WhatsApp foi desligado no pivô para o Telegram (etapas 01–09), mas sobraram enums, colunas, variáveis, código de envio e textos.
Não execute comandos de terminal. Use só ferramentas de arquivo. **A migration é gerada e ajustada pelo orquestrador depois** (não criar pasta em `prisma/migrations`).

## Decisões (orquestrador, 2026-11-12)
- `enum NotificationChannel` fica só com `TELEGRAM` (mantém o enum e as colunas `preferred_channel`/`channel`; o orquestrador converte dados antigos na migration).
- A coluna `users.phone_whatsapp` sai (só tinha telefones fictícios do seed).
- `appointments.created_via` (texto livre) não muda no banco; os tipos passam a `'WEB' | 'TELEGRAM'`. Registros antigos com "WHATSAPP" continuam como histórico.

## Arquivos
Backend: `prisma/schema.prisma`, `prisma/seed.ts`, `src/notifications/notification.provider.ts`, `src/notifications/notification.worker.ts`,
`src/notifications/bot.service.ts`, `src/notifications/bot-webhook.controller.ts`, `src/monitoring/metrics.service.ts`, `src/appointments/appointments.service.ts`,
`src/appointments/dto/*.ts`, `src/auth/auth.service.ts`, `src/auth/jwt.strategy.ts`, `src/auth/dto/auth.dto.ts`, `src/main.ts`, e os `*.spec.ts` que quebrarem.
Infra/docs: `docker-compose.yml`, `.env.example`, `README.md`.
Front: `src/types.ts`, `src/pages/LembretesPage.tsx`, `src/test/mockApi.ts`.

## Passos
1. **Schema:** `enum NotificationChannel { TELEGRAM }`; remover `phoneWhatsapp` de `User`. Defaults continuam `TELEGRAM`.
2. **Provider:** remover `sendViaWhatsApp`, a lógica de `BOTH` e o parâmetro `phoneWhatsapp`; `sendReminderMessage` envia só pelo Telegram (com o simulador de falha e o `recordLog` como hoje).
   `DispatchedMessageLog.channel` vira `'TELEGRAM'`.
3. **Worker:** não passar mais `phoneWhatsapp`; comentário do fluxo cita só o Telegram.
4. **Bot:** `channel` só `'TELEGRAM'`; remover os ramos `=== 'WHATSAPP'`. No `bot-webhook.controller.ts`, o DTO do simulador aceita só `TELEGRAM` (ou nem recebe canal) e os textos do Swagger citam só o Telegram.
5. **Métricas:** remover `appointmentsCreatedWhatsapp`, `remindersSentWhatsapp` e as linhas `source="WHATSAPP"` / `channel="WHATSAPP"`; `incrementAppointmentCreated(source: 'WEB' | 'TELEGRAM')`.
6. **Compromissos:** canal padrão `NotificationChannel.TELEGRAM` (hoje é `WHATSAPP` — defeito); `createdVia: 'WEB' | 'TELEGRAM'`; tirar `phoneWhatsapp` dos `select`.
7. **Auth:** tirar `phoneWhatsapp` do `RegisterDto`, do `register`, das respostas de login/perfil e do `jwt.strategy`.
8. **Swagger (`main.ts`):** título "VidaEmDia API — Agenda com lembretes no Telegram"; descrição sem WhatsApp.
9. **Seed:** remover `phoneWhatsapp` dos usuários.
10. **Compose e `.env.example`:** remover todas as variáveis `WHATSAPP_*`. **README:** tirar menções ao WhatsApp como canal ativo (pode citar, em uma linha, que o canal foi substituído pelo Telegram).
11. **Front:** `NotificationChannel = 'TELEGRAM'`; tirar `phoneWhatsapp` de `User`; `createdVia: 'WEB' | 'TELEGRAM'`; `DispatchedMessageLog.channel: 'TELEGRAM'`;
    tirar os campos de métricas do WhatsApp; na `LembretesPage`, mostrar `rem.channel` direto (sem a conversão de WHATSAPP/BOTH); ajustar `mockApi.ts`.
12. **Testes:** ajustar os specs que usam WhatsApp para o Telegram (sem diminuir o que eles verificam).

## Critérios de aceite
- `grep -ri whatsapp` em `backend/src`, `frontend/src`, `docker-compose.yml`, `.env.example` não acha nada (exceto, se houver, um comentário histórico no README).
- Build, lint (0 erros) e testes passando no backend e no front.

## O que NÃO alterar
- `prisma/migrations/` (o orquestrador gera), lógica do Telegram, frontend fora dos arquivos listados.
