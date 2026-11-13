# 61 — Google Agenda, parte 4: telas de conectar e de ligar a agenda (roteiro 8.6, versão mínima)

Depende dos planos 58, 59 e 60 (API pronta). Só o essencial para o usuário usar a integração.
Não execute comandos de terminal. Use só ferramentas de arquivo.

## API disponível
- `GET /google/status` → `{ configured, connected, email?, lastError? }`.
- `GET /google/connect` → `{ url }` (abrir na mesma aba; o Google volta para `/agenda?google=conectado` ou `/agenda?google=erro`).
- `DELETE /google/link` → desconecta.
- `GET /google/calendars` → `[{ id, summary, primary, backgroundColor }]`.
- `PUT /agendas/:id/google` `{ googleCalendarId }` e `DELETE /agendas/:id/google` → devolvem a agenda.
- `GET /agendas` → cada agenda traz `googleCalendarId` e `googleCalendarName`. Cada compromisso traz `googleSyncError`.

## Arquivos
- Editar: `frontend/src/api.ts`, `frontend/src/types.ts`, `frontend/src/App.tsx`, `frontend/src/components/UserMenu.tsx`,
  `frontend/src/components/CalendarMenu.tsx`, `frontend/src/components/agenda/AppointmentRow.tsx`, `frontend/src/test/mockApi.ts` (rota de status)
- Criar: `frontend/src/components/GoogleLinkDialog.tsx`

## Passos

### 1. API e tipos
Funções em `api.ts` para as seis rotas acima. Tipos `GoogleStatus` e `GoogleCalendarOption` em `types.ts`.

### 2. Estado no `App`
- `googleStatus` carregado no `loadSession` (falha da chamada não pode quebrar a carga: em erro, `{ configured: false, connected: false }`).
- Ao abrir `/agenda` com `?google=conectado`: toast de sucesso "Google Agenda conectado." e, se a agenda aberta for do usuário e não estiver ligada,
  abrir o `GoogleLinkDialog` dela. Com `?google=erro`: toast de erro "Não foi possível conectar o Google Agenda." com detalhe "Tente de novo. Se continuar, confira se seu e-mail está na lista de usuários de teste do app no Google.".
  Nos dois casos, tirar o parâmetro `google` da URL (`replace`), mantendo os demais.
- `handleConnectGoogle()`: `getGoogleConnectUrl` e `window.location.assign(url)`.
- `handleDisconnectGoogle()`: `ConfirmDialog` "Desconectar o Google Agenda?" / "Os compromissos deixam de ir para o Google. O que já foi enviado continua lá." /
  botão "Desconectar"; ao confirmar, `DELETE /google/link`, recarregar status e agendas, toast "Google Agenda desconectado.".

### 3. Menu da conta (`UserMenu`)
Só quando `googleStatus.configured`: uma linha abaixo da do Telegram, no mesmo estilo:
- conectado: "Google Agenda: <email>" + botão-link "Desconectar";
- não conectado: "Google Agenda: não conectado" + botão "Conectar";
- com `lastError`: o texto do erro em `text-xs text-red-600` e o botão "Conectar de novo".

### 4. Menu de agendas (`CalendarMenu`)
Só quando `googleStatus.configured` e a agenda aberta é do usuário (`canShareSelected`): item "Google Agenda…" (ícone `CalendarSync` ou `RefreshCw`),
abaixo de "Histórico desta agenda", que abre o `GoogleLinkDialog`. Se a agenda estiver ligada, o item mostra "Google Agenda: <googleCalendarName>".

### 5. `GoogleLinkDialog.tsx`
Diálogo modal (`role="dialog"`, `aria-modal`, `useFocusTrap`, `Escape` fecha), título "Sincronizar com o Google Agenda", props `{ calendar, googleStatus, token, onClose, onChanged, onConnect }`.
- Não conectado: texto "Conecte sua conta Google para enviar os compromissos desta agenda para o Google Agenda." e botão "Conectar Google Agenda" (`onConnect`).
- Conectado e agenda **não ligada**: carrega `GET /google/calendars` (estado "Carregando suas agendas do Google…"; erro em `role="alert"`), mostra um `<select>` com `<label>` "Enviar para"
  (opções pelo `summary`; a `primary` aparece primeiro com " (principal)") e o aviso `text-xs text-stone-600`:
  "Os compromissos desta agenda (a partir de ontem) e os próximos que forem criados, alterados ou cancelados aqui vão aparecer nessa agenda do Google. Quem tem acesso a esta agenda no VidaEmDia também vê o que for enviado."
  Botão "Ligar" (primário) → `PUT`; sucesso: `onChanged()` (recarrega agendas e compromissos), toast "Agenda ligada ao Google Agenda." e fecha.
- Conectado e agenda **ligada**: "Esta agenda envia os compromissos para <googleCalendarName> no Google Agenda." e botão "Parar de sincronizar" (perigo) → `DELETE`;
  sucesso: `onChanged()`, toast "Sincronização com o Google desligada.", fecha.
- Rodapé com "Fechar".

### 6. Linha do compromisso
Se `appt.googleSyncError`, acrescentar na linha secundária (dentro do limite de informações, depois do lembrete) um texto `text-red-600` com ícone `AlertTriangle` "Não foi para o Google"
e `title={appt.googleSyncError}`.

### 7. Testes
Em `src/test/mockApi.ts`, responder `GET /google/status` com `{ configured: false, connected: false }` (os testes atuais continuam passando, e nada do Google aparece).

## Critérios de aceite
- `npm run build`, `npm run lint` (0 erros) e `npm test` no front.
- Com a integração configurada: o menu da conta mostra "Google Agenda: não conectado / Conectar"; o menu de agendas do dono mostra "Google Agenda…".
- Para a Maria (agenda delegada), o item "Google Agenda…" não aparece.
- Em 375px, o diálogo cabe na tela.

## O que NÃO alterar
- Backend, Bastidores, painel de compromisso.
