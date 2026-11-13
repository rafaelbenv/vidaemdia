# 58 — Google Agenda, parte 1: conectar a conta (roteiro 8.1)

Referência: `.plans/29-google-agenda-analise.md` (seções 2.1 a 2.3 e decisões da 2.6). Versão mínima pedida pelo usuário: 8.1, 8.2, 8.3 e o "conectar" do 8.6.
Não execute comandos de terminal. Use só ferramentas de arquivo. **A migration é gerada pelo orquestrador depois** (não criar pasta em `prisma/migrations`).

## Decisões
- Sem `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` no ambiente, a integração fica **desligada**: o sistema sobe normalmente, `GET /google/status` devolve
  `{ configured: false }` e as demais rotas respondem 503 "Integração com o Google Agenda não configurada".
- Escopos: `openid email https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.calendarlist.readonly`.
- Chamadas ao Google com `fetch` (sem a biblioteca `googleapis`), como já é feito com o Telegram.
- Refresh token guardado criptografado (AES-256-GCM) com `GOOGLE_TOKEN_ENC_KEY` (64 caracteres hex = 32 bytes). Sem essa chave com a integração configurada → erro claro ao subir.
- O `state` do OAuth é um JWT curto (10 min) assinado com o `JWT_SECRET` (`getJwtSecret()`), com `{ sub: userId, purpose: 'google-oauth' }`.

## Arquivos
- Editar: `backend/prisma/schema.prisma`, `backend/src/app.module.ts`, `docker-compose.yml`, `.env.example`, `README.md`
- Criar: `backend/src/google/google.module.ts`, `google.config.ts`, `token-crypto.ts`, `google-oauth.client.ts`, `google-account.service.ts`,
  `google.controller.ts`, e os specs `token-crypto.spec.ts`, `google-account.service.spec.ts` (todos em `backend/src/google/`)

## Passos

### 1. Schema
```prisma
model GoogleAccount {
  id                   String    @id @default(uuid())
  userId               String    @unique @map("user_id")
  googleEmail          String    @map("google_email")
  refreshTokenEnc      String    @map("refresh_token_enc")
  accessToken          String?   @map("access_token")
  accessTokenExpiresAt DateTime? @map("access_token_expires_at")
  scope                String
  connectedAt          DateTime  @default(now()) @map("connected_at")
  lastError            String?   @map("last_error")
  updatedAt            DateTime  @updatedAt @map("updated_at")
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@map("google_accounts")
}
```
Em `User`: `googleAccount GoogleAccount?`.

### 2. `google.config.ts`
`googleConfig(env = process.env)` → `{ configured: boolean; clientId; clientSecret; redirectUri; frontendUrl; encKey: Buffer | null }`.
- `configured` = `clientId` e `clientSecret` presentes.
- `redirectUri` = `GOOGLE_REDIRECT_URI` ou `http://localhost:8080/api/google/callback`; `frontendUrl` = `FRONTEND_URL` ou `http://localhost:8080`.
- Com `configured` e `GOOGLE_TOKEN_ENC_KEY` ausente ou diferente de 64 caracteres hex → lança `Error('GOOGLE_TOKEN_ENC_KEY inválida: use 64 caracteres hexadecimais (openssl rand -hex 32).')`.
  Chamar `googleConfig()` no `main.ts` logo depois do `getJwtSecret()` para falhar cedo.

### 3. `token-crypto.ts`
`encryptToken(plain, key)` → `base64(iv(12) | tag(16) | ciphertext)` com `aes-256-gcm`; `decryptToken(enc, key)` faz o inverso (lança se adulterado).

### 4. `google-oauth.client.ts` (classe injetável)
- `buildAuthUrl(state)`: `https://accounts.google.com/o/oauth2/v2/auth` com `client_id`, `redirect_uri`, `response_type=code`, `scope` (acima, separado por espaço),
  `access_type=offline`, `prompt=consent`, `include_granted_scopes=true`, `state`.
- `exchangeCode(code)`: `POST https://oauth2.googleapis.com/token` (form-urlencoded: `code`, `client_id`, `client_secret`, `redirect_uri`, `grant_type=authorization_code`)
  → `{ accessToken, refreshToken, expiresIn, scope, idToken }`. Erro HTTP → lança com a mensagem do Google.
