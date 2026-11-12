# 29 — Análise: sincronização nos dois sentidos com o Google Agenda

Sugestão do professor (2026-11-12): compromissos criados no VidaEmDia aparecem no Google Agenda e vice-versa,
e os do Google também ganham lembrete pelo Telegram. Este documento é análise, não plano de execução.

## 1. O que o código atual já oferece

- **Ponto único de escrita:** web, bot e chat criam, alteram e cancelam compromissos por `AppointmentsService.create`,
  `update` e `cancel` (`backend/src/appointments/appointments.service.ts`). O envio ao Google pode ser ligado nesses três métodos.
- **Worker com retry:** `notification.worker.ts` roda por cron e já faz tentativas com `retryCount`/`nextRetryAt`. O mesmo padrão serve para a fila de sincronização.
- **Lembrete recalculado na alteração:** `update` refaz o `remindAt` quando o horário muda. Um evento alterado no Google, importado por `update`, também tem o lembrete ajustado.
- **Vínculo por conta:** o fluxo "Conectar Telegram" (token, status, desconectar) é o modelo para "Conectar Google".

## 2. O que precisa ser feito

### 2.1 Google Cloud (fora do código)
- Projeto no Google Cloud com a Google Calendar API ativada.
- Tela de consentimento OAuth "Externa", em modo **Testing**, com as contas da demonstração cadastradas como usuários de teste (até 100).
- Credencial OAuth "Aplicativo da Web". Redirect: `http://localhost:8080/api/google/callback` (via nginx) e `http://localhost:3000/google/callback` (dev).
- Escopo: `https://www.googleapis.com/auth/calendar` para listar as agendas e ler e escrever eventos.
  Para reduzir o acesso: `calendar.events` + `calendar.calendarlist.readonly`.
- **Atenção:** em modo Testing, o refresh token do Google **expira em 7 dias**. Para a apresentação basta reconectar; para uso contínuo, o app teria de ser publicado e verificado pelo Google.

### 2.2 Banco (depende do passo 7.1, migrations)
- Nova tabela `GoogleAccount`: `userId` (único), `googleEmail`, `refreshToken` **criptografado**, `accessToken`, `accessTokenExpiresAt`, `scope`, `connectedAt`, `lastError`.
- `Calendar`: `googleCalendarId?`, `googleSyncToken?`, `googleLastSyncAt?`, `googleSyncEnabled`. Uma agenda do VidaEmDia ↔ uma agenda do Google, escolhida pelo dono.
- `Appointment`: `googleEventId?` (único por agenda), `googleEtag?`, `googleUpdatedAt?`, `allDay`, `hasConflict` e `isPrivate` (Boolean, padrão false), `syncState` (`SYNCED | PENDING_PUSH | ERROR`).
  `createdVia` passa a aceitar `GOOGLE`.
- Nova tabela `GoogleSyncJob` (fila de saída): `appointmentId`, `operation` (`UPSERT | DELETE`), `status`, `retryCount`, `nextRetryAt`, `lastError`.
  Evita chamar o Google dentro da requisição do usuário: se o Google estiver fora do ar, o compromisso é salvo e o envio é refeito depois.

### 2.3 Backend — conexão (OAuth)
- `GoogleModule` com `GoogleAuthService` e `GoogleCalendarClient` (biblioteca `googleapis` ou `fetch` direto, como no Telegram).
- `GET /google/connect`: devolve a URL de autorização com `state` assinado (JWT curto com o `userId`), `access_type=offline` e `prompt=consent`.
- `GET /google/callback`: valida o `state`, troca o `code` por tokens, grava criptografado e redireciona ao front.
- `GET /google/calendars`: lista as agendas do Google do usuário, para ele escolher qual ligar.
- `PUT /agendas/:id/google`: liga ou desliga a agenda do VidaEmDia a uma do Google (só o dono). Ao ligar, faz a carga inicial.
- `DELETE /google/link`: revoga o token no Google e apaga os dados.
- Renovação automática do access token pelo refresh token. Em `invalid_grant` (token expirado ou revogado), marca a conta como desconectada e avisa na tela.

