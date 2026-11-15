# VidaEmDia — Agenda Pessoal/Profissional & Chatbot Telegram

Sistema completo de gerenciamento de agendas pessoais e profissionais com controle de acesso **RBAC** (delegação entre Profissional e Secretária), **Worker de Notificações** via **Telegram Bot API** (canal ativo padrão, com política de Retry de até 3 tentativas; o canal WhatsApp original foi descontinuado e substituído integralmente pelo Telegram), **Webhook e Polling de Chatbot**, **Vínculo Seguro de Contas**, **Logs de Auditoria**, **Monitoramento (Prometheus + Grafana)** e procedimentos automatizados de **Backup e Recuperação (PostgreSQL)**.

---

## 1. Arquitetura e Fluxos Implementados

O projeto segue fielmente o diagrama arquitetural `VidaEmDia_Fluxo.drawio.html`:

1. **Fluxo Principal — Cadastro de Compromisso (Usuário / Profissional):**
   * O usuário acessa a aplicação web (**React + TypeScript**).
   * Caso não esteja autenticado, realiza login (`POST /auth/login`) e recebe um **JWT**.
   * Visualiza sua agenda pessoal ou profissional e preenche o formulário de novo compromisso (*Título, Data, Horário, Descrição, Canal Telegram e Antecedência do Lembrete*).
   * O backend (**NestJS**) valida JWT, permissões RBAC, conflitos de horário e dados do DTO (`POST /compromissos`).
   * Salva no **PostgreSQL** (`appointments` + `reminders`) e retorna `201 Created`.

2. **Fluxo RBAC — Secretária Acessando Agenda de um Profissional:**
   * A secretária acessa o sistema web e seleciona o profissional cuja agenda deseja gerenciar (ex.: *Dr. João Mendes*).
   * O backend realiza **dupla checagem RBAC** (`RbacGuard` + `CalendarAccessService` verificando a tabela `calendar_permissions`).
   * Se não possuir autorização (ex.: tentando acessar a agenda da *Dra. Ana Costa*), o backend retorna **`403 Forbidden (Acesso negado)`**, incrementa a métrica Prometheus `vidaemdia_rbac_access_denied_total` e grava um registro em `audit_logs`.
   * Se autorizada, a secretária visualiza, cria, altera ou cancela compromissos na agenda do profissional, e todas as ações geram **Logs de Auditoria** (`quem alterou / quando`).

3. **Fluxo de Notificação — Worker + Telegram Bot API:**
   * Um **Worker / Scheduler** (`NotificationWorker`) executa periodicamente de forma independente do fluxo principal.
   * Consulta no PostgreSQL compromissos agendados cujo lembrete esteja `PENDING` dentro da janela de disparo.
   * Monta a mensagem padronizada (*"🔔 <b>Lembrete VidaEmDia</b>: Consulta médica hoje às 08:00."*) e envia para a **Telegram Bot API**.
   * **Envio bem-sucedido:** Atualiza o status do lembrete para `SENT` (`ENVIADO`) no PostgreSQL.
   * **Falha no envio:** Registra o erro e agenda nova tentativa com *backoff* (**máx. 3 tentativas**).

4. **Chatbot Bidirecional via Telegram (`/telegram/webhook` ou Polling):**
   * Processa mensagens do usuário via Telegram (ex.: `"/agenda"` ou `"Marcar Consulta médica amanhã às 08:00"`).
   * No frontend, a interface de simulação do chatbot exige login prévio para operar com o usuário logado.
   * O bot em produção se conecta via Telegram real sob o username definido no `.env` (`TELEGRAM_BOT_USERNAME`).

> **Fuso Horário:** O sistema assume o fuso de São Paulo (`America/Sao_Paulo`) para horários e lembretes; outros fusos estão fora desta versão.

---

## 2. Estrutura do Projeto

