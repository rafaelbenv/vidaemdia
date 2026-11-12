# 39 — Painel de criar e editar compromisso (roteiro 4.2, parte front; Fase 4 do plano 19; itens B1, B6, A1, C9)

Referência de desenho: seção 4 do `.plans/19-novo-front.md`. Backend pronto no plano 38:
- `reminderMinutesBefore = 0` é "na hora do compromisso"; máx. 10080.
- `reminderEnabled: false` cria/deixa o compromisso sem lembrete.
- `PATCH /compromissos/:id` aceita `title, description, startTime, endTime, reminderMinutesBefore, reminderEnabled, reminderChannel`,
  mantém a duração se só o início mudar, checa conflito em agenda profissional e devolve o compromisso com `reminders` (mais recente primeiro).
- `POST /compromissos` devolve o compromisso com `reminders`.
Não execute comandos de terminal. Use só ferramentas de arquivo.

## Arquivos
- Criar: `frontend/src/components/agenda/AppointmentPanel.tsx`
- Editar: `frontend/src/api.ts`, `frontend/src/types.ts`, `frontend/src/App.tsx`, `frontend/src/pages/AgendaPage.tsx`,
  `frontend/src/components/agenda/DayList.tsx`, `frontend/src/components/agenda/AppointmentRow.tsx`, `frontend/src/lib/reminderText.ts` (se ajudar a reaproveitar o texto do horário)
- Apagar: `frontend/src/components/agenda/AppointmentForm.tsx`, `frontend/src/hooks/useAppointmentForm.ts` (e o `handleCreateAppointment` antigo do `App`)

## Passos

### 1. API e tipos
- `types.ts`: `CreateAppointmentBody` ganha `reminderEnabled?: boolean`. Criar `UpdateAppointmentBody` (`Partial` dos campos editáveis + `reminderEnabled`).
- `api.ts`: `updateAppointment(token, id, body): Promise<Appointment>` com `PATCH /compromissos/:id`.

### 2. `AppointmentPanel.tsx`
Props:
```ts
{
  mode: 'create' | 'edit';
  appointment?: Appointment;          // no modo edit
  calendar: Calendar;                 // agenda aberta (nome e cor)
  defaultDate: string;                // 'YYYY-MM-DD' do dia aberto na agenda
  canEdit: boolean;                   // criar (create) ou alterar (edit)
  canCancel: boolean;
  saving: boolean;
  serverError: string | null;
  onClose: () => void;
  onSubmit: (values: AppointmentFormValues) => void;
  onRequestCancel: () => void;        // abre o ConfirmDialog que já existe no App
}
```
`AppointmentFormValues` (exportar): `{ title: string; date: string; time: string; endTime: string; description: string; reminder: 'none' | number }`.

Estrutura (desktop: gaveta à direita; celular: tela cheia):
- Fundo `fixed inset-0 bg-stone-900/30 z-30` (clique fecha) e painel `fixed inset-y-0 right-0 z-40 w-full sm:w-[420px] bg-white border-l border-stone-200 shadow-xl flex flex-col`,
  com `role="dialog" aria-modal="true" aria-labelledby="painel-titulo"`. `Escape` fecha. Ao abrir, foco no campo "O que é?".
- Cabeçalho `px-5 py-4 border-b border-stone-200 flex items-center justify-between`: `h2#painel-titulo` "Novo compromisso" / "Editar compromisso"
  (`text-base font-semibold`) e botão de ícone `X` com `aria-label="Fechar"`.
- Corpo rolável `flex-1 overflow-y-auto px-5 py-4 space-y-4`:
  - Linha da agenda: bolinha `calendar.color` + nome (`text-sm text-stone-600`).
  - Se `serverError`: caixa `role="alert"` `text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2`.
  - Compromisso cancelado (`appointment.status === 'CANCELLED'`): aviso "Este compromisso foi cancelado." e todos os campos desabilitados, sem botões de ação.
  - Sem `canEdit` (e não cancelado): aviso `text-sm text-stone-600` "Você pode ver este compromisso, mas não alterá-lo." e campos desabilitados.
  - Campos, todos com `<label htmlFor>` ligado ao `id` do campo, label `text-sm font-medium text-stone-700`, input `w-full border border-stone-300 rounded-md px-3 py-2 text-sm` (altura mínima 44px):
    1. "O que é?" — texto, obrigatório.
    2. "Dia" (`type=date`) e "Horário" (`type=time`), lado a lado em `grid grid-cols-2 gap-3`.
    3. "Lembrete no Telegram" — `<select>`: "Sem lembrete" (`none`), "Na hora" (0), "15 minutos antes" (15), "30 minutos antes" (30), "1 hora antes" (60), "1 dia antes" (1440).
       Padrão no criar: 30. No editar: `none` se o compromisso não tem lembrete PENDING nem SENT nem FAILED; senão `reminderMinutesBefore`
       (se o valor não estiver na lista, acrescentar uma opção "N minutos antes" com ele).
    4. Botão de abrir/fechar "Mais opções" (`ChevronRight` girando 90°, `aria-expanded`). Dentro: "Término" (`type=time`, opcional) e "Descrição" (`textarea` 3 linhas).
       No editar, abrir já expandido se houver descrição ou se o término não for 1 h depois do início.
  - Erros ao lado do campo (`text-xs text-red-600 mt-1`, `aria-describedby` no campo), validados ao salvar:
    - título vazio: "Diga o que é o compromisso.";
    - dia/horário vazio: "Escolha o dia e o horário.";
    - no criar, data+hora no passado: "Escolha um horário a partir de agora." (usar `checkIsPast` de `lib/format.ts`);
    - término preenchido e menor ou igual ao início: "O término deve ser depois do início.".