### 2.4 Backend — VidaEmDia → Google
- Em `create`, `update` e `cancel`: se a agenda tem `googleCalendarId`, enfileirar um `GoogleSyncJob`.
- Worker de saída (cron a cada 1 min, junto com o de lembretes):
  - Sem `googleEventId`: `events.insert`. Com: `events.patch`. Cancelado: `events.delete`.
  - Gravar no evento `extendedProperties.private.vidaemdiaId = appointment.id`, para reconhecer a origem.
  - Guardar `googleEventId`, `etag` e `updated` devolvidos.
  - Fuso: enviar `timeZone: 'America/Sao_Paulo'` (o sistema assume esse fuso, item C13).
- O agendamento feito pelo bot do Telegram entra automaticamente, porque passa por `create`.

### 2.5 Backend — Google → VidaEmDia
- Sincronização incremental com `events.list` + `syncToken`, em cron a cada 1 ou 2 min por agenda ligada.
  - Primeira carga: `timeMin` = agora − 1 dia, `timeMax` = agora + 60 dias, `singleEvents=true` (cada ocorrência de um evento que se repete vira um evento separado).
  - Resposta `410 Gone`: o `syncToken` expirou; refazer a carga completa.
- Para cada evento recebido:
  - Já conhecido por `googleEventId` e `etag` igual: ignorar (é o eco do que o próprio VidaEmDia enviou).
  - Conhecido e `etag` diferente: `update`.
  - `status = cancelled`: cancelar.
  - Novo: `create` com `createdVia = 'GOOGLE'`.
- Notificações em tempo real (`events.watch`) exigem endereço público com HTTPS; ficam para depois. A consulta periódica basta.

### 2.6 Regras de negócio (decididas em 2026-11-12)
1. **Conflito de horário.** Decidido:
   - Quem cria ou altera pelo VidaEmDia (web, bot) continua sendo recusado em agenda PROFISSIONAL, como hoje.
   - Evento vindo do Google **nunca é recusado**: entra com `hasConflict = true` quando sobrepõe outro compromisso ativo da mesma agenda.
   - A tela mostra o aviso "Conflito de horário" nos dois compromissos envolvidos.
   - O sinal é recalculado na sincronização e quando um dos dois é alterado ou cancelado.
   - Campo novo: `Appointment.hasConflict` (Boolean, padrão false).
2. **Edição dos dois lados ao mesmo tempo:** vence a última alteração, comparando `updated` do Google com `updatedAt` local.
3. **Lembrete em dois lugares.** Decidido: a pessoa recebe pelo Google e pelo Telegram.
   - Evento criado pelo VidaEmDia vai ao Google com `reminders.useDefault = true`.
   - Evento importado recebe o lembrete do Telegram com o primeiro lembrete "popup" do próprio evento no Google; sem nenhum, usa 30 minutos.
4. **Dia inteiro.** Decidido: criar o conceito.
   - Campo `Appointment.allDay` (Boolean). Com `allDay`, `startTime` = 00:00 do dia e `endTime` = 00:00 do dia seguinte, no fuso de São Paulo.
   - No Google, usa `start.date`/`end.date` (sem hora).
   - Lembrete às **08:00 do dia** (ou na hora da criação, se já passou das 8h). O campo `reminderMinutesBefore` é ignorado nesse caso.
   - Não entra na checagem de conflito de horário.
   - Front: opção "Dia inteiro" no painel de criar e editar (passo 4.2), que esconde os campos de hora. Na lista do dia, aparece no topo como "Dia inteiro".
   - Bot: fora desta versão (continua criando só com horário).
5. **Repetição:** o VidaEmDia não cria evento que se repete (item C11 fora). Editar uma ocorrência no VidaEmDia altera só aquela ocorrência no Google.
6. **Quem fez a alteração vinda do Google:** sem usuário do VidaEmDia. Gravar na auditoria `actorUserId = null` e "via Google Agenda".
   A checagem de acesso é dispensada para o processo de sincronização, não para usuários.
