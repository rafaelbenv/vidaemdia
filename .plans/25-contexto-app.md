# Mapa de Contexto e Arquitetura do `frontend/src/App.tsx`

> Este documento apresenta o mapeamento detalhado da estrutura atual do `App.tsx` e dos módulos em `frontend/src/` (`App.tsx`, `types.ts`, `api.ts`, `main.tsx`), servindo como base técnica para refatoração e componentização.

---

## 1. Funções e Componentes de Topo

| Função / Componente | Intervalo de Linhas | Descrição / Responsabilidade |
| :--- | :--- | :--- |
| `sanitizeTelegramHtml(rawHtml: string): string` | L38–L54 | Sanitiza mensagens HTML recebidas do Telegram via regex, permitindo apenas tags seguras (`<b>`, `<i>`, `<code>`) e removendo todas as demais. |
| `TechTag({ children }: { children: React.ReactNode })` | L56–L62 | Componente visual auxiliar que renderiza badges/chips com fonte monoespaçada estilizada para tags técnicas e de arquitetura. |
| `getErrorMessageByStatus(status?: number \| string): string` | L64–L70 | Mapeia códigos de status HTTP (400, 401, 403, padrão) para mensagens de erro amigáveis em português exibidas ao usuário. |
| `todayStr` (constante calculada) | L72–L78 | Expressão auto-executada (IIFE) que computa e formata a data atual no formato `YYYY-MM-DD` para o valor mínimo e padrão do input de data. |
| `checkIsPast(dateStr: string, timeStr: string): boolean` | L80–L87 | Valida se a combinação de data (`YYYY-MM-DD`) e hora (`HH:MM`) informada no formulário de compromisso antecede o instante atual (`Date.now()`). |
| `formatApptDateTime(isoString: string): { date: string; time: string }` | L89–L96 | Converte timestamp ISO de um compromisso em formato legível de data (`DD/MM`) e hora (`HH:MM`). |
| `ConfirmDialog(props: ConfirmDialogProps)` | L111–L200 | Modal de confirmação acessível (WAI-ARIA, foco automático no botão seguro/cancelar, fechamento via tecla `Escape` ou clique no backdrop). |
| `TAB_DEFINITIONS` (constante) | L210–L216 | Lista estática de configuração com as 5 abas da aplicação (`agenda`, `rbac`, `worker`, `chatbot`, `auditoria`), seus rótulos e ícones do Lucide. |
| `getVisibleTabs(role?: UserRole): TabId[]` | L218–L233 | Determina a lista de IDs de abas acessíveis e visíveis para cada papel de usuário (`USER`, `SECRETARY`, `PROFESSIONAL`, `ADMIN`). |
| `App()` | L235–L2312 | Componente raiz da aplicação que orquestra todo o estado global, autenticação JWT, chamadas de API, navegação por abas e renderização das sub-telas. |

---

## 2. Estado do Componente Principal (`App`)

### `useState`