```text
Trabalho Devops/
├── backend/                        # API NestJS + Prisma ORM + Worker + Telegram Bot + Chatbot Webhook
│   ├── prisma/
│   │   ├── schema.prisma           # Modelagem PostgreSQL (users, calendars, permissions, appointments, reminders, audit_logs, telegram_link_tokens)
│   │   └── seed.ts                 # Seed inicial com Usuário, Dr. João, Dra. Ana e Secretária Maria
│   ├── src/
│   │   ├── auth/                   # Login, Registro, Estratégia JWT e Guards RBAC
│   │   ├── calendars/              # Agendas Pessoal/Profissional e Delegação RBAC (Dupla Checagem)
│   │   ├── appointments/           # CRUD de Compromissos + Prevenção de Conflitos
│   │   ├── notifications/          # Worker Cron, Provedor Telegram e BotService (Parser PLN)
│   │   ├── telegram/               # TelegramService (Mock/Polling/Webhook), LinkService e Webhook Controller
│   │   ├── audit/                  # Gravação e consulta de Logs de Auditoria
│   │   └── monitoring/             # Healthcheck (/health) e Métricas Prometheus (/metrics)
│   └── Dockerfile
├── frontend/                       # Aplicação Web React + TypeScript + TailwindCSS
│   ├── src/
│   │   ├── App.tsx                 # Interface completa com gerenciamento de agendas, RBAC, auditoria e vínculo Telegram
│   │   ├── api.ts                  # Cliente HTTP com injeção automática de JWT
│   │   └── types.ts                # Contratos TypeScript
│   └── Dockerfile
├── infra/                          # DevOps: Reverse Proxy, Monitoramento e Backup/Restore
│   ├── nginx/nginx.conf            # Reverse Proxy (App, API, Grafana) + Headers de Segurança (X-Frame-Options, etc.)
│   ├── monitoring/                 # Configuração do Prometheus (alertas) e Grafana (datasource e dashboard)
│   └── backup/                     # Scripts backup.sh / restore.sh e backup.ps1 / restore.ps1
├── docker-compose.yml              # Orquestração completa dos serviços
└── .env.example                    # Variáveis de ambiente documentadas
```

---

## 3. Configurando o Bot do Telegram

O sistema suporta três modos de operação para a integração com o Telegram (`TELEGRAM_MODE`): `mock` (padrão para testes locais), `polling` e `webhook`.