- `refreshAccessToken(refreshToken)`: mesmo endpoint com `grant_type=refresh_token` → `{ accessToken, expiresIn }`. Resposta `invalid_grant` → lança `GoogleInvalidGrantError`.
- `revoke(token)`: `POST https://oauth2.googleapis.com/revoke?token=...` (ignorar erro).
- `emailFromIdToken(idToken)`: decodifica o payload (base64url) e devolve `email` (o token veio direto do Google por TLS; não precisa verificar assinatura).

### 5. `google-account.service.ts`
- `status(userId)` → `{ configured, connected, email?, lastError? }`.
- `startConnect(userId)` → `{ url }` (gera o `state` JWT e a URL).
- `finishConnect(code, state)` → valida o `state` (assinatura, validade, `purpose`), troca o código, exige `refreshToken` (se faltar: erro "O Google não devolveu acesso permanente; remova o VidaEmDia em myaccount.google.com/permissions e conecte de novo"),
  faz `upsert` da `GoogleAccount` (token criptografado, e-mail, escopo, `lastError: null`) e grava auditoria (`entityType: 'AUTH'`, `action: 'UPDATE'`, `details: 'Google Agenda conectado (<email>)'`). Devolve o `userId`.
- `getAccessToken(userId)` → devolve um access token válido: usa o salvo se faltar mais de 60 s para expirar; senão renova, salva e devolve.
  Em `GoogleInvalidGrantError`: grava `lastError` "Conexão com o Google expirou ou foi revogada. Conecte de novo." e relança. (Usado no passo 8.2/8.3.)
- `disconnect(userId)` → tenta revogar no Google, apaga a `GoogleAccount`, grava auditoria (`details: 'Google Agenda desconectado'`).

### 6. `google.controller.ts` (`@Controller('google')`)
- `GET /google/status` (JWT) → `status`.
- `GET /google/connect` (JWT) → `{ url }`; 503 se não configurado.
- `GET /google/callback` (**sem** JWT; o Google redireciona o navegador para cá) → recebe `code`, `state` ou `error`;
  sucesso: `res.redirect(`${frontendUrl}/agenda?google=conectado`)`; erro: `res.redirect(`${frontendUrl}/agenda?google=erro`)` e `logger.warn` com o motivo (sem logar tokens).
- `DELETE /google/link` (JWT) → `disconnect`; devolve `{ disconnected: true }`.
- Todas com `@ApiTags('Google Agenda')`.

### 7. Módulo e infraestrutura
- `GoogleModule` (providers: client, service; controller), importando o que for preciso para `JwtService` (usar `JwtModule.register({ secret: getJwtSecret() })` no próprio módulo). Registrar em `app.module.ts`.
- `docker-compose.yml` (backend): `GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID:-}`, `GOOGLE_CLIENT_SECRET: ${GOOGLE_CLIENT_SECRET:-}`,
  `GOOGLE_REDIRECT_URI: ${GOOGLE_REDIRECT_URI:-http://localhost:8080/api/google/callback}`, `GOOGLE_TOKEN_ENC_KEY: ${GOOGLE_TOKEN_ENC_KEY:-}`, `FRONTEND_URL: ${FRONTEND_URL:-http://localhost:8080}`.
- `.env.example`: bloco "Google Agenda (opcional)" com as cinco variáveis e um comentário curto sobre como obter a credencial (Google Cloud → Credenciais → ID do cliente OAuth, tipo Aplicativo da Web, com os dois redirects).
- `README.md`: seção "Google Agenda" com o passo a passo da credencial (resumo: projeto, ativar Google Calendar API, tela de consentimento Externa em modo de teste com usuários de teste, credencial Web com os redirects `http://localhost:8080/api/google/callback` e `http://localhost:3000/google/callback`),
  as variáveis e o aviso de que, em modo de teste, o Google expira a conexão em 7 dias.

### 8. Testes
- `token-crypto.spec.ts`: ida e volta; texto adulterado lança; chave errada lança.
- `google-account.service.spec.ts` (client e prisma mockados): `startConnect` gera URL com `state`; `finishConnect` com `state` inválido/expirado/de outro propósito lança;
  sucesso faz `upsert` com token **criptografado** (não igual ao original); sem `refreshToken` lança a mensagem combinada; `getAccessToken` reaproveita token válido e renova o vencido;
  `invalid_grant` grava `lastError`; `disconnect` apaga e audita; `status` com integração não configurada devolve `configured: false`.

## Critérios de aceite
- Build, lint (0 erros) e testes no backend.
- Sem as variáveis do Google, o backend sobe e `GET /google/status` devolve `configured: false`.

## O que NÃO alterar
- `prisma/migrations/` (o orquestrador gera), frontend, agendas e compromissos (são os passos seguintes).