- Rodapé `px-5 py-4 border-t border-stone-200 flex items-center justify-between gap-3`:
  - Esquerda, só no editar com `canCancel` e não cancelado: botão "Cancelar compromisso" `text-sm font-medium text-red-700 hover:bg-red-50 px-3 py-2 rounded-md` → `onRequestCancel`.
  - Direita: "Salvar" primário (`bg-brand-700 hover:bg-brand-800 text-white`), com `Loader2` girando e "Salvando…" quando `saving`; oculto sem `canEdit` ou se cancelado.

### 3. `App.tsx` — estado e handlers
- Estado: `panel: { mode: 'create' } | { mode: 'edit'; appointmentId: string } | null`, `panelSaving: boolean`, `panelError: string | null`.
- `openNewAppointment()`, `openEditAppointment(appt)`, `closePanel()` (limpa erro).
- `handleSaveAppointment(values)`:
  - `start = new Date(`${values.date}T${values.time}`)`; `end = values.endTime ? new Date(`${values.date}T${values.endTime}`) : undefined`.
  - Corpo: `title.trim()`, `description.trim() || undefined` (no editar, enviar `''` para apagar quando o campo foi esvaziado),
    `startTime: start.toISOString()`, `endTime: end?.toISOString()` (no editar sem término preenchido: não enviar `endTime`),
    `reminderEnabled: values.reminder !== 'none'`, `reminderMinutesBefore: values.reminder === 'none' ? undefined : values.reminder`, `reminderChannel: 'TELEGRAM'`.
  - Criar: `createAppointment(token, { calendarId: selectedCalendarId, ...corpo })`. Editar: `updateAppointment(token, id, corpo)`.
  - Sucesso: fechar o painel, `loadAppointments(selectedCalendarId)`, e banner de sucesso (o `FeedbackBanner` existente) com título:
    - com lembrete: "Compromisso salvo. Lembrete às 07:30." (horário do `reminders[0].remindAt` da resposta; se em outro dia: "Lembrete em 09/11 às 07:30.");
    - sem lembrete: "Compromisso salvo. Sem lembrete.".
    Se a agenda é do próprio usuário e `!telegramLinked`, `detail`: "Conecte o Telegram para receber o lembrete."
  - Erro: `panelError = errorMessage(err)` (403 → `getErrorMessageByStatus(403)`); o painel continua aberto.
- Cancelar pelo painel: `openCancelDialog(appt)` (já existe). Depois que o cancelamento der certo, fechar o painel.
- Permissões da agenda aberta (`activeCalendar`): dono (`ownerId === user.id`) ou ADMIN → tudo `true`; delegada → `activeCalendar.myPermissions` (`canCreate`, `canUpdate`, `canCancel`).
- Remover: `useAppointmentForm`, `handleCreateAppointment` antigo, props de formulário passadas à `AgendaPage`.
- Renderizar o `AppointmentPanel` quando `panel !== null` (agenda aberta e `activeCalendar` definidos), com `key` diferente por compromisso para reiniciar o estado.

### 4. `AgendaPage`, `DayList`, `AppointmentRow`
- "+ Novo compromisso", o botão flutuante e o "Novo compromisso" do dia vazio chamam `onNew` (= `openNewAppointment`). Sem `canCreate`, os três somem.
  O painel recebe `defaultDate` = dia aberto na agenda.
- A linha inteira vira clicável: `<button type="button" className="w-full text-left ...">` (ou `div` com `role="button"`, `tabIndex=0`, Enter/Espaço) que chama `onOpen(appt)`; foco visível `focus-visible:ring-2 focus-visible:ring-brand-600 rounded-md`.
- **Remover** o ícone de lixeira da linha (cancelar agora é pelo painel). Cancelados continuam escondidos atrás do "Mostrar N cancelados"; clicar em um abre o painel em modo leitura.
- Remover o card do formulário temporário da `AgendaPage`.

## Critérios de aceite
- `npm run build` e `npm run lint` (0 erros).
- Criar com "30 minutos antes" mostra "Compromisso salvo. Lembrete às HH:MM." com o horário certo; aparece na lista do dia escolhido.
- Criar com "Sem lembrete": a linha não mostra lembrete.
- Clicar na linha abre o painel preenchido; mudar horário, término e descrição e salvar atualiza a linha.
- "Cancelar compromisso" pede confirmação, cancela e fecha o painel; a linha some (vai para "Mostrar cancelados").
- Conflito em agenda profissional aparece no topo do painel, sem fechar.
- Em 375px: o painel ocupa a tela, sem rolagem horizontal; dá para criar, editar e cancelar.

## O que NÃO alterar
- Backend, Bastidores, `LoginPage`, `CompartilharPage`, `UserMenu`, a tira da semana.
