# 07 — Testes, métricas, Docker e documentação

## Arquivos
- NOVO `backend/src/notifications/bot.service.spec.ts`
- NOVO `backend/src/telegram/telegram-link.service.spec.ts`
- NOVO `backend/jest.config.js` (se não houver config Jest no package.json)
- `backend/src/monitoring/metrics.service.ts`
- `docker-compose.yml`, `.env.example`, `README.md`

## Passos
1. Testes unitários (Prisma e TelegramService mockados):
   - parser: "Marcar Dentista amanhã às 15:30", "Reunião 30/12/2026 às 09:00", sem horário → 09:00.
   - "oi" não cria compromisso; usuário não vinculado recebe pedido de vínculo.
   - link: código válido vincula; repetido, expirado e inexistente falham.
2. Métricas Prometheus: `vidaemdia_telegram_updates_received_total` e `vidaemdia_telegram_api_errors_total`.
3. `docker-compose.yml` e `.env.example`: novas vars da tarefa 03 (`TELEGRAM_MODE` padrão `mock`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_WEBHOOK_URL`, `TELEGRAM_WEBHOOK_SECRET`); remover `TELEGRAM_MOCK_MODE`; WhatsApp com `false`.
4. `nginx.conf`: garantir que `/telegram/webhook` é repassado ao backend (se o nginx faz proxy da API).
5. `README.md`: seção "Configurando o bot do Telegram" (BotFather, `.env`, modo polling local, modo webhook com ngrok/cloudflared + `setWebhook`, como vincular a conta). Atualizar textos que citam WhatsApp como ativo.

## Critérios de aceite
- `npm test` e `npm run build` passam no backend.
- `docker compose config` valida sem erro.

## NÃO alterar
- Lógica de negócio já aprovada nas tarefas anteriores.

## Complementos (definidos após a tarefa 06)
- NÃO alterar `nginx.conf`: ele já repassa `/api/*` ao backend, então o webhook fica em `/api/telegram/webhook` via nginx ou `/telegram/webhook` direto na porta 3000. Só documentar no README.
- Criar `.gitattributes` na raiz com: `* text=auto`, `*.sh text eol=lf`, `*.ps1 text eol=crlf` (os scripts de backup rodam em container Linux).
- Jest: criar `backend/jest.config.js` com `preset: 'ts-jest'`, `testEnvironment: 'node'`, `rootDir: 'src'`, `testRegex: '.*\.spec\.ts$'`. ts-jest já está instalado; sem npm install.
- Testes do BotService: instanciar com mocks simples (objetos com `jest.fn()`) para PrismaService, AppointmentsService, TelegramService e TelegramLinkService; não subir módulo Nest nem banco. Testar o parser chamando `parseNaturalLanguageAppointment` e checando título, dia e hora (rodar com `TZ=America/Sao_Paulo`; usar datas relativas a `new Date()` ou `jest.useFakeTimers().setSystemTime(...)`).
- Testes do TelegramLinkService: mock de `prisma.telegramLinkToken.findUnique`, `prisma.$transaction` (executa o callback com um `tx` mockado) e `auditService.log`.
- Métricas: seguir o padrão existente em `metrics.service.ts`; incrementar `telegram_updates_received_total` em `TelegramService.dispatchUpdate` e `telegram_api_errors_total` nos erros do `sendMessage`/polling. Se `MetricsService` não for global, importar `MonitoringModule` em `telegram.module.ts`.
- Script `test` do package.json: manter `jest`; adicionar `"test:unit": "jest --runInBand"` se ajudar. No Windows, `TZ` via `cross-env` NÃO está instalado: definir `process.env.TZ = 'America/Sao_Paulo'` no topo do `jest.config.js`.
- README: substituir referências a WhatsApp como canal ativo por Telegram (mencionar que WhatsApp está desligado por `WHATSAPP_ENABLED=false`), e atualizar a seção do chatbot (o simulador agora exige login e o bot real é o @ do `.env`). Não colocar token nem username real no README.

Arquivos adicionais permitidos nesta tarefa: `.gitattributes`, `backend/jest.config.js`, `backend/package.json` (só scripts), `backend/src/telegram/telegram.service.ts`, `backend/src/telegram/telegram.module.ts`.