| Variável de Estado | Linhas | Tipo / Valor Inicial | Finalidade |
| :--- | :--- | :--- | :--- |
| `token` | L236 | `string \| null` (carregado de `localStorage.getItem('vidaemdia_jwt')`) | Armazena o JSON Web Token de autenticação da sessão ativa. |
| `user` | L237 | `User \| null` (`null`) | Dados do usuário logado (id, nome, email, papel/role, canal de notificação). |
| `activeTab` | L238 | `TabId` (`'agenda'`) | Identificador da aba atualmente ativa e renderizada no painel principal. |
| `userMenuOpen` | L239 | `boolean` (`false`) | Controla a abertura do dropdown de perfil no cabeçalho. |
| `telegramLinked` | L305 | `boolean` (`false`) | Flag indicando se a conta do usuário está vinculada ao Telegram bot. |
| `telegramWaiting` | L306 | `boolean` (`false`) | Flag indicando se há uma tentativa de conexão com Telegram aguardando ação no bot. |
| `email` | L329 | `string` (`'dr.joao@vidaemdia.com.br'`) | Campo de e-mail do formulário de login. |
| `password` | L330 | `string` (`'123456'`) | Campo de senha do formulário de login. |
| `authError` | L331 | `string \| null` (`null`) | Mensagem de erro ao falhar a autenticação no login. |
| `loading` | L332 | `boolean` (`false`) | Indicador de carregamento inicial ou durante o login. |
| `ownedCalendars` | L335 | `Calendar[]` (`[]`) | Agendas pertencentes ao próprio usuário logado. |
| `delegatedCalendars` | L336 | `Calendar[]` (`[]`) | Agendas delegadas ao usuário logado via permissões RBAC. |
| `selectedCalendarId` | L337 | `string` (`''`) | ID da agenda atualmente selecionada para visualização e agendamento. |
| `appointments` | L338 | `Appointment[]` (`[]`) | Lista de compromissos carregados da agenda selecionada. |
| `loadingAppointments`| L339 | `boolean` (`false`) | Indicador de carregamento assíncrono dos compromissos da agenda selecionada. |
| `professionals` | L340 | `ProfessionalDirectoryEntry[]` (`[]`) | Diretório de profissionais e suas agendas para testes e gerenciamento RBAC. |
| `auditLogs` | L341 | `AuditLogEntry[]` (`[]`) | Registros imutáveis de auditoria (criações, cancelamentos, acessos 403, etc.). |
| `submitting` | L344 | `Record<string, boolean>` (`{}`) | Dicionário de flags de submissão concorrente por chave (`saveAppt`, `cancelAppt:<id>`, `grant`, `worker`, `chat`, `telegram`). |
| `confirmModal` | L350–L359 | `ConfirmModalProps \| null` (`null`) | Configuração e estado do modal de confirmação ativo (para cancelamentos, desconexão ou logout). |
| `workerStats` | L410 | `any` (`null`) | Estatísticas do worker de notificação (ciclos executados, política de retries, último disparo). |
| `remindersQueue` | L411 | `Reminder[]` (`[]`) | Fila de lembretes persistidos no PostgreSQL (tabela `reminders`). |
| `dispatchedMessages` | L412 | `DispatchedMessageLog[]` (`[]`) | Log das mensagens despachadas e entregues ao Telegram (simulação de celular). |
| `healthData` | L413 | `any` (`null`) | Dados consolidados de saúde e DevOps (`/health`: banco, worker, métricas de bloqueios 403). |
| `formTitle` | L416 | `string` (`''`) | Campo título do formulário de novo compromisso. |
| `formDate` | L417 | `string` (`todayStr`) | Campo data do formulário de novo compromisso. |
| `formTime` | L418 | `string` (`'08:00'`) | Campo horário do formulário de novo compromisso. |
| `formDesc` | L419 | `string` (`''`) | Campo descrição/observações do novo compromisso. |
| `formReminderMinutes`| L420 | `number` (`0`) | Tempo de antecedência para envio do lembrete (0, 15, 30, 60 min). |
| `formChannel` | L421 | `NotificationChannel` (`'TELEGRAM'`) | Canal de notificação selecionado para o lembrete. |
| `dateError` | L422 | `string \| null` (`null`) | Mensagem de validação quando a data/hora selecionada está no passado. |
| `feedbackBanner` | L423–L427 | `{ type: 'success' \| 'error', title: string, detail?: string } \| null` (`null`) | Banner de notificação e alertas de sucesso/erro na interface. |
| `secretaryEmailToGrant` | L439 | `string` (`'secretaria.maria@vidaemdia.com.br'`) | E-mail da secretária a receber permissão RBAC na agenda do profissional. |
| `botInput` | L442 | `string` (`'Marcar Consulta médica hoje às 08:00'`) | Texto do input para conversa interativa com o chatbot. |
| `chatHistory` | L443–L452 | `Array<{ sender, text, time, channel }>` (1 mensagem de boas-vindas) | Histórico de mensagens enviadas e recebidas do chatbot. |

### `useRef` e `useEffect`

| Hook | Linhas | Finalidade |
| :--- | :--- | :--- |
| `useRef` (`userMenuRef`) | L240 | Referência DOM do dropdown do usuário para detecção de clique fora. |
| `useEffect` | L243–L262 | Listener global de `mousedown` e `keydown` (`Escape`) para fechar o menu do usuário. |
| `useEffect` | L265–L272 | Sincroniza a aba ativa quando o usuário/papel muda: caso a aba atual não seja permitida para o papel, redireciona para `'agenda'`. |
| `useRef` (`pollingRef`, `pollingTimeoutRef`) | L307–L308 | IDs de timer para o polling (`setInterval`) e timeout (`setTimeout`) da vinculação do Telegram. |
| `useEffect` | L322–L326 | Cleanup ao desmontar o componente, cancelando polling de Telegram pendente. |
| `useEffect` | L429–L436 | Timer de auto-dismiss de 5 segundos para o `feedbackBanner` quando o tipo for `'success'`. |
| `useEffect` | L454–L458 | Dispara `loadInitialData(token)` quando `token` torna-se disponível. |
| `useEffect` | L460–L464 | Dispara `loadAppointments(selectedCalendarId)` quando `selectedCalendarId` ou `token` são alterados. |