7. **Privacidade.** Decidido:
   - **Só o dono** conecta o próprio Google e liga uma agenda dele. Secretária e outros com acesso delegado não conectam nem trocam a ligação.
   - Ao ligar, o dono escolhe a agenda do Google. A tela avisa: "Quem tem acesso a esta agenda no VidaEmDia vai ver os eventos dessa agenda do Google".
   - Eventos com visibilidade `private` ou `confidential` no Google entram com `Appointment.isPrivate = true`.
     Para quem **não é o dono**, a API devolve título "Ocupado", sem descrição. A auditoria grava "Compromisso privado" no lugar do título.
     O dono vê tudo e recebe o lembrete com o título real.
   - Compromisso criado pelo VidaEmDia não tem opção "privado" nesta versão.
   - Convites que o dono **recusou** no Google (`responseStatus = declined`) não são importados. Se já estavam importados, são cancelados.
8. **Secretária criando na agenda do Dr. João:** o evento vai para o Google do Dr. João, com o token dele. Correto e esperado.
   A agenda ligada mostra a marca "Sincronizada com o Google" para todos que têm acesso.

### 2.7 Front
- Menu da conta: "Conectar Google Agenda", estado conectado e e-mail do Google, desconectar.
- Configuração da agenda: escolher a agenda do Google ligada a ela.
- Na lista de compromissos: marca "Google" nos importados, aviso de "não sincronizado" quando o job falha e aviso de conflito.

### 2.8 Infra e DevOps
- Variáveis: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `GOOGLE_TOKEN_ENC_KEY` (sem valor padrão, seguindo o passo 7.4).
- Criptografia do refresh token: AES-256-GCM com `GOOGLE_TOKEN_ENC_KEY`.
- Métricas no Prometheus: eventos enviados, importados, falhas e tempo da sincronização.
- Mais de uma réplica do backend: a fila de saída e a sincronização precisam da mesma reserva no banco do passo 7.2, para não duplicar.
- Testes: client do Google com mock (insert, patch, delete, list com `syncToken`, 410), prevenção de eco, última alteração vence, cancelamento nos dois sentidos.

## 3. Ordem sugerida (novo Bloco 8 do roteiro)

| Passo | Entrega | Depende de | Esforço |
|-------|---------|------------|---------|
| 8.1 | Projeto Google Cloud, variáveis, `GoogleAccount`, conectar e desconectar (OAuth) | 7.1, 7.4 | M |
| 8.2 | Ligar agenda do VidaEmDia a uma agenda do Google; listar agendas | 8.1 | P |
| 8.3 | VidaEmDia → Google: fila de saída e worker | 8.2, 7.2 | M |
| 8.4 | Google → VidaEmDia: carga inicial e incremental, eco, cancelamento | 8.3 | G |
| 8.5 | Regras da seção 2.6: conflito sinalizado, dia inteiro (backend, worker e Google), privacidade ("Ocupado"), convites recusados, última alteração vence | 8.4 | G |
| 8.6 | Front: conectar, escolher agenda, marcas "Google", "Conflito", "Dia inteiro" e "Ocupado", opção "Dia inteiro" no painel | 8.5, 4.2 | M |
| 8.7 | Testes e métricas | 8.5 | M |

Total estimado: 6 a 8 dias de trabalho (dia inteiro e privacidade somam cerca de 1 dia). Fazer só o sentido VidaEmDia → Google (8.1 a 8.3) cabe em 2 a 3 dias e já dá para mostrar.

## 4. Decisões
- Seção 2.6: decidida em 2026-11-12. Itens 3 e 4 pelo usuário; itens 1 e 7 delegados ao orquestrador.
- Escopo do OAuth: usar o par restrito (`calendar.events` + `calendar.calendarlist.readonly`).
- No roteiro: Bloco 8, depois do 7.1, 7.2 e 7.4. O front dele (8.6) vem depois do 4.2, que ganha a opção "Dia inteiro" quando o 8.5 existir.
