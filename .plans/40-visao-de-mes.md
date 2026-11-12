# 40 — Visão de mês (roteiro 4.3; Fase 5 do plano 19; item C2 mês)

Referência de desenho: seção 3, "Visão de mês", do `.plans/19-novo-front.md`.
Não execute comandos de terminal. Use só ferramentas de arquivo.

## Arquivos
- Criar: `frontend/src/components/agenda/MonthGrid.tsx`
- Editar: `frontend/src/pages/AgendaPage.tsx`, `frontend/src/lib/dates.ts` (funções de mês)

## Passos

### 1. `lib/dates.ts`
Acrescentar: `startOfMonth(d)`, `addMonths(d, n)` (dia 1 do mês resultante), `formatMonthYear(d)` → "Novembro de 2026"
(`Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' })`, primeira letra maiúscula),
`monthGridDays(d)` → array de células da grade (segunda a domingo) com `Date | null` para os vazios antes do dia 1 e depois do último dia, completando semanas inteiras.

### 2. `components/agenda/MonthGrid.tsx`
Props: `{ month: Date; selected: Date; today: Date; counts: Record<string, number>; failed: Set<string>; onSelect: (d: Date) => void }`.
- Cabeçalho de dias da semana: "seg ter qua qui sex sáb dom" (`text-xs text-stone-500 text-center`).
- Grade `grid grid-cols-7 gap-1`. Célula vazia: `div` sem conteúdo. Célula de dia: `button`, altura `h-14 sm:h-20`, `rounded-md text-left p-1.5 sm:p-2 border border-transparent`:
  - número do dia `text-xs sm:text-sm font-semibold tabular-nums`;
  - contagem (só ativos) em `text-[11px] sm:text-xs text-stone-600`, como "3" no celular e "3 compromissos" (ou "1 compromisso") a partir de `sm`; zero: nada;
  - ponto vermelho `w-1.5 h-1.5 rounded-full bg-red-500` no canto se o dia está em `failed`;
  - hoje: `border-brand-600`; selecionado: `bg-brand-50`; passados: textos `text-stone-400`; hover `hover:bg-stone-100`.
  - `aria-label` "Terça, 10 de novembro, 3 compromissos" (+ ", lembrete falhou" se houver).
- Títulos de compromissos **não** aparecem nas células.

### 3. `AgendaPage.tsx`
- Visão na URL: parâmetro `visao=mes` (ausente = dia). Mudar de visão preserva `dia`.
- Ao lado do título, um seletor segmentado "Dia | Mês" (`role="group" aria-label="Visão"`, dois botões com `aria-pressed`;
  ativo `bg-white shadow-sm text-stone-900`, inativo `text-stone-600`, contêiner `bg-stone-100 rounded-md p-0.5 inline-flex`).
- Na visão de mês:
  - Título `h1` = `formatMonthYear(dia)`; `‹ ›` andam um mês (`aria-label` "Mês anterior"/"Próximo mês"); "Hoje" volta para hoje (mantendo `visao=mes`).
  - No lugar da tira da semana e da lista, o `MonthGrid` do mês de `dia`.
    `counts` por `toDateKey(startTime)` dos ativos; `failed` = dias com algum compromisso ativo cujo `reminders[0].status === 'FAILED'`.
  - Clique em um dia:
    - a partir de `sm` (usar `window.matchMedia('(min-width: 640px)').matches`): abre a visão de dia naquela data (`setSearchParams({ dia })`, sem `visao`);
    - no celular: fica no mês, seleciona o dia (`setSearchParams({ visao: 'mes', dia })`) e mostra **abaixo da grade** a lista daquele dia
      (o mesmo `DayList`, com título `h2` "Terça, 10 de novembro" `text-sm font-semibold mt-4`), só em `sm:hidden`.
  - Botão "+ Novo compromisso" e o flutuante continuam, criando no dia selecionado.
- Na visão de dia: nada muda além do seletor "Dia | Mês".

## Critérios de aceite
- `npm run build` e `npm run lint` (0 erros).
- "Mês" mostra a grade do mês do dia aberto com contagens que batem com a tira da semana; cancelados não contam.
- `‹ ›` trocam o mês; recarregar mantém a visão e o mês (`?visao=mes&dia=...`).
- Desktop: clicar em um dia abre a visão de dia naquela data. Celular (375px): a lista do dia aparece abaixo da grade, sem rolagem horizontal.
- Dia com lembrete que falhou tem o ponto vermelho.

## O que NÃO alterar
- `App.tsx` (a não ser que falte uma prop), painel de compromisso, `DayList`/`AppointmentRow` (só reaproveitar), backend.
