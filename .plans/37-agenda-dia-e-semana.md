# 37 — Agenda nova: lista do dia e tira da semana (roteiro 4.1; Fase 3 do plano 19; itens C2 dia/semana e C3)

Referência de desenho: seção 3 do `.plans/19-novo-front.md` (ler antes). Cores, fonte e cards do plano 12 continuam
(tons `stone`, verde `brand`, Figtree, `rounded-lg border border-stone-200 bg-white`).
Não execute comandos de terminal. Use só ferramentas de arquivo.

## O que a API já entrega
`GET /compromissos?calendarId=` devolve **todos** os compromissos da agenda (sem filtro de data), ordenados por `startTime`, cada um com
`reminders` (mais recente primeiro: `status` PENDING|SENT|FAILED, `remindAt`, `sentAt`), `createdBy {id, name}` e
`calendar.owner {id, name, telegramChatId}`. Filtrar por dia no front.
O sistema assume o fuso do navegador (São Paulo).

## Arquivos
- Criar: `frontend/src/lib/dates.ts`, `frontend/src/lib/reminderText.ts`,
  `frontend/src/components/agenda/WeekStrip.tsx`, `frontend/src/components/agenda/AppointmentRow.tsx`,
  `frontend/src/components/agenda/DayList.tsx`, `frontend/src/components/agenda/AppointmentForm.tsx`
- Reescrever: `frontend/src/pages/AgendaPage.tsx`
- Editar: `frontend/src/App.tsx` (props da `AgendaPage`), `frontend/src/types.ts` (acrescentar campos opcionais, se faltarem)

## Passos

### 1. `lib/dates.ts` (funções puras, data local)
`toDateKey(d)` → `'YYYY-MM-DD'`; `fromDateKey(key)` → `Date` às 00:00 local (inválida → hoje);
`addDays(d, n)`; `startOfWeek(d)` → segunda-feira 00:00; `isSameDay(a, b)`;
`formatLongDate(d)` → "Terça, 10 de novembro" (`Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })`, primeira letra maiúscula, sem "-feira": "Terça" e não "Terça-feira");
`formatWeekdayShort(d)` → "seg", "ter"... (sem ponto); `formatTime(iso)` → "08:00"; `formatDayMonth(iso)` → "10/11".

### 2. `lib/reminderText.ts`
`reminderLine(appt, opts: { ownerTelegramLinked: boolean }): { text: string; tone: 'muted' | 'danger' | 'action' } | null`
- Sem lembrete em `appt.reminders` → `null`.
- Pega `appt.reminders[0]`. Se `remindAt` cai em outro dia que o `startTime`, o horário vira "dd/mm às HH:MM"; no mesmo dia, "HH:MM".
- `FAILED` → `{ text: 'Lembrete falhou', tone: 'danger' }`.
- `SENT` → `{ text: 'Lembrete enviado às <sentAt ?? remindAt>', tone: 'muted' }`.
- `PENDING` e `!ownerTelegramLinked` → `{ text: 'Sem lembrete — conecte o Telegram', tone: 'action' }`.
- `PENDING` → `{ text: 'Lembrete às <remindAt>', tone: 'muted' }`.

### 3. `components/agenda/WeekStrip.tsx`
Props: `{ selected: Date; counts: Record<string, number>; onSelect: (d: Date) => void }`.
Sete botões de segunda a domingo da semana de `selected`, em `grid grid-cols-7 gap-1`. Cada um:
dia da semana curto (`text-xs text-stone-500`), número do dia (`text-base font-semibold tabular-nums`) e, embaixo,
a contagem (`text-xs text-stone-600`) ou `·` quando zero. Selecionado: `bg-brand-700 text-white` (textos internos claros);
hoje (não selecionado): `ring-1 ring-brand-600`; demais: `hover:bg-stone-100`. `aria-pressed` no selecionado, `aria-label`
"Terça, 10 de novembro, 3 compromissos". Altura mínima de 44px.

