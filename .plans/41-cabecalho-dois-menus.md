# 41 — Cabeçalho com menu de agendas e menu da conta (roteiro 5.1; Fase 6 em parte do plano 19)

Referência de desenho: seção 5 do `.plans/19-novo-front.md`.
Não execute comandos de terminal. Use só ferramentas de arquivo.

## Decisões (orquestrador, 2026-11-12)
- O backend deixa **qualquer dono** compartilhar a própria agenda. Então "Compartilhar esta agenda" aparece para quem é dono da agenda
  aberta, de qualquer papel. Com isso, `/agenda/compartilhar` passa a valer para quem é dono da agenda aberta (`activeCalendar.ownerId === user.id`)
  ou ADMIN, e não mais só para PROFESSIONAL/ADMIN.
- "Histórico desta agenda" fica para o passo 5.3 (a rota ainda não existe); não colocar o item agora.
- A agenda escolhida é lembrada no navegador (`localStorage`, chave `vidaemdia_agenda`, com `try/catch`); ao carregar, se o id salvo
  não está entre as agendas acessíveis, usar a primeira como hoje.

## Arquivos
- Criar: `frontend/src/hooks/useDropdown.ts`, `frontend/src/components/CalendarMenu.tsx`, `frontend/src/components/CalendarBanner.tsx`
- Editar: `frontend/src/App.tsx`, `frontend/src/components/UserMenu.tsx`, `frontend/src/pages/AgendaPage.tsx`, `frontend/src/lib/format.ts` (função de papel)

## Passos

### 1. `hooks/useDropdown.ts`
Mesmo comportamento do `useUserMenu` (abrir/fechar, clique fora, `Escape` fecha), genérico:
`useDropdown<T extends HTMLElement>() → { open, setOpen, ref }`. Ao fechar com `Escape`, devolver o foco ao botão que abriu (o primeiro `button` dentro de `ref`).
O `UserMenu` pode continuar com `useUserMenu`; não é preciso migrar.

### 2. `lib/format.ts`
`roleLabel(role)` → "Usuário" | "Profissional" | "Secretária" | "Administrador".

### 3. `components/CalendarMenu.tsx`
Props: `{ owned: Calendar[]; delegated: Calendar[]; selectedId: string; canShareSelected: boolean; onSelect: (id: string) => void; onShare: () => void }`.
- Botão (no cabeçalho escuro): bolinha `w-2.5 h-2.5 rounded-full` na cor da agenda + nome da agenda (`truncate max-w-[45vw] sm:max-w-xs text-sm font-medium`) + `ChevronDown`.
  Para agenda delegada, o rótulo é "Agenda de <nome do dono>". Classes: `flex items-center gap-2 px-3 py-2 rounded-md hover:bg-white/10 text-white min-h-[44px]`.
  `aria-haspopup="menu"`, `aria-expanded`.
- Menu (`role="menu"`, `absolute left-0 mt-2 w-72 bg-white text-stone-900 rounded-lg border border-stone-200 shadow-lg py-2 z-30`):
  - Título de grupo "Minhas agendas" (`px-3 pt-1 pb-1 text-xs font-semibold text-stone-500`), itens `role="menuitemradio"` com `aria-checked`:
    bolinha da cor + nome; o selecionado com ícone `Check` à direita.
  - Se houver delegadas: grupo "Agendas que gerencio", itens com o **nome do dono** (`owner.name`) e, abaixo, o nome da agenda em `text-xs text-stone-500`.
  - Se `canShareSelected`: divisória e o item "Compartilhar esta agenda" (ícone `Users`).
  - Itens com `w-full text-left px-3 py-2 text-sm hover:bg-stone-100 flex items-center gap-2 min-h-[40px]`. Clicar fecha o menu.
  - Setas ↑/↓ movem o foco entre os itens (opcional, se simples).

### 4. `components/CalendarBanner.tsx`
Props: `{ calendar: Calendar }`. Faixa fina logo abaixo do cabeçalho, só quando a agenda aberta **não** é do usuário:
`<div className="border-b border-stone-200" style={{ backgroundColor: calendar.color + '1A' }}>` com conteúdo
`max-w-7xl mx-auto px-4 py-2 text-sm text-stone-800 flex items-center gap-2`: bolinha na cor + "Você está na agenda de <strong>{owner.name}</strong>".
(`calendar.owner?.name`; sem nome, usar o nome da agenda.)