---

## 3. Chamadas de API

Todas as requisições HTTP utilizam a função utilitária `apiRequest<T>` (definida em `frontend/src/api.ts`), com base na URL `VITE_API_URL` (fallback `http://localhost:3000`).

### Mecanismo de Token e Tratamento de Erros
- **Token JWT:** Quando passado, `apiRequest` injeta o header `Authorization: Bearer <token>`.
- **Tratamento de 401 (Não Autorizado / Sessão Expirada):**
  - Em `loadInitialData` (L505–L507): Se qualquer requisição falhar com `err.status === 401`, é executada `handleLogout()`, que limpa o `localStorage('vidaemdia_jwt')`, reseta estados de autenticação (`token = null`, `user = null`) e força a exibição da tela de login.
  - No `getErrorMessageByStatus` (L67): O status 401 mapeia para a mensagem *"Sua sessão expirou. Entre de novo."*.
- **Tratamento de Erros Gerais e 403 (RBAC):**
  - `apiRequest` rejeita com um objeto `Error` contendo a propriedade `.status`.
  - Códigos 403 (Acesso Proibido/RBAC) geram banners de feedback de erro com instrução clara e atualizam a tabela de auditoria (`/auditoria`) para refletir o log de segurança registrado.

### Tabela de Endpoints Chamados

