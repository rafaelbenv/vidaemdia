# 79 — Polling do Telegram mais tolerante a quedas de conexão

## Problema

No Docker local, o `getUpdates` (long polling de 30 s) cai com `fetch failed` cerca de 7 vezes por hora. É uma conexão longa derrubada pela rede (comum com NAT/Wi-Fi); a próxima tentativa funciona. Hoje cada queda:
- espera 5 s antes de tentar de novo;
- registra `ERROR` no log sem a causa real (o `fetch` do Node guarda o motivo em `err.cause`, ex.: `ECONNRESET`, `UND_ERR_SOCKET`, `ETIMEDOUT`);
- soma 1 em `vidaemdia_telegram_api_errors_total`, e o alerta `ErrosApiTelegram` dispara com mais de 5 em 15 minutos, o que pode acontecer sem nenhum problema real.

## Arquivos envolvidos (só estes)

- `backend/src/telegram/telegram.service.ts`
- `backend/src/telegram/telegram.service.spec.ts` (novo, se não existir; se existir, só acrescentar testes)

## Passos

### 1. Causa no log

Função local `describeFetchError(err: any): string` que devolve `err.message` seguido da causa quando houver: `fetch failed (ECONNRESET: socket hang up)`, usando `err.cause?.code` e `err.cause?.message`. Usar sempre com `maskTelegramToken(...)`, como hoje.

### 2. Quedas de rede no polling

No `catch` do loop de polling (não mexer no `AbortError`, que continua encerrando o loop):
- Considerar **falha de rede** quando `err` for `TypeError` com `message === 'fetch failed'`, ou quando `err.cause?.code` estiver em `['ECONNRESET', 'ETIMEDOUT', 'EPIPE', 'ECONNREFUSED', 'EAI_AGAIN', 'ENOTFOUND', 'UND_ERR_SOCKET', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_BODY_TIMEOUT']`.
- Guardar no service um contador `consecutiveNetworkFailures` (zera depois de qualquer `getUpdates` com sucesso).
- **Primeira** falha de rede seguida: `logger.warn('Conexão do polling do Telegram caiu (<causa>); tentando de novo em 1 s.')`, **sem** incrementar a métrica, e esperar 1 s.
- A partir da **segunda** falha seguida: comportamento de hoje (`logger.error` com a causa, `incrementTelegramApiError()`), com espera crescente de 5 s, 10 s, 20 s, no máximo 30 s.
- Erros que não são de rede (HTTP diferente de 200, `ok: false`): comportamento de hoje (error + métrica + 5 s), e também zeram o contador de rede.

### 3. Testes

Testar o loop é difícil; extrair a decisão para métodos testáveis:
- `isNetworkError(err: any): boolean` (exportado como função do arquivo) e `describeFetchError`.
- Um método privado/protegido `handlePollingError(err)` que devolve `{ delayMs, countMetric, level: 'warn' | 'error' }` e atualiza o contador; o loop só usa o retorno.

Testes:
- `isNetworkError`: `TypeError('fetch failed')` → true; erro com `cause.code = 'ECONNRESET'` → true; `Error('Telegram getUpdates HTTP 409: ...')` → false.
- `describeFetchError` inclui o código e a mensagem da causa.
- `handlePollingError`: 1ª falha de rede → `{ level: 'warn', countMetric: false, delayMs: 1000 }`; 2ª → `error`, `true`, `5000`; 3ª → `10000`; muitas → no máximo `30000`; erro não de rede → `error`, `true`, `5000` e zera o contador.
- O contador zera quando um `getUpdates` dá certo (testar pelo método que o loop chama em caso de sucesso, ex. `resetPollingFailures()`).

Para instanciar o service no teste, seguir o padrão dos outros specs do projeto (mock do `MetricsService` e demais dependências do construtor).

## Critérios de aceite

- `npx jest`, `npx tsc --noEmit` e `npm run lint` sem erros.
- Nenhuma mudança de comportamento fora do `catch` do polling.

## O que NÃO alterar

- `sendMessage`, webhook, modo mock, `dispatchUpdate` e qualquer arquivo fora da lista. Não mexer em `alerts.yml`.