### 3.1. Criando o Bot com o BotFather
1. Abra o aplicativo do Telegram e inicie uma conversa com o [@BotFather](https://t.me/BotFather).
2. Envie o comando `/newbot` e siga as instruções para escolher um nome e um nome de usuário (terminando em `bot`, ex.: `meu_agenda_bot`).
3. O BotFather fornecerá um **HTTP API Token** (ex.: `123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ`).
4. Guarde o token e o username (sem o `@`).

### 3.2. Variáveis de Ambiente (`.env`)
Configure os valores no seu arquivo `.env`:

```env
# Integração Telegram Bot API
TELEGRAM_ENABLED=true
TELEGRAM_MODE=mock                        # Opções: mock, polling, webhook
TELEGRAM_BOT_TOKEN="seu_token_aqui"       # Fornecido pelo BotFather
TELEGRAM_BOT_USERNAME="seu_bot_username"  # Sem o caractere @
TELEGRAM_WEBHOOK_URL="https://seu-dominio.com/telegram/webhook"
TELEGRAM_WEBHOOK_SECRET="segredo_aleatorio_seguro"
```

### 3.3. Modo Polling Local
Ideal para desenvolvimento em máquina local sem necessidade de expor portas na internet:
1. Defina `TELEGRAM_MODE=polling`.
2. Informe `TELEGRAM_BOT_TOKEN` e `TELEGRAM_BOT_USERNAME`.
3. Ao iniciar, o backend remove qualquer webhook pendente e inicia o consumo de mensagens diretamente via long-polling assíncrono (`getUpdates`).

### 3.4. Modo Webhook com Túnel (ngrok / cloudflared)
Para receber os updates via webhook em produção ou com ferramenta de túnel:
1. Suba o túnel apontando para o backend:
   ```bash
   ngrok http 3000
   # ou
   cloudflared tunnel --url http://localhost:3000
   ```
2. No `.env`, configure:
   ```env
   TELEGRAM_MODE=webhook
   TELEGRAM_WEBHOOK_URL=https://seu-tunnel.ngrok-free.app/telegram/webhook
   TELEGRAM_WEBHOOK_SECRET=sua_chave_secreta_longa
   ```
3. O backend executa o registro automático (`setWebhook`) ao inicializar, repassando o secret token para validação contra ataques de falsificação.
4. **Nota sobre Nginx:** O proxy reverso do projeto repassa todas as rotas `/api/*` diretamente ao backend (`http://backend:3000/`) e `/grafana/*` ao Grafana. O webhook do Telegram pode ser exposto publicamente como `https://seu-dominio.com/api/telegram/webhook` (via Nginx na porta 8080) ou através de ferramenta de túnel na máquina local (porta 3000).

### 3.5. Como Vincular a Conta do Telegram
1. O usuário realiza login no sistema web **VidaEmDia**.
2. Na aba de perfil/chatbot, clica no botão **Vincular Telegram**.
3. O sistema gera uma URL única com token criptográfico temporário válido por 10 minutos: `https://t.me/seu_bot_username?start=<codigo>`.
4. Ao clicar no link, o Telegram abre a conversa com o bot exibindo o botão **Iniciar** (ou enviando `/start <codigo>`).
5. O bot consome o código de forma atômica no banco, armazena o `telegramChatId` associado ao usuário, emite log de auditoria e responde confirmando o vínculo.
6. A partir desse momento, lembretes de compromissos são enviados para este Telegram e o usuário pode consultar sua agenda com `/agenda` ou criar novos compromissos em linguagem natural.

---

## 3.6. Google Agenda (Opcional)

A integração com o **Google Agenda** permite conectar a conta Google do usuário via OAuth 2.0. Sem as variáveis de ambiente configuradas, a integração permanece desligada (`GET /google/status` retorna `{ configured: false }` e as demais rotas do Google retornam 503).

### Passo a passo para obter as credenciais:
1. Acesse o [Google Cloud Console](https://console.cloud.google.com/) e crie ou selecione um projeto.
2. Em **APIs e Serviços > Biblioteca**, procure por **Google Calendar API** e clique em **Ativar**.
3. Configure a **Tela de consentimento OAuth**:
   - Tipo de usuário: **Externo**.
   - Preencha as informações básicas do aplicativo (nome, e-mail de suporte).
   - Mantenha o status de publicação em **Modo de teste (Testing)**.
   - Adicione as contas de e-mail utilizadas na demonstração como **Usuários de teste** (Test users).
4. Em **APIs e Serviços > Credenciais**, clique em **Criar credenciais > ID do cliente OAuth**:
   - Tipo de aplicativo: **Aplicativo da Web**.
   - **Origens JavaScript autorizadas:**
     - `http://localhost:8080`
     - `http://localhost:3000`
   - **URIs de redirecionamento autorizados:**
     - `http://localhost:8080/api/google/callback` (produção/proxy)
     - `http://localhost:3000/google/callback` (desenvolvimento local)
5. Obtenha o **ID do cliente** e a **Chave secreta do cliente**.

### Variáveis no `.env`:
```env
GOOGLE_CLIENT_ID="seu_client_id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="sua_client_secret"
GOOGLE_REDIRECT_URI="http://localhost:8080/api/google/callback"
GOOGLE_TOKEN_ENC_KEY="gere_com_openssl_rand_-hex_32"
FRONTEND_URL="http://localhost:8080"
```

> **Chave de Criptografia:** Gere a chave de 32 bytes (64 caracteres hexadecimais) com `openssl rand -hex 32`. Caso `GOOGLE_CLIENT_ID` esteja preenchido e a chave não possua 64 caracteres hexadecimais, o backend falha na inicialização por segurança.

> ⚠️ **Aviso de expiração (Modo de teste):** Enquanto o aplicativo estiver em modo de teste no Google Cloud Console, o refresh token do Google expira automaticamente a cada **7 dias**, sendo necessário reconectar a conta.

### Como funciona a sincronização

- **Como ligar:** O dono da agenda conecta sua conta Google via OAuth 2.0 (pelo botão na interface ou via rota `GET /google/connect`) e escolhe qual agenda do Google será vinculada a cada agenda do VidaEmDia (`PUT /agendas/:id/google`). Somente o dono da agenda tem permissão para vincular, desvincular ou sincronizar.
- **VidaEmDia → Google (Envio):** Criar, alterar e cancelar compromissos geram um job na fila (`GoogleSyncJob`). O worker (`GoogleSyncWorker`) executa a cada minuto (`GOOGLE_SYNC_CRON_EXPRESSION`, padrão `*/1 * * * *`). Em caso de falha transitória, tenta novamente com espera crescente de 1, 5, 15 e 30 minutos (`RETRY_DELAYS_MINUTES`), desistindo após 5 tentativas (marcando o status como `FAILED`). Conexão expirada (`invalid_grant`) ou dono sem conta Google conectada falham imediatamente sem novas tentativas.
- **Google → VidaEmDia (Recebimento):** O serviço de pull (`GooglePullService`) executa a cada minuto (`GOOGLE_PULL_CRON_EXPRESSION`, padrão `*/1 * * * *`). Na primeira execução, busca eventos no intervalo de -24 horas a +60 dias; nas execuções seguintes, realiza sincronização incremental utilizando `syncToken`. Se o Google responder com status 410 (token expirado), o sistema descarta o token e recomeça a carga do zero. O eco das próprias alterações enviadas pelo VidaEmDia é detectado e ignorado comparando o `etag` do evento (`appt.googleEtag === ev.etag`). O dono pode forçar uma rodada de sincronização a qualquer momento pelo botão na interface ou via `POST /agendas/:id/google/sincronizar`.
- **Regras de sincronização:**
  - **Conflito de horário:** Conflitos de horário são sinalizados e não recusados. Eventos vindos do Google nunca são rejeitados; o sistema detecta sobreposições (`ConflictService`), marca `hasConflict: true` e exibe o aviso "Conflito de horário" na interface.
  - **Dia inteiro:** Compromissos de dia inteiro recebem `allDay: true` (sem horário fixo de término) e o lembrete é agendado automaticamente para as 8h da manhã do dia do compromisso.
  - **Privacidade:** Eventos marcados como privados ou confidenciais no Google recebem `isPrivate: true`. Usuários que não são donos da agenda (como secretárias ou administradores) visualizam o título como "Ocupado" e descrição vazia (`null`), e não podem alterar título ou descrição. Somente o dono vê o título real (marcado com "Privado") e a descrição.
  - **Convites recusados:** Se o usuário recusar o convite no Google Agenda (`responseStatus === 'declined'`), o compromisso é cancelado no VidaEmDia (`CANCELLED`), lembretes pendentes são removidos e a ação é registrada na auditoria.
  - **Última alteração vence:** Se houver um job de envio em processamento (`PROCESSING`), a alteração do Google é ignorada para aguardar o término. Se houver um job pendente (`PENDING`), compara-se o horário de atualização do Google (`ev.updated`) com o do compromisso (`appt.updatedAt`): se a alteração do Google for mais recente, o job pendente é marcado como `DONE` ("Substituído por alteração mais recente no Google Agenda") e o evento externo é aplicado; se a alteração local for mais recente ou igual, a alteração do Google é ignorada e o job enviará a versão local.

#### Rotas da Integração com Google Agenda (`google.controller.ts`)

| Método | Rota | Descrição |
| :--- | :--- | :--- |
| `GET` | `/google/status` | Retorna o status de conexão da conta com o Google Agenda. |
| `GET` | `/google/connect` | Gera a URL de autorização OAuth 2.0 com o Google. |
| `GET` | `/google/callback` | Callback de redirecionamento OAuth 2.0 acionado pelo Google. |
| `DELETE` | `/google/link` | Desconecta o vínculo da conta do usuário com o Google Agenda. |
| `GET` | `/google/calendars` | Lista as agendas do Google com permissão de escrita. |
| `PUT` | `/agendas/:id/google` | Liga uma agenda do VidaEmDia a uma agenda do Google. |
| `DELETE` | `/agendas/:id/google` | Desliga uma agenda do VidaEmDia da agenda do Google. |
| `POST` | `/agendas/:id/google/sincronizar` | Força a sincronização imediata dos eventos com o Google Agenda. |

- **Onde ver os erros:** A agenda e o compromisso registram mensagens de erro de sincronização nos campos `googleSyncError` (exibidos no modal de vínculo da agenda e no painel de detalhes do compromisso), acompanhados das marcas visuais na listagem de compromissos ("Google", "Conflito de horário", "Privado").
- **Testes automatizados:** Os clients HTTP do Google (`GoogleCalendarClient` e `GoogleOAuthClient`) são cobertos por testes unitários com simulação do `fetch` global (`google-calendar.client.spec.ts` e `google-oauth.client.spec.ts`), garantindo que nenhum teste acesse a rede ou a API do Google de verdade.

---

## 4. Como Executar o Projeto

### 4.1. Configuração de Segredos Obrigatórios (.env)

O sistema não possui senhas ou segredos padrão embutidos no código ou no Docker Compose. Antes de iniciar, configure obrigatoriamente no `.env`:

* **`POSTGRES_PASSWORD`**: Senha do banco PostgreSQL (e atualize a `DATABASE_URL` correspondente).
* **`JWT_SECRET`**: Segredo de assinatura dos tokens JWT (obrigatório ter **no mínimo 32 caracteres**).
* **`GRAFANA_ADMIN_PASSWORD`**: Senha de acesso do usuário administrador do Grafana.
* **`CORS_ORIGIN`**: Opcional. Só preencha se o front rodar em outro endereço que não passe pelo `/api` (ex.: `http://localhost:5173`). Vários: separados por vírgula. Padrão vazio (CORS desligado; acesso restrito à mesma origem via reverse proxy).

#### Como gerar segredos seguros
Gere chaves aleatórias e seguras via terminal:
```bash
openssl rand -hex 32
```

> [!WARNING]
> **Aviso sobre o volume do PostgreSQL:** A senha `POSTGRES_PASSWORD` definida no `.env` só é aplicada na inicialização inicial do volume Docker (`postgres_data`). Caso altere a senha no `.env` com um volume já existente, o PostgreSQL continuará com a senha antiga, causando falha de autenticação. Para alterar a senha em um banco existente, execute o comando SQL antes de mudar o `.env`:
> ```sql
> ALTER USER vidaemdia WITH PASSWORD 'nova_senha';
> ```
> (ou recrie o volume se não precisar manter os dados: `docker compose down -v`).

> [!NOTE]
> **Pipeline de CI/CD:** O CI roda lint, build e testes do backend e do front, constrói as imagens Docker e as examina com o Trivy (falha com vulnerabilidade crítica que já tem correção). Os testes unitários, checagens de lint e build do backend no CI não precisam desses segredos configurados, pois os testes não acessam o banco de dados.

### Opção A: Via Docker Compose (Recomendado — Stack Completa)

1. Copie o arquivo de variáveis de ambiente e preencha os segredos obrigatórios:
   ```bash
   cp .env.example .env
   ```
2. Suba os containers:
   ```bash
   docker compose up -d --build
   ```
   > [!NOTE]
   > Os containers do backend (usuário `node`) e do frontend (usuário `nginx`) executam sem privilégios de root e possuem healthcheck integrado configurado. É possível verificar a saúde dos serviços com `docker compose ps` (os serviços exibirão status "healthy").

3. Popule o banco de dados com as contas de demonstração:
   ```bash
   docker exec vidaemdia-backend npm run prisma:seed:prod
   ```
   > [!WARNING]
   > O seed **apaga e recria** as agendas das contas de demonstração (Carlos, Dr. João, Dra. Ana e Maria), junto com os compromissos, lembretes e acessos delas.
   > Rode só na primeira subida ou quando quiser voltar essas contas ao estado inicial. Outras contas não são afetadas.
4. Acesse os serviços:
   * **Aplicação Web (Frontend):** `http://localhost:8080`
   * **Grafana Dashboard:** `http://localhost:8080/grafana/` (usuário: `admin` / senha: a definida em `GRAFANA_ADMIN_PASSWORD` no `.env`). O dashboard **VidaEmDia — Visão geral** está provisionado na pasta **VidaEmDia**.
   * **API Backend & Swagger Docs:** `http://localhost:3000/api/docs` (acessível só nesta máquina)
   * **Healthcheck:** `http://localhost:3000/health` (acessível só nesta máquina)
   * **Métricas Prometheus:** `http://localhost:3000/metrics` (acessível só nesta máquina)
   * **PostgreSQL:** `localhost:5432` (acessível só nesta máquina)
   * **Prometheus:** Somente na rede interna dos containers (o Grafana lê os dados dele diretamente)

### Opção B: Execução em Desenvolvimento Local (Node.js)

1. No diretório `backend/`:
   ```bash
   cd backend
   npm install
   npx prisma generate
   npm run prisma:migrate
   npm run prisma:seed
   npm run start:dev
   ```
2. No diretório `frontend/`:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   Acesse `http://localhost:5173`.

---

## 5. Banco de Dados e Migrations

A estrutura do banco de dados PostgreSQL é versionada através do Prisma em `backend/prisma/migrations/`:
- O backend aplica automaticamente as migrations pendentes ao subir (`sh prisma/migrate.sh`).
- **Bancos pré-existentes:** Bancos criados antes desta mudança (via `db push`) são adotados de forma automática (a migration `0_init` é marcada como aplicada na primeira inicialização).
- **Alterações no banco:** Para alterar o esquema, edite `backend/prisma/schema.prisma` e execute `npm run prisma:migrate:dev -- --name <nome>` com o PostgreSQL local em execução; em seguida, comite a pasta da migration gerada.
- **Atenção:** Não utilize mais `prisma db push` (ou `npm run prisma:push`), pois ele pode descartar dados durante alterações destrutivas.

---

## 6. Contas de Teste Criadas pelo Seed (Senha padrão: `123456`)

| Papel (RBAC) | Nome | E-mail | Comportamento no Fluxo |
| :--- | :--- | :--- | :--- |
| `USER` | Carlos Silva | `carlos@vidaemdia.com.br` | Possui Agenda Pessoal e lembrete elegível para disparo no Telegram (chatId de mock no seed). |
| `PROFESSIONAL` | Dr. João Mendes | `dr.joao@vidaemdia.com.br` | Possui Agenda Profissional e **delegou permissão RBAC** para a Secretária Maria. |
| `PROFESSIONAL` | Dra. Ana Costa | `dra.ana@vidaemdia.com.br` | Possui Agenda Profissional **restrita** (retorna **403 Acesso Negado** se a Secretária Maria tentar acessar). |
| `SECRETARY` | Maria Oliveira | `secretaria.maria@vidaemdia.com.br` | Acessa e gerencia a agenda do Dr. João (`200 OK`) e é bloqueada na agenda da Dra. Ana (`403 Forbidden`). |

> Os botões das contas de demonstração na tela de login só aparecem com `VITE_SHOW_DEMO_ACCOUNTS=true` no `.env` (e rebuild do front: `docker compose up -d --build frontend`).
>
> Qualquer pessoa pode criar uma conta pessoal em `/criar-conta` (link "Criar conta" na tela de login). Na primeira entrada, a conta nova vê o cartão "Primeiros passos" (Telegram, primeiro compromisso e, se configurado, Google Agenda), que pode ser dispensado.
>
> Contas criadas pelo cadastro (`POST /auth/register`) são de uso pessoal (papel `USER`), recebem a agenda "Minha agenda" e exigem senha de 8 a 72 caracteres com pelo menos uma letra e um número; as contas do seed mantêm a senha `123456`.
>
> Em **Minha conta** (menu do usuário, `/conta`) a pessoa muda o nome, troca a senha (pedindo a atual) e vê ou desfaz as conexões com o Telegram e o Google; rotas `PATCH /auth/me` e `POST /auth/me/senha` (limite de 5 trocas de senha por minuto), as duas registradas na auditoria.
>
> **Esqueci a senha** — quem vinculou o Telegram pede em `/esqueci-senha` um código de 6 números enviado pelo bot (vale 15 minutos, uso único, até 5 tentativas; limite de 3 pedidos por minuto). Rotas `POST /auth/senha/esqueci` e `POST /auth/senha/redefinir`. A resposta do pedido é sempre a mesma, para não revelar quais e-mails têm conta. Em `TELEGRAM_MODE=mock`, o código aparece no log do backend (`docker logs vidaemdia-backend`).

---

## 7. Procedimentos de Backup e Recuperação (DevOps)

### Executar Backup Manual
* **Linux / Container:**
  ```bash
  docker exec -it vidaemdia-backup /scripts/backup.sh
  ```
* **Windows PowerShell:**
  ```powershell
  .\infra\backup\backup.ps1
  ```

### Executar Recuperação (Restore)
* **Linux / Container:**
  ```bash
  docker exec -it vidaemdia-backup /scripts/restore.sh /backups/vidaemdia_backup_YYYYMMDD_HHMMSS.sql.gz
  ```
* **Windows PowerShell:**
  ```powershell
  .\infra\backup\restore.ps1 -BackupFile .\infra\backup\backups\vidaemdia_backup_YYYYMMDD_HHMMSS.sql
  ```

---

## 8. Monitoramento e Alertas (Prometheus & Grafana)

A stack de monitoramento é composta pelo **Prometheus** (coleta de métricas e avaliação de alertas) e pelo **Grafana** (visualização):
- **Dashboard provisionado:** O dashboard **"VidaEmDia — Visão geral"** é provisionado automaticamente na pasta **`VidaEmDia`** no Grafana (`http://localhost:8080/grafana/`).
- **Painel de alertas:** O painel **"Alertas disparados"** exibe em tempo real os alertas ativos avaliados pelo Prometheus (`ALERTS{alertstate="firing"}`).
- **Regras de alerta configuradas (`infra/monitoring/alerts.yml`):**
  - **`BackendFora`** (`critical`): O backend não responde às coletas do Prometheus há mais de 1 minuto.
  - **`BackendReiniciado`** (`warning`): O backend reiniciou há menos de 2 minutos.
  - **`LembretesFalhando`** (`warning`): Mais de 5 falhas de envio de lembrete em 15 minutos.
  - **`ErrosApiTelegram`** (`warning`): Erros repetidos na API do Telegram (mais de 5 erros em 15 minutos).
  - **`MuitosAcessosNegados`** (`warning`): Muitas tentativas de acesso a agendas sem permissão (mais de 10 tentativas em 10 minutos).
  - **`PossivelForcaBrutaLogin`** (`critical`): Mais de 20 falhas de login em 5 minutos.
  - **`GoogleSyncFalhando`** (`warning`): Mais de 5 erros de sincronização com o Google em 15 minutos.
  - **`FilaGoogleAcumulando`** (`warning`): Mais de 20 envios pendentes para o Google por mais de 10 minutos.

### Métricas expostas em /metrics

| Métrica | Tipo | Rótulos | Significado |
| :--- | :--- | :--- | :--- |
| `vidaemdia_appointments_created_total` | Counter | `source="WEB" \| "TELEGRAM"` | Total de compromissos criados por canal |
| `vidaemdia_reminders_sent_total` | Counter | `channel="TELEGRAM"` | Total de lembretes enviados com sucesso pelo Worker |
| `vidaemdia_reminders_failed_total` | Counter | *(nenhum)* | Total de falhas/retries no envio de lembretes |
| `vidaemdia_telegram_updates_received_total` | Counter | *(nenhum)* | Total de updates recebidos da Telegram Bot API |
| `vidaemdia_telegram_api_errors_total` | Counter | *(nenhum)* | Total de erros na API do Telegram |
| `vidaemdia_rbac_access_denied_total` | Counter | *(nenhum)* | Total de bloqueios 403 RBAC (tentativa de acesso não autorizado) |
| `vidaemdia_auth_failures_total` | Counter | *(nenhum)* | Total de falhas de autenticação JWT/Login |
| `vidaemdia_google_sync_total` | Counter | `direction="envio" \| "recebimento"`, `result="ok" \| "erro"` | Total de sincronizações com o Google Agenda por sentido e resultado |
| `vidaemdia_google_sync_queue` | Gauge | `status="PENDING" \| "FAILED"` | Jobs na fila de envio para o Google, por status |
| `vidaemdia_google_last_pull_timestamp_seconds` | Gauge | *(nenhum)* | Hora (Unix, segundos) da última sincronização recebida do Google |
| `vidaemdia_uptime_seconds` | Gauge | *(nenhum)* | Tempo de atividade do servidor backend em segundos |

No dashboard Grafana (**VidaEmDia — Visão geral**), a linha **Google Agenda** reúne o monitoramento da integração:
- **Sincronizações com o Google por sentido:** gráfico temporal (`timeseries`) com a taxa de sincronizações discriminadas por sentido (`direction`: `envio` ou `recebimento`) e resultado (`result`: `ok` ou `erro`).
- **Fila de envio (pendentes / com falha):** indicadores instantâneos (`stat`) com a quantidade de jobs na fila por status (`PENDING` e `FAILED`).
- **Última sincronização recebida:** indicador numérico (`stat`) exibindo o tempo relativo decorrido desde a última sincronização recebida do Google (`dateTimeFromNow`).
