# 00 — Visão geral: Telegram real no VidaEmDia

## Decisões (confirmadas com o usuário em 2026-11-08)
- Aproveitar o código atual (NestJS + Prisma + React + Docker + Prometheus/Grafana + backup).
- WhatsApp fica no código, mas **desligado** (`WHATSAPP_ENABLED=false`) e escondido na interface.
- Telegram vira o canal padrão.
- Recebimento de mensagens: **long polling** por padrão; **webhook** opcional via variável de ambiente.
- Vínculo de conta: **link com código** (`t.me/<bot>?start=<codigo>`) — pendente de confirmação final do usuário.

## Estado atual (diagnóstico)
- `notification.provider.ts`: envio Telegram existe (`sendMessage`), mas roda em MOCK por padrão; `parse_mode: Markdown` quebra com títulos que tenham `_`, `*`, `[`.
- `bot-webhook.controller.ts`: o "webhook" recebe um DTO próprio (`senderIdentifier`, `channel`, `text`), **não** o formato `Update` do Telegram, e a resposta só volta no HTTP — nunca é enviada ao chat.
- Falha de segurança: o bot identifica o usuário por **e-mail** digitado (`senderIdentifier`) — qualquer pessoa que souber um e-mail cria compromissos na agenda dela.
- Webhook sem validação de `X-Telegram-Bot-Api-Secret-Token`.
- `@Cron('*/1 * * * *')` fixo; ignora `WORKER_CRON_EXPRESSION`.
- Datas formatadas com `toLocaleString` sem fuso: no container (UTC) os horários saem 3h errados.
- Defaults do banco/seed/DTO apontam para `WHATSAPP`.
- Não é repositório git; `dist/` e `.env` estão na pasta.
- Sem testes automatizados.

## Ordem das tarefas
| # | Arquivo | Resumo | Executor sugerido |
|---|---------|--------|-------------------|
| 01 | 01-preparacao.md | git init, .gitignore, build OK, bot no BotFather (manual) | agy flash-low + usuário |
| 02 | 02-config-telegram-padrao.md | WhatsApp off, Telegram padrão, cron via env, fuso | agy flash-medium |
| 03 | 03-telegram-client.md | TelegramService: envio HTML, polling, webhook com secret | agy flash-high |
| 04 | 04-bot-handler.md | BotService canal-agnóstico, comandos, identificar só por chat_id | agy flash-high |
| 05 | 05-vinculo-conta.md | Código de vínculo + /start + desvincular | agy flash-medium |
| 06 | 06-frontend.md | Botão "Conectar Telegram", esconder WhatsApp | agy flash-medium |
| 07 | 07-testes-docs.md | Testes Jest, métricas, README, .env.example, docker-compose | agy flash-medium |
| 08 | 08-validacao-e2e.md | Teste com bot real (polling e webhook via túnel) | usuário + Opus |

Cada tarefa só começa depois que a anterior foi revisada (diff + `npm run build` + testes).
