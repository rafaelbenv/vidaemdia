# 13 — Selos técnicos e mensagens (sem remover o jargão)

## Objetivo
Por enquanto o usuário quer manter visíveis os textos de arquitetura (JWT, PostgreSQL, rotas, "Testar 403") para a
apresentação; a remoção virá depois. Este plano rebaixa esses textos a **metadado secundário** e coloca uma frase humana
como mensagem principal. Assim a remoção futura vira apagar o `TechTag`/`detail`.

Depende do plano 12 (tokens `stone`/`brand`).

## Arquivos
- `frontend/src/App.tsx`

## Passos
1. Criar no topo do arquivo o componente `TechTag({ children })`:
   `font-mono text-[11px] text-stone-500 bg-stone-100 rounded px-1.5 py-0.5`.
   Todo texto técnico (`POST /compromissos`, `audit_logs`, `reminders`, "PostgreSQL 16", "JWT Autenticado") passa a usar `TechTag`.
2. Mensagens do `feedbackBanner`: o estado passa a ser `{ type, title, detail? }`.
   `title` é humano; `detail` guarda o texto técnico atual e aparece em `TechTag` abaixo do título.
   - Sucesso ao salvar (linha ~330): title "Compromisso salvo. Lembrete no Telegram 15 min antes."; detail "201 Created — PostgreSQL".
   - Erro genérico (linha ~339), title pelo status:
     - 400: "Confira os campos do compromisso."
     - 401: "Sua sessão expirou. Entre de novo."
     - 403: "Você não tem acesso a esta agenda. Peça ao profissional responsável."
     - 5xx ou sem status: "O servidor não respondeu. Tente de novo em instantes."
     - detail: `${status} — ${message}`.
   - Revisar os outros pontos que setam o banner e aplicar o mesmo formato.
3. Banner: `role="status"` (sucesso) ou `role="alert"` (erro); botão fechar com `aria-label="Fechar aviso"`;
   sucesso some sozinho após 5 s (limpar o timeout ao trocar de mensagem); erro não some sozinho.
4. Header: o selo "JWT Autenticado" vira `TechTag` discreto ao lado do papel do usuário.
5. Botão "Tentar Acesso (Testar 403)": continua, mas com estilo secundário (borda vermelha, fundo branco) em vez de fundo vermelho.

## Critérios de aceite
- `npm run build` passa.
- Nenhum texto técnico foi apagado; todos aparecem como `TechTag` ou `detail`.
- Toda mensagem do banner tem uma frase humana na primeira linha.

## NÃO alterar
- Endpoints, lógica de RBAC, backend, comportamento dos botões.