### 5. `components/UserMenu.tsx` (menu da conta, seção 5 do plano 19)
- Botão do avatar: iniciais no círculo + `ChevronDown`. **Sem** o papel em inglês embaixo do nome. A partir de `sm`, o primeiro nome ao lado das iniciais.
- Menu: nome (`font-medium`), e-mail (`text-xs text-stone-500`) e, se quiser mostrar o papel, `roleLabel(user.role)` em `text-xs text-stone-500` (nunca o valor em inglês).
  Divisória. Linha do Telegram: "Telegram: conectado" + botão-link "Desconectar"; ou "Telegram: não conectado" + botão "Conectar";
  aguardando: "Abra o Telegram e toque em Iniciar". (Reaproveitar os handlers e estados que já existem.)
  Divisória. "Bastidores (área técnica)" (se `showBastidores`). "Sair".
- **Remover** o item "Compartilhar agenda" do menu da conta (foi para o menu de agendas) e as props `canShare`/`onOpenShare`.

### 6. Cabeçalho do produto (`App.tsx`)
- `max-w-7xl mx-auto px-4 py-2 flex items-center justify-between gap-3`.
- Esquerda: logo compacto (ícone `Calendar` em `p-1.5 bg-brand-700 rounded-md` + "VidaEmDia" `font-bold`, este texto `hidden sm:inline`)
  e o `CalendarMenu`. **Remover** o subtítulo "Controle de Agenda Pessoal & Profissional · RBAC · Worker Telegram".
- Direita: `UserMenu`.
- Abaixo do `<header>`: `CalendarBanner` quando `activeCalendar && activeCalendar.ownerId !== user.id`.
- O `CalendarMenu` aparece nas rotas `/agenda` e `/agenda/compartilhar`.
- `onSelect(id)`: `setSelectedCalendarId(id)`, gravar no `localStorage`, e se a rota for `/agenda/compartilhar` e a nova agenda não for do usuário, ir para `/agenda`.
- `canShareSelected = activeCalendar?.ownerId === user.id || user.role === 'ADMIN'`; `onShare` → `navigate(COMPARTILHAR_PATH)`.
- Ajustar a regra de redirecionamento de `/agenda/compartilhar` para usar `canShareSelected` (decisão acima). Aguardar as agendas carregarem antes de redirecionar.
- Na carga (`loadSession`), escolher a agenda inicial: id salvo no `localStorage` se acessível; senão, a primeira própria; senão, a primeira delegada.

### 7. `AgendaPage.tsx`
Remover o seletor temporário de agenda (`<label>` "Agenda" + `<select>` + bolinha) e as props que só ele usava.

## Critérios de aceite
- `npm run build` e `npm run lint` (0 erros).
- Cabeçalho sem o subtítulo técnico e sem "PROFESSIONAL/USER/SECRETARY".
- Dr. João: menu de agendas com "Minhas agendas" (Consultório e Pessoal) e "Compartilhar esta agenda"; trocar de agenda troca a lista.
- Maria: grupo "Agendas que gerencio" com "Dr. João Mendes…"; ao abrir essa agenda, aparece a faixa "Você está na agenda de …" e o menu não mostra "Compartilhar".
- Carlos: menu com a agenda pessoal e "Compartilhar esta agenda"; `/agenda/compartilhar` abre para ele.
- Recarregar mantém a agenda escolhida.
- Em 375px: cabeçalho sem rolagem horizontal; menus abrem dentro da tela.

## O que NÃO alterar
- Backend, Bastidores, painel de compromisso, tira da semana, visão de mês, `CompartilharPage` (o conteúdo muda no 5.2).

## Correções após revisão (devolvido ao executor)
1. **Primeiro nome com título:** o botão do avatar mostra "Dr." para "Dr. João Mendes (Cardiologista)". Criar em `lib/format.ts` a função `firstName(name)` que ignora títulos no início (`Dr.`, `Dra.`, `Sr.`, `Sra.`, sem diferenciar maiúsculas) e devolve a primeira palavra restante ("João"). Usar no `UserMenu` (e onde mais o primeiro nome for usado: `DayList` "por Maria").
2. **Grupo vazio no menu de agendas:** a conta da secretária vê o título "Minhas agendas" sem itens. Em `CalendarMenu.tsx`, só mostrar o título de um grupo se ele tiver agendas.
3. **Acessibilidade do menu da conta:** o botão do avatar no `UserMenu` deve ter `aria-haspopup="menu"` e `aria-expanded={userMenuOpen}`, e o menu `role="menu"`.
