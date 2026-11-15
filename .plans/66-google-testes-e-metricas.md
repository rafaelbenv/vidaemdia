# 66 — Testes dos clients do Google e métricas de sincronização (roteiro 8.7)

## Objetivo

1. Cobrir com testes unitários os dois clients HTTP do Google (`GoogleCalendarClient` e `GoogleOAuthClient`), simulando o `fetch` global. Nenhum teste pode chamar a rede de verdade.
2. Separar a métrica de sincronização por sentido (envio VidaEmDia → Google e recebimento Google → VidaEmDia) e expor no `/metrics` o tamanho da fila de saída e a hora da última sincronização recebida.
3. Mostrar isso no Grafana e criar dois alertas.

## Arquivos envolvidos (só estes)

Criar:
- `backend/src/google/google-calendar.client.spec.ts`
- `backend/src/google/google-oauth.client.spec.ts`
- `backend/src/monitoring/metrics.service.spec.ts`

Alterar:
- `backend/src/monitoring/metrics.service.ts`
- `backend/src/monitoring/monitoring.controller.ts`
- `backend/src/google/google-sync.worker.ts` (só as chamadas de `incrementGoogleSync`)
- `backend/src/google/google-pull.service.ts` (só as chamadas de `incrementGoogleSync`)
- `backend/src/google/google-sync.worker.spec.ts` (só os `toHaveBeenCalledWith` de `incrementGoogleSync`)
- `backend/src/google/google-pull.service.spec.ts` (só os `toHaveBeenCalledWith` de `incrementGoogleSync`)
- `infra/monitoring/alerts.yml`
- `infra/monitoring/grafana/provisioning/dashboards/vidaemdia.json`

## Passos

### 1. Métrica por sentido (`metrics.service.ts`)

- Trocar os contadores `googleSyncOk` e `googleSyncErro` por quatro: `googleEnvioOk`, `googleEnvioErro`, `googleRecebimentoOk`, `googleRecebimentoErro`.
- Nova assinatura: `incrementGoogleSync(direction: 'envio' | 'recebimento', result: 'ok' | 'erro')`.
- Em `toPrometheusText`, a métrica `vidaemdia_google_sync_total` passa a ter dois rótulos, nesta ordem:
  ```
  vidaemdia_google_sync_total{direction="envio",result="ok"} N
  vidaemdia_google_sync_total{direction="envio",result="erro"} N
  vidaemdia_google_sync_total{direction="recebimento",result="ok"} N
  vidaemdia_google_sync_total{direction="recebimento",result="erro"} N
  ```
  O HELP fica: `Total de sincronizações com o Google Agenda por sentido e resultado`.
- `toPrometheusText` passa a receber um parâmetro opcional:
  ```ts
  export interface GoogleSyncStats {
    queuePending: number;   // jobs com status PENDING
    queueFailed: number;    // jobs com status FAILED
    lastPullAt: Date | null; // maior googleLastSyncAt entre as agendas
  }
  toPrometheusText(google?: GoogleSyncStats): string
  ```
  Exportar a interface do mesmo arquivo. Quando `google` vier, acrescentar (antes do bloco de uptime):
  ```
  # HELP vidaemdia_google_sync_queue Jobs na fila de envio para o Google, por status
  # TYPE vidaemdia_google_sync_queue gauge
  vidaemdia_google_sync_queue{status="PENDING"} N
  vidaemdia_google_sync_queue{status="FAILED"} N

  # HELP vidaemdia_google_last_pull_timestamp_seconds Hora (Unix, segundos) da última sincronização recebida do Google
  # TYPE vidaemdia_google_last_pull_timestamp_seconds gauge
  vidaemdia_google_last_pull_timestamp_seconds N
  ```
  `N` do último é `Math.floor(lastPullAt.getTime() / 1000)`, ou `0` quando `lastPullAt` for `null`.
  Quando `google` não vier, essas linhas não aparecem.
- `getSummary()` continua devolvendo os contadores (agora os quatro novos no lugar dos dois antigos).

### 2. Chamadas existentes

- `google-sync.worker.ts`: `incrementGoogleSync('ok')` → `incrementGoogleSync('envio', 'ok')`; `'erro'` → `('envio', 'erro')`. Corrigir também o comentário da linha que cita `incrementGoogleSync('ok')`.
- `google-pull.service.ts`: as três chamadas viram `('recebimento', 'ok' | 'erro')`.
- Nos dois specs, ajustar só os `toHaveBeenCalledWith` correspondentes (`'ok'` → `'envio', 'ok'` no worker; `'recebimento', ...` no pull). Não mexer em mais nada desses specs.

### 3. Controller (`monitoring.controller.ts`)

- `getPrometheusMetrics` vira `async` e devolve `Promise<string>`.
- Antes de gerar o texto, buscar em paralelo, cada consulta com `.catch` que devolve o valor neutro (0 ou `null`), como já é feito no `healthCheck`:
  - `this.prisma.googleSyncJob.count({ where: { status: 'PENDING' } })`
  - `this.prisma.googleSyncJob.count({ where: { status: 'FAILED' } })`
  - `this.prisma.calendar.aggregate({ _max: { googleLastSyncAt: true } })` → `_max.googleLastSyncAt ?? null`
- Se o Prisma tipado reclamar desses modelos/campos, usar `(this.prisma as any)` como os serviços do Google já fazem.
- Passar o resultado para `toPrometheusText({ queuePending, queueFailed, lastPullAt })`.

### 4. Testes novos

