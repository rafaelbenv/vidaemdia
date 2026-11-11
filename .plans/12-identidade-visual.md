# 12 — Identidade visual (tokens, fonte, escala, card)

Origem: crítica impeccable de 2026-11-08 (nota 13/40). Prioridade escolhida pelo usuário: começar por aqui.

## Objetivo
Tirar a cara de "template admin Tailwind" e dar ao VidaEmDia uma identidade própria de consultório:
calma, legível, confiável. Modo Operate: a marca aparece na precisão dos detalhes, não em decoração.

## Direção (decidida)
- **Neutros quentes:** trocar `slate` por `stone` (canvas `stone-50`, texto `stone-900`, bordas `stone-200`).
- **Uma cor de marca:** verde-petróleo `#0F766E` como primária (token `brand-700`), `brand-800` no hover, `brand-50` em fundos de destaque.
  Indigo sai da marca. Âmbar, vermelho e verde ficam SÓ para status (pendente, erro, enviado).
- **Fonte:** "Figtree" (Google Fonts, pesos 400/500/600/700) para toda a UI; `font-mono` continua só nos selos técnicos.
- **Escala de texto:** corpo mínimo `text-sm` (14px); inputs `text-base` (16px, evita zoom no iOS);
  rótulos `text-xs` peso 500; títulos de card `text-base` 600; título de página `text-xl` 700.
  Banir `text-[10px]`; `text-[11px]` só em selos técnicos `font-mono`.
- **Card:** `bg-white rounded-lg border border-stone-200` sem `shadow-sm`; cabeçalho do card com título + ação à direita,
  separado por `border-b border-stone-100`. Raio único: `rounded-lg` em cards, `rounded-md` em botões e inputs.
- **Abas:** todas com o mesmo estado ativo (texto `brand-800`, sublinhado `brand-700` de 2px). Fim da cor diferente por aba.

## Arquivos
- `frontend/index.html`
- `frontend/src/App.tsx`

## Passos
1. `index.html`:
   - adicionar `<link>` do Google Fonts para Figtree (400;500;600;700, `display=swap`);
   - logo após o script do Tailwind CDN, adicionar:
     `<script>tailwind.config = { theme: { extend: { fontFamily: { sans: ['Figtree','system-ui','sans-serif'] }, colors: { brand: { 50:'#F0FDFA', 600:'#0D9488', 700:'#0F766E', 800:'#115E59' } } } } }</script>`;
   - body: `bg-slate-50 text-slate-900` → `bg-stone-50 text-stone-900`;
   - `<title>` → "VidaEmDia — Agenda com lembretes no Telegram";
   - um `<style>` com: `::selection { background:#CCFBF1; color:#134E4A }`, `html { accent-color:#0F766E; caret-color:#0F766E }`,
     scrollbar fina (`scrollbar-width: thin; scrollbar-color: #D6D3D1 transparent`) e `.tabular-nums { font-variant-numeric: tabular-nums }`.
2. `App.tsx`: substituir `slate-` por `stone-` em todo o arquivo (mesmo número de tom).
3. Substituir `indigo-` de marca (botões primários, links, foco, seleção) por `brand-` (600→700, 700→800, 50/100→50).
   O gradiente do login (linha ~510) vira fundo sólido `stone-900` com um bloco de destaque `brand-700`, sem gradiente.
4. Unificar o estado ativo das 5 abas (linhas ~757–811) no estilo descrito acima.
5. Aplicar a escala de texto: varrer `text-[10px]`, `text-[11px]` e `text-xs` em conteúdo e subir conforme a regra.
6. Aplicar o card novo nos blocos ~859, 911, 1013, 1140, 1213, 1306, 1624 (mesmo markup, só classes).

## Critérios de aceite
- `npm run build` em `frontend/` passa.
- Nenhuma ocorrência de `indigo-` nem de `text-[10px]` em `App.tsx`.
- Uma única cor de marca, fonte Figtree carregada, todas as abas com o mesmo estado ativo.
- Todos os textos técnicos (JWT, PostgreSQL, rotas) continuam visíveis; só muda o estilo.

## NÃO alterar
- Lógica, handlers, chamadas de API, textos, estrutura das abas, backend.
- Cores semânticas de status de lembrete (enviado/falhou/pendente).
