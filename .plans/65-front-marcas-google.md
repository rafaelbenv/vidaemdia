# 65 — Front: marcas do Google e opção "Dia inteiro" (roteiro 8.6, resto)

Depende dos planos 63 e 64 (o backend já devolve `allDay`, `hasConflict`, `isPrivate`, `createdVia: 'GOOGLE'`; os tipos já estão em `frontend/src/types.ts`).
Não execute comandos de terminal. Use só ferramentas de arquivo. Siga o estilo visual que já existe (Tailwind, tons `stone`/`brand`, ícones `lucide-react`).
Textos da tela em português simples, sem jargão.

## Arquivos
- Editar: `frontend/src/components/agenda/AppointmentRow.tsx`, `frontend/src/components/agenda/DayList.tsx`,
  `frontend/src/components/agenda/AppointmentPanel.tsx`, `frontend/src/App.tsx` (só a função `handleSaveAppointment` e o que passa props ao painel),
  `frontend/src/api.ts` (só os tipos `CreateAppointmentBody`/`UpdateAppointmentBody`, se forem definidos lá), `frontend/src/test/agenda.test.tsx`
- Não criar arquivos novos além de testes, se precisar.

## Passos

### 1. Linha do compromisso (`AppointmentRow.tsx`)
- Coluna da hora: se `appt.allDay`, mostrar `Dia inteiro` (mesma classe, `text-xs` para caber) no lugar de `formatTime(appt.startTime)`.
- Ao lado do título (mesmo lugar do `marker`), marcas pequenas, nesta ordem, só quando o compromisso **não** está cancelado:
  - `hasConflict` → "Conflito de horário", em tom de alerta (`text-amber-800 bg-amber-50`, ícone `AlertTriangle` 3.5);
  - `createdVia === 'GOOGLE'` → "Google" (`text-stone-600 bg-stone-100`);
  - `isPrivate` e o título é "Ocupado" (quem não é o dono) → nada a mais; o título "Ocupado" já diz. Para o dono, `isPrivate` → "Privado" (`text-stone-600 bg-stone-100`).
  Para saber se é o dono, receber uma prop nova `isOwner: boolean` (o `DayList` repassa; ver passo 2).
- Mesmo formato do `marker` atual: `text-[11px] font-semibold rounded px-1.5 py-0.5 shrink-0`.

### 2. Lista do dia (`DayList.tsx`)
- Ordenação: compromissos `allDay` primeiro (entre eles, por título), depois os com horário por `startTime`.
- Compromisso `allDay` não entra no cálculo de "em andamento"/"próximo" (o bloco que acha `ongoingApptId`/`firstFutureApptId`).
- `isPast` de compromisso `allDay`: `new Date(appt.endTime) < now` (já é assim; só confira).
- Nova prop `isOwner: boolean`, repassada para cada `AppointmentRow`. Quem renderiza o `DayList` (procure em `pages/AgendaPage.tsx` e `App.tsx`) passa
  `activeCalendar.ownerId === user.id` (ou o equivalente disponível ali). Se a página não tiver essa informação, adicionar a prop no caminho mínimo.

### 3. Painel (`AppointmentPanel.tsx`)
- `AppointmentFormValues` ganha `allDay: boolean`.
- Estado `allDay` (edição: `appointment.allDay ?? false`; criação: `false`). Uma caixa de seleção "Dia inteiro" logo abaixo do campo de data/horário.
- Com `allDay` marcado: esconder os campos de horário e de término; o lembrete mostra o texto fixo "Lembrete às 8h do dia" no lugar das opções de antecedência,
  mantendo a opção "Sem lembrete" (um seletor com duas opções: "Às 8h do dia" e "Sem lembrete" serve; o valor enviado continua sendo `reminder`).
- Validação com `allDay`: só exige a data; na criação, a data não pode ser antes de hoje (`date < todayStr()` → "Escolha um dia a partir de hoje.").
- Compromisso `isPrivate` aberto por quem não é o dono (receber prop `isOwner`): os campos título e descrição ficam desabilitados, com a nota
  "Compromisso particular do dono da agenda. Você pode mudar o horário ou cancelar." abaixo do título.
- Se `appointment.hasConflict`, mostrar no topo do corpo do painel um aviso âmbar: "Este horário se sobrepõe a outro compromisso da agenda."
- Se `appointment.createdVia === 'GOOGLE'`, mostrar abaixo do título uma linha discreta: "Veio do Google Agenda."

### 4. Envio (`App.tsx`, `handleSaveAppointment`)
- Com `values.allDay`: `startTime = new Date(`${values.date}T00:00`).toISOString()`, **sem** `endTime`, `allDay: true`;
  `reminderEnabled: values.reminder !== 'none'`, sem `reminderMinutesBefore`.
- Sem `allDay`: como hoje, e no update mandar `allDay: false` (para desfazer um dia inteiro).
- Acrescentar `allDay?: boolean` aos tipos `CreateAppointmentBody`/`UpdateAppointmentBody` onde estiverem.
- Passar `isOwner` ao painel (`activeCalendar?.ownerId === user?.id`).

### 5. Testes (`frontend/src/test/agenda.test.tsx`, mesmo estilo dos existentes)
- Compromisso `allDay` mostra "Dia inteiro" e aparece antes de um compromisso com horário no mesmo dia.
- `hasConflict` mostra "Conflito de horário"; `createdVia: 'GOOGLE'` mostra "Google".
- No painel, marcar "Dia inteiro" esconde o campo de horário.

## Critérios de aceite
- `npm run lint`, `npm run build` e `npm test` do front passam (o orquestrador roda).

## Não alterar
- Backend, `frontend/src/types.ts`, `GoogleLinkDialog.tsx`, `CalendarMenu.tsx`, as outras páginas.