### 4. `components/agenda/AppointmentRow.tsx`
Props: `{ appt: Appointment; isPast: boolean; marker: string | null; reminder: ReturnType<typeof reminderLine>; createdByOther: string | null; onConnectTelegram: () => void; onCancel: () => void; cancelling: boolean }`.
Layout: `flex gap-4 py-3 border-b border-stone-100 last:border-0`.
- Esquerda, `w-14 shrink-0`: horário `formatTime(startTime)` em `text-sm font-semibold tabular-nums text-stone-900`.
- Centro, `flex-1 min-w-0`: título `text-sm font-medium text-stone-900 truncate`; à direita do título, se `marker`, um selo
  `text-[11px] font-semibold text-brand-800 bg-brand-50 rounded px-1.5 py-0.5` ("agora", "em 40 min").
  Linha secundária `text-xs text-stone-500 mt-0.5`, no máximo duas informações separadas por " · ":
  descrição (`truncate`, se houver) e o lembrete. Tom `danger`: `text-red-600` com ícone `AlertTriangle` (`w-3.5 h-3.5`);
  tom `action`: botão-link `text-brand-700 underline` que chama `onConnectTelegram`.
  Se `createdByOther`, acrescentar " · por <primeiro nome>".
- Cancelado (`status === 'CANCELLED'`): título com `line-through text-stone-400`, linha secundária só "Cancelado".
- `isPast`: horário e título em `text-stone-400`.
- Direita (temporário, até o passo 4.2): botão de ícone `Trash2` (`w-4 h-4`), `aria-label="Cancelar compromisso"`,
  `text-stone-400 hover:text-red-600 p-2 rounded-md`, que chama `onCancel`; desabilitado com `cancelling`; não aparece em cancelados.

### 5. `components/agenda/DayList.tsx`
Props: `{ day: Date; appointments: Appointment[] (já do dia); now: Date; ownerId: string; ownerTelegramLinked: boolean; onConnectTelegram; onCancel: (a: Appointment) => void; submitting: Record<string, boolean>; onNew: () => void }`.
- Ativos (`status !== 'CANCELLED'`) em ordem de horário. Cancelados escondidos; se houver, no fim da lista um botão-link
  `text-xs text-stone-500 hover:text-stone-800` "Mostrar N cancelado(s)" / "Esconder cancelados" que os revela (estado local).
- `isPast`: `endTime < now`.
- Marcador (só se `day` é hoje): compromisso em andamento (`startTime <= now < endTime`) → "agora"; senão, o primeiro futuro do dia →
  "em N min" se faltar menos de 60 min, senão "em N h" (arredondado para baixo).
- `createdByOther`: `appt.createdBy && appt.createdBy.id !== ownerId ? primeiro nome de createdBy.name : null`.
- Dia vazio (sem ativos): `py-10 text-center`, o texto "Nada marcado para " + `formatLongDate(day)` com a primeira letra minúscula + "."
  (exemplo exato: "Nada marcado para terça, 10 de novembro.") e, abaixo, um botão "Novo compromisso"
  (secundário: `border border-stone-300 rounded-md px-3 py-2 text-sm`) que chama `onNew`.

### 6. `components/agenda/AppointmentForm.tsx` (temporário até o 4.2)
Mover para cá, **sem alterar**, o JSX do formulário "Novo Compromisso" que hoje está na `AgendaPage`, com as mesmas props que ele usa.

### 7. `pages/AgendaPage.tsx` (reescrever)
Estado do dia na URL: `useSearchParams`, parâmetro `dia=YYYY-MM-DD` (ausente → hoje). Trocar de dia usa `setSearchParams({ dia }, { replace: true })`.
Estrutura, em `max-w-3xl mx-auto px-4 sm:px-6 py-6`:
1. **Seletor de agenda (temporário, até o 5.1):** `<label>` "Agenda" + `<select>` com `<optgroup label="Minhas agendas">` (as do usuário)
   e `<optgroup label="Agendas que gerencio">` (as delegadas, só se houver), valor `selectedCalendarId`, chamando `setSelectedCalendarId`.
   Classe do select: `border border-stone-300 rounded-md px-3 py-2 text-sm bg-white`. Ao lado, a bolinha na cor da agenda (`activeCalendar.color`).
2. **Cabeçalho do dia:** `flex flex-wrap items-center justify-between gap-3 mt-6`. Título `h1` `text-xl font-semibold text-stone-900` com `formatLongDate(dia)`.
   Ações: "Hoje" (secundário), `‹` e `›` (botões de ícone `ChevronLeft`/`ChevronRight`, `aria-label` "Semana anterior"/"Próxima semana", andam 7 dias),
   e "+ Novo compromisso" (primário `bg-brand-700 hover:bg-brand-800 text-white rounded-md px-3 py-2 text-sm font-medium`, `hidden sm:inline-flex`).