Padrão: `jest.spyOn(global, 'fetch')` com `mockResolvedValue`/`mockResolvedValueOnce` devolvendo objetos `{ ok, status, json: async () => ..., text: async () => ... }` (com `as any`). `afterEach(() => jest.restoreAllMocks())`. Para `googleConfig()`, definir `process.env.GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` e `GOOGLE_REDIRECT_URI` no `beforeEach` e restaurar os valores originais no `afterEach` (ler `google.config.ts` para os nomes exatos das variáveis e não alterá-lo).

`google-calendar.client.spec.ts`, no mínimo:
- `listWritableCalendars`: manda `Authorization: Bearer <token>` e `minAccessRole=writer`; percorre duas páginas (`nextPageToken`) e junta os itens; `primary` ausente vira `false`; `summary` ausente vira `''`.
- `listEvents`: com `syncToken` não manda `timeMin`/`timeMax`; sem `syncToken` manda os dois; sempre manda `singleEvents=true`; repassa `pageToken`; devolve `nextSyncToken`; `items` ausente vira `[]`; o `calendarId` vai codificado na URL (ex.: `a@b.com` → `a%40b.com`).
- Erro 410 em `listEvents` lança `GoogleApiError` com `status` 410 e a mensagem de `error.message` do corpo.
- `insertEvent` usa POST com `Content-Type: application/json` e corpo em JSON; `patchEvent` usa PATCH na URL com o `eventId`; `deleteEvent` usa DELETE.
- Corpo de erro que não é JSON: `json` rejeita e `text` devolve um texto → a mensagem do erro é esse texto.

`google-oauth.client.spec.ts`, no mínimo:
- `buildAuthUrl`: contém `client_id`, `redirect_uri`, `access_type=offline`, `prompt=consent`, `state` e os escopos de `GOOGLE_OAUTH_SCOPES`.
- `exchangeCode`: POST para `https://oauth2.googleapis.com/token` com `grant_type=authorization_code` e `code`; mapeia `access_token`, `refresh_token`, `expires_in`, `scope`, `id_token`; em erro lança `Error` com `error_description`.
- `refreshAccessToken`: sucesso mapeia `accessToken`/`expiresIn`; resposta `{ error: 'invalid_grant' }` lança `GoogleInvalidGrantError`; outro erro lança `Error` comum (e não `GoogleInvalidGrantError`).
- `revoke`: não lança mesmo se o `fetch` rejeitar.
- `emailFromIdToken`: lê o e-mail de um JWT montado no teste (`header.payload.assinatura`, payload em base64url); lança erro para token vazio, com menos de duas partes e sem `email`.

`metrics.service.spec.ts`, no mínimo:
- Após `incrementGoogleSync('envio','ok')` duas vezes e `('recebimento','erro')` uma vez, o texto tem `{direction="envio",result="ok"} 2` e `{direction="recebimento",result="erro"} 1`.
- Sem parâmetro, o texto não contém `vidaemdia_google_sync_queue`.
- Com `{ queuePending: 3, queueFailed: 1, lastPullAt: new Date('2026-11-15T12:00:00Z') }`, contém `vidaemdia_google_sync_queue{status="PENDING"} 3`, `{status="FAILED"} 1` e `vidaemdia_google_last_pull_timestamp_seconds 1794744000`.
- Com `lastPullAt: null`, o timestamp é `0`.

### 5. Alertas (`alerts.yml`)

Acrescentar ao grupo `vidaemdia`, no mesmo formato dos existentes:
- `GoogleSyncFalhando`: `sum(increase(vidaemdia_google_sync_total{result="erro"}[15m])) > 5`, `for: 0m`, severity `warning`, summary `Falhas repetidas na sincronização com o Google Agenda`.
- `FilaGoogleAcumulando`: `vidaemdia_google_sync_queue{status="PENDING"} > 20`, `for: 10m`, severity `warning`, summary `Fila de envio para o Google parada ou acumulando`.

### 6. Dashboard (`vidaemdia.json`)

Acrescentar no fim de `panels`, sem alterar os painéis existentes (ids 1 a 16), usando o mesmo `datasource` deles:
- id 17, `row`, título `Google Agenda`, `gridPos {h:1,w:24,x:0,y:43}`.
- id 18, `timeseries`, `Sincronizações com o Google por sentido`, `gridPos {h:8,w:12,x:0,y:44}`, expr `sum by (direction, result) (increase(vidaemdia_google_sync_total[$__rate_interval]))`, legenda `{{direction}} {{result}}`.
- id 19, `stat`, `Fila de envio (pendentes / com falha)`, `gridPos {h:8,w:6,x:12,y:44}`, expr `vidaemdia_google_sync_queue`, legenda `{{status}}`.
- id 20, `stat`, `Última sincronização recebida`, `gridPos {h:8,w:6,x:18,y:44}`, expr `vidaemdia_google_last_pull_timestamp_seconds * 1000`, unidade `dateTimeFromNow`.

O JSON precisa continuar válido.

## Critérios de aceite

- `npm test` no backend passa (todos os specs, inclusive os três novos), sem acesso à rede.
- `npm run lint` e `npx tsc --noEmit` sem erros novos.
- `GET /metrics` mostra as quatro linhas de `vidaemdia_google_sync_total`, a fila e o timestamp.
- `promtool check rules` aceita o `alerts.yml`; o dashboard é JSON válido (é o que o CI checa).

## O que NÃO alterar

- Nenhum outro arquivo além da lista, em especial `google-calendar.client.ts`, `google-oauth.client.ts`, `google.config.ts` e `schema.prisma`.
- A lógica do worker e do pull (só as chamadas de métrica mudam).
- Os nomes das outras métricas e os painéis 1 a 16 do Grafana.