| Método | Caminho | Onde é chamado | Função no `App.tsx` | Propósito |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/auth/login` | L537–L540 | `handleLogin` | Autentica o usuário via e-mail e senha, retornando `accessToken` e objeto `user`. |
| `GET` | `/auth/me` | L470 | `loadInitialData` | Carrega o perfil do usuário logado através do token JWT. |
| `GET` | `/agendas` | L471 | `loadInitialData` | Retorna as agendas próprias (`owned`) e delegadas via RBAC (`delegated`). |
| `GET` | `/agendas/profissionais` | L472 | `loadInitialData` | Retorna a lista de profissionais e suas agendas para testes de acesso pela secretária. |
| `GET` | `/auditoria` | L473, L698, L755 | `loadInitialData`, `handleCreateAppointment`, `handleSelectProfessionalCalendar` | Busca os registros de logs de auditoria imutáveis. |
| `GET` | `/notificacoes/status` | L474 | `loadInitialData` | Obtém o estado do worker de lembretes, fila pendente e mensagens enviadas. |
| `GET` | `/health` | L475 | `loadInitialData` | Busca métricas de saúde, DevOps e bloqueios 403. |
| `GET` | `/telegram/status` | L490 (via `getTelegramStatus` em `api.ts:43`) | `loadInitialData`, `handleConnectTelegram` (polling) | Verifica se o usuário atual vinculou seu Telegram. |
| `POST` | `/telegram/link` | L579 (via `createTelegramLink` em `api.ts:47`) | `handleConnectTelegram` | Gera a URL com token seguro para vincular o bot Telegram. |
| `DELETE` | `/telegram/link` | L628 (via `unlinkTelegram` em `api.ts:51`) | `handleUnlinkTelegram` | Desconecta a conta do usuário do Telegram. |
| `GET` | `/compromissos?calendarId={id}` | L517 | `loadAppointments` | Carrega os compromissos agendados para a agenda selecionada. |
| `POST` | `/compromissos` | L663–L677 | `handleCreateAppointment` | Cria um novo compromisso na agenda selecionada e enfileira lembretes. |
| `DELETE` | `/compromissos/{id}` | L714 | `handleCancelAppointment` | Cancela um compromisso existente e grava log de auditoria. |
| `GET` | `/agendas/{id}/verificar-acesso` | L739 | `handleSelectProfessionalCalendar` | Testa a autorização RBAC de acesso da secretária (retorna 200 OK ou 403 Forbidden). |
| `POST` | `/agendas/{id}/permissoes` | L767–L780 | `handleGrantSecretaryPermission` | O profissional concede permissões RBAC completas (view, create, update, cancel) à secretária. |
| `POST` | `/notificacoes/executar-worker` | L804 | `handleRunWorkerNow` | Força a execução manual imediata de um ciclo de envio de lembretes do Worker. |
| `POST` | `/notificacoes/simular-falha` | L825–L828 | `handleSimulateFailure` | Simula falha proposital no disparo do Telegram para testar a fila de retry (até 3 tentativas). |
| `POST` | `/notificacoes/bot/webhook` | L859–L868 | `handleSendBotMessage` | Envia mensagem conversacional para processamento pelo assistente Telegram. |

---

## 4. Navegação por Abas e Matriz de Papéis (RBAC no Frontend)

O tipo de identificador de aba é:
```ts
export type TabId = 'agenda' | 'rbac' | 'worker' | 'chatbot' | 'auditoria';
```

As 5 abas disponíveis no sistema são:
1. **`agenda`** (Agenda): Visualização da agenda ativa, listagem de compromissos e formulário de cadastro.
2. **`rbac`** (Acessos): Gerenciamento e teste de delegação de acesso entre profissionais e secretárias.
3. **`worker`** (Lembretes): Monitoramento da fila de lembretes, execução forçada do ciclo e simulador de celular Telegram.
4. **`chatbot`** (Assistente): Interface de chat para interagir com o assistente do Telegram.
5. **`auditoria`** (Auditoria): Métricas de saúde do sistema, contadores DevOps e tabela de logs imutáveis.

### Matriz de Visibilidade por Papel (`getVisibleTabs`, L218–L233)

| Papel (`UserRole`) | Abas Visíveis | Justificativa de Negócio |
| :--- | :--- | :--- |
| *(Não autenticado / Vazio)* | `['agenda']` | Visualização padrão inicial antes da identificação do perfil. |
| `USER` | `['agenda', 'chatbot']` | Usuário comum focado em gerenciar sua própria agenda e usar o assistente Telegram. Não tem acesso a painéis administrativos ou workers. |
| `SECRETARY` | `['agenda', 'rbac', 'chatbot']` | Acessa sua agenda/agendas delegadas, o painel RBAC para selecionar agendas de profissionais e o assistente. |
| `PROFESSIONAL` | `['agenda', 'rbac', 'worker', 'chatbot', 'auditoria']` | No cenário da aplicação (onde o seed não inclui uma conta ADMIN dedicada), o profissional tem visão executiva completa dos lembretes, worker, auditoria e delegações. |
| `ADMIN` | `['agenda', 'rbac', 'worker', 'chatbot', 'auditoria']` | Administrador com acesso pleno a todas as 5 abas do sistema. |

### Regras de Navegação
- **Proteção contra abas órfãs (L265–L272):** Ao trocar de perfil ou carregar o usuário, se a `activeTab` atual não estiver na lista retornada por `getVisibleTabs(user.role)`, ela é automaticamente resetada para `'agenda'`.
- **Acessibilidade por teclado (L275–L302):** A barra de abas implementa o padrão WAI-ARIA com navegação pelas teclas `ArrowRight`, `ArrowLeft`, `Home` e `End`, focando dinamicamente no elemento `tab-<id>`.

---

## 5. Mapeamento de Telas e Props (Atual vs. Proposto na Refatoração)

Atualmente, `App.tsx` é um **monolito de 2.312 linhas** onde a tela de login e todas as 5 abas são renderizadas **inline** no mesmo arquivo. 

A tabela a seguir mapeia cada sub-tela inline identificada, as linhas que ocupa e a assinatura de props recomendada para a extração em componentes dedicados:

| Sub-tela / Seção Inline | Intervalo de Linhas | Props que Consome / Necessita na Extração |
| :--- | :--- | :--- |
| **Tela de Login** | L902–L1063 | `email: string`<br>`setEmail: (val: string) => void`<br>`password: string`<br>`setPassword: (val: string) => void`<br>`authError: string \| null`<br>`loading: boolean`<br>`onLogin: (e?: React.FormEvent, quickEmail?: string) => Promise<void>` |
| **Aba Agenda** (`activeTab === 'agenda'`) | L1303–L1650 | `user: User`<br>`calendars: Calendar[]`<br>`selectedCalendarId: string`<br>`onSelectCalendar: (id: string) => void`<br>`appointments: Appointment[]`<br>`loadingAppointments: boolean`<br>`formValues: { title, date, time, desc, reminderMinutes, channel }`<br>`formSetters: { setTitle, setDate, setTime, setDesc, setReminderMinutes, setChannel }`<br>`dateError: string \| null`<br>`submitting: Record<string, boolean>`<br>`onCreateAppointment: (e: React.FormEvent) => Promise<void>`<br>`onCancelAppointmentClick: (appt: Appointment) => void`<br>`onRefreshAppointments: () => Promise<void>` |
| **Aba Acessos RBAC** (`activeTab === 'rbac'`) | L1655–L1832 | `user: User`<br>`ownedCalendars: Calendar[]`<br>`professionals: ProfessionalDirectoryEntry[]`<br>`selectedCalendarId: string`<br>`onSelectCalendar: (id: string) => void`<br>`onSelectProfessionalCalendar: (calId: string, profName: string) => Promise<void>`<br>`secretaryEmailToGrant: string`<br>`setSecretaryEmailToGrant: (val: string) => void`<br>`onGrantPermission: (e: React.FormEvent) => Promise<void>`<br>`isGranting: boolean` |
| **Aba Lembretes Worker** (`activeTab === 'worker'`) | L1837–L2008 | `workerStats: any`<br>`remindersQueue: Reminder[]`<br>`dispatchedMessages: DispatchedMessageLog[]`<br>`isRunningWorker: boolean`<br>`onRunWorkerNow: () => Promise<void>`<br>`onSimulateFailure: () => Promise<void>` |
| **Aba Assistente Chatbot** (`activeTab === 'chatbot'`) | L2013–L2133 | `chatHistory: Array<{ sender, text, time, channel }>`<br>`botInput: string`<br>`setBotInput: (val: string) => void`<br>`isSending: boolean`<br>`onSendMessage: (e: React.FormEvent) => Promise<void>` |
| **Aba Auditoria & DevOps** (`activeTab === 'auditoria'`) | L2138–L2283 | `healthData: any`<br>`auditLogs: AuditLogEntry[]` |
| **Menu do Usuário / Avatar** | L1104–L1205 | `user: User`<br>`isOpen: boolean`<br>`setIsOpen: (val: boolean) => void`<br>`telegramLinked: boolean`<br>`telegramWaiting: boolean`<br>`isTelegramSubmitting: boolean`<br>`onConnectTelegram: () => Promise<void>`<br>`onOpenUnlinkDialog: () => void`<br>`onOpenLogoutDialog: () => void` |

---

## 6. Dependências Entre Telas e Estado Compartilhado

A centralização do estado em `App.tsx` gera acoplamentos e efeitos colaterais transversais entre diferentes telas:

1. **Agenda Selecionada (`selectedCalendarId`) — Compartilhada entre Agenda e RBAC:**
   - Na aba **RBAC**, quando a Secretária clica em *"Acessar Agenda (Autorizado)"* de um Profissional (L735–L758), a função `handleSelectProfessionalCalendar` verifica a permissão, atualiza `selectedCalendarId` e redireciona automaticamente para a aba **Agenda** (`setActiveTab('agenda')`).
   - Na aba **RBAC**, o formulário de concessão de permissão pelo Profissional (L1748–L1793) utiliza `selectedCalendarId` para definir em qual das suas agendas a secretária terá acesso concedido.
2. **Criação de Compromissos (Agenda) refletindo em Lembretes (Worker) e Auditoria:**
   - Ao submeter um novo compromisso em `handleCreateAppointment` (L648–L704), a ação recarrega os compromissos (`loadAppointments`), mas também chama `loadInitialData(token)` para atualizar a contagem de lembretes na fila (`remindersQueue`), as estatísticas do worker e os logs de auditoria.
   - Em caso de erro na criação (L697–L700), os logs de auditoria (`auditLogs`) são recarregados para exibir eventuais bloqueios ou falhas registradas.
3. **Cancelamento de Compromissos (Agenda) refletindo em Auditoria:**
   - Ao cancelar um compromisso em `handleCancelAppointment` (L706–L732), além de recarregar a agenda, `loadInitialData` é disparado para atualizar os logs de auditoria e a fila de lembretes pendentes.
4. **Chatbot (Assistente) interagindo com Agenda:**
   - Quando o usuário solicita um agendamento ou consulta via chat em `handleSendBotMessage` (L844–L897), o backend executa o comando e a interface chama tanto `loadInitialData` quanto `loadAppointments(selectedCalendarId)`, atualizando a lista de compromissos da tela de Agenda sem recarregar a página.
5. **Conexão Telegram afetando a fila do Worker:**
   - Conectar ou desconectar o Telegram (L572–L645) dispara `loadInitialData`, sincronizando o status do canal preferencial do usuário com os dados do banco e ajustando a fila de lembretes.
6. **Tentativa de Acesso Negado (403 RBAC) refletindo na Auditoria:**
   - Quando uma secretária tenta acessar a agenda de um profissional para a qual não possui delegação (L747–L757), a API retorna 403 e a tela de auditoria é imediatamente atualizada (`setAuditLogs`) para exibir o evento `ACCESS_DENIED` com o ator, a agenda alvo e o IP da requisição.