3. **Tira da semana** (`mt-4`), com contagens só de ativos, por `toDateKey(startTime)`.
4. **Formulário (temporário):** quando "+ Novo" é clicado, mostra o `AppointmentForm` dentro de um card acima da lista, com um botão "Fechar"; ao abrir, `setFormDate(toDateKey(dia))`. Depois de salvar com sucesso, fecha (usar o retorno/efeito que o handler já tiver; se não houver como saber, deixar aberto).
5. **Lista do dia** em card `bg-white rounded-lg border border-stone-200 px-4 mt-4`, com `DayList`. Carregando (`loadingAppointments`): "Carregando…" `text-sm text-stone-500 py-6 text-center`.
6. **Celular:** botão flutuante `sm:hidden fixed bottom-5 right-5 w-14 h-14 rounded-full bg-brand-700 text-white shadow-lg` com ícone `Plus` e `aria-label="Novo compromisso"`, mesma ação do "+ Novo".
`now`: estado atualizado a cada 60 s (`setInterval`) para os marcadores.
`ownerTelegramLinked`: se `activeCalendar.ownerId === user.id`, usar `telegramLinked` (prop nova vinda do `App`); senão, `Boolean(appointments[0]?.calendar?.owner?.telegramChatId)` — e, sem compromissos, `true`.
`onConnectTelegram`: prop nova (`handleConnectTelegram` do `App`). Só mostrar a ação de conectar quando a agenda é do próprio usuário; para agenda de outra pessoa, o texto fica "Sem lembrete — Telegram do dono não conectado" com tom `muted` (ajustar `reminderLine` com uma opção `isOwnCalendar`).

Sai da agenda: selos `TechTag`, "Origem: …", "Criado por …" (fica só o "por Maria" descrito acima), contagem de tentativas, selo AGENDADO,
botão "Atualizar Agenda", os cartões de agendas na lateral e o layout de duas colunas.

### 8. `types.ts`
Acrescentar em `Appointment` (opcionais): `calendar?: { id: string; name?: string; ownerId?: string; owner?: { id: string; name: string; telegramChatId?: string | null } }`.
`Calendar` precisa ter `ownerId` e `color` (conferir; acrescentar se faltar).

## Critérios de aceite
- `npm run build` e `npm run lint` (0 erros).
- `/agenda` mostra o dia de hoje, a tira da semana com contagens e a lista; clicar em outro dia troca a lista e a URL (`?dia=`); recarregar mantém o dia.
- `‹ ›` andam uma semana; "Hoje" volta.
- Cancelados escondidos com o link "Mostrar N cancelados".
- Linha com no máximo duas informações secundárias; estados do lembrete em texto.
- Maria, na agenda do Dr. João, vê "por Maria" nos compromissos que ela criou.
- Em 375px de largura: sem rolagem horizontal; botão flutuante aparece; "+ Novo compromisso" do cabeçalho some.
- Criar (pelo formulário temporário) e cancelar (pelo ícone) continuam funcionando.

## O que NÃO alterar
- Backend, `api.ts`, Bastidores, `LoginPage`, `UserMenu`, `CompartilharPage`.
- A lógica dos handlers no `App.tsx` (só as props passadas à `AgendaPage`).

## Correções após revisão (devolvido ao executor)
1. **Rolagem horizontal em 375px** (conta da secretária): o `<select>` de agenda cresce com o nome longo da agenda delegada.
   O contêiner do seletor vira `flex items-center gap-2 min-w-0`, o `<select>` ganha `min-w-0 flex-1 sm:flex-none sm:max-w-sm truncate`,
   e a bolinha de cor `shrink-0`. Conferir que nada mais na página passa de `100vw` (o card da lista e a tira já usam `min-w-0`).
2. **Texto do lembrete em outra data:** hoje sai "Lembrete enviado às 10/11 às 22:46". Em `lib/reminderText.ts`, quando o dia do lembrete
   é diferente do dia do compromisso, usar "em dd/mm às HH:MM": "Lembrete enviado em 10/11 às 22:46" e "Lembrete em 09/11 às 07:30".
   No mesmo dia continua "Lembrete enviado às 07:30" / "Lembrete às 07:30".
