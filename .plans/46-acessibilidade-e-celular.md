# 46 — Acessibilidade e celular (roteiro 6.4; plano 17 + itens E6 e E7)

O plano 17 foi escrito quando tudo estava no `App.tsx`; agora vale para todos os arquivos de `frontend/src` (produto e Bastidores).
**Sem mudança de textos nem de lógica de negócio.**
Não execute comandos de terminal. Use só ferramentas de arquivo.

## Arquivos
- Criar: `frontend/public/favicon.svg`, `frontend/src/hooks/useFocusTrap.ts`
- Editar: `frontend/index.html`, `frontend/src/index.css`, `frontend/src/components/ConfirmDialog.tsx`,
  `frontend/src/components/agenda/AppointmentPanel.tsx`, `frontend/src/App.tsx` (polling do Telegram, se estiver lá; senão `hooks/useTelegramLink.ts`),
  e as páginas/componentes onde os itens abaixo aparecerem.

## Passos

### 1. Favicon e descrição (E7)
- `public/favicon.svg`: quadrado 32×32 com cantos arredondados (`rx="7"`) em `#0F766E` e um calendário simples em branco
  (retângulo com traço `stroke-width="2"`, linha do topo e dois "pinos"), sem texto.
- `index.html`: `<link rel="icon" type="image/svg+xml" href="/favicon.svg" />` e
  `<meta name="description" content="Agenda pessoal e profissional com lembretes no Telegram. Compartilhe a agenda com quem trabalha com você." />`
  e `<meta name="theme-color" content="#1C1917" />`.

### 2. Foco visível em tudo
Em `src/index.css`, dentro de `@layer base`:
```css
:where(a, button, input, select, textarea, summary, [role="button"], [tabindex]:not([tabindex="-1"])):focus-visible {
  outline: 2px solid #0D9488;
  outline-offset: 2px;
}
```
Procurar `outline-none` / `focus:outline-none` nas classes: onde não houver um `focus:ring`/`focus-visible:ring` substituto, remover o `outline-none`.
No cabeçalho escuro e no layout dos Bastidores (fundo escuro), usar `focus-visible:outline-white` nos botões.

### 3. Prender o foco em diálogos (E6)
- `hooks/useFocusTrap.ts`: `useFocusTrap(ref, active: boolean)` — quando ativo, guarda o `document.activeElement` de antes, mantém o Tab e o Shift+Tab
  circulando dentro de `ref` (elementos focáveis visíveis), e ao desativar devolve o foco ao elemento guardado (se ainda estiver no documento).
- Usar no `ConfirmDialog` e no `AppointmentPanel`. O foco inicial de cada um continua o que já é hoje.
- Com o `ConfirmDialog` aberto por cima do painel, o `Escape` fecha só o diálogo (o do painel não pode disparar junto): no painel, ignorar `Escape` quando existir um `[role=alertdialog]` ou outro `[aria-modal=true]` aberto depois dele.

### 4. Contraste
- Texto informativo `text-stone-400` sobre fundo claro vira `text-stone-500` (inclusive horários e títulos de compromissos passados na agenda,
  células de dias passados na visão de mês, e o "·" da tira da semana). Ícones decorativos podem continuar `stone-400`.
- `text-emerald-200` sobre fundo verde vira `text-white/90`. Conferir textos claros sobre `bg-brand-700`.

### 5. Ícones no lugar de emojis
Na interface (não no conteúdo que vem do bot/backend), trocar emojis usados como ícone por lucide-react do mesmo tamanho do texto
(👤 User, 🩺 Stethoscope, 🗂️ FolderOpen, ✅ CheckCircle2, ❌ XCircle, ✈️ Send, ⚠️ AlertTriangle, 📱 Smartphone, 🤖 Bot, 📅 Calendar).
Procurar emojis em `src/**/*.tsx`. Os textos da mensagem de boas-vindas do assistente e das respostas do bot ficam como estão.

### 6. Alvos de toque (44px no celular)
`min-h-11 min-w-11` (abaixo de `sm`) em: fechar do toast, fechar do painel, setas ‹ › da agenda, "Hoje", "Dia | Mês", "Alterar"/"Remover" do compartilhar,
"Agora não" do cartão do Telegram, "Mostrar N cancelados", itens dos menus, botões dos Bastidores (executar, simular, enviar do chat, sugestões do chat).

### 7. Bastidores no celular
- Chat do assistente e celular simulado: alturas fixas (`h-96`, `max-h-[460px]` etc.) viram `max-h-[60vh]` abaixo de `sm`, mantendo o valor atual a partir de `sm`.
- Tabela de auditoria (`AuditoriaPage`): abaixo de `md`, lista de cartões (data/hora, quem, ação, agenda, detalhe em `text-xs`); a partir de `md`, a tabela atual (`hidden md:table` / `md:hidden`).

### 8. Polling do Telegram
O intervalo que confere se o Telegram foi conectado pausa quando `document.hidden` e volta a conferir na hora em que a aba fica visível (`visibilitychange`),
mantendo o tempo-limite total que já existe.

## Critérios de aceite
- `npm run build` e `npm run lint` (0 erros).
- Todo `<label>` com `htmlFor` ligado a um `id` existente (o revisor confere com busca).
- Jornada só com teclado: login → "+ Novo compromisso" → preencher → Salvar → abrir o compromisso → "Cancelar compromisso" → confirmar,
  com foco sempre visível e o Tab preso no painel/diálogo; ao fechar, o foco volta ao botão que abriu.
- Favicon aparece na aba; `meta description` presente.
- Em 375px, nenhuma página com rolagem horizontal (agenda, mês, compartilhar, histórico, login, os 5 Bastidores).

## O que NÃO alterar
- Textos, rotas, handlers, API, backend.
