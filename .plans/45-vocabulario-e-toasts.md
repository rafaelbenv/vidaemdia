# 45 — Vocabulário e avisos como toast (roteiro 6.3; Fase 9 do plano 19; itens C5 e D4)

Referência: seção 10 do `.plans/19-novo-front.md` (vocabulário) e item C5 do plano 18 (toast fixo no canto).
Regra: **fora dos Bastidores** não aparecem JWT, RBAC, Worker, webhook, chatbot, códigos HTTP ("403 —", "200 OK"), PostgreSQL,
nem papéis em inglês. **Nos Bastidores** os termos técnicos continuam (lá eles são o assunto).
Não execute comandos de terminal. Use só ferramentas de arquivo.

## Arquivos
- Criar: `frontend/src/components/Toast.tsx`
- Editar: `frontend/src/App.tsx`
- Apagar o conteúdo e deixar de usar: `frontend/src/components/FeedbackBanner.tsx` (o revisor apaga o arquivo)

## Passos

### 1. `components/Toast.tsx`
Props: `{ toast: { type: 'success' | 'error'; title: string; detail?: string } | null; onClose: () => void }`.
- Posição fixa: `fixed z-50 bottom-24 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 sm:w-96` (no celular fica acima do botão flutuante "+").
- Caixa `rounded-lg shadow-lg border px-4 py-3 flex gap-3 items-start bg-white`; sucesso: `border-emerald-200`, ícone `CheckCircle2 text-emerald-600`;
  erro: `border-red-200`, ícone `AlertTriangle text-red-600`. Título `text-sm font-medium text-stone-900`; detalhe `text-xs text-stone-600 mt-0.5`.
- Botão de ícone `X` com `aria-label="Fechar aviso"`.
- Sucesso: `role="status"` (`aria-live="polite"`), some sozinho em 4 s. Erro: `role="alert"`, fica até fechar.
  (Mover para cá o `useEffect` de auto-fechar que hoje está no `App`, ajustando para 4 s; remover o do `App`.)
- Animação simples de entrada (`transition` com `opacity`/`translate-y`), respeitando `motion-reduce:transition-none`.

### 2. `App.tsx` — usar o toast
- Trocar todos os `<FeedbackBanner …/>` por `<Toast toast={feedbackBanner} onClose={() => setFeedbackBanner(null)} />`
  (no layout do produto e no dos Bastidores). O estado `feedbackBanner` continua o mesmo.

### 3. `App.tsx` — textos dos avisos do produto
Trocar exatamente estes (os demais ficam):
| Onde | Hoje | Novo |
|------|------|------|
| `handleLogin` sucesso | título "Bem-vindo, <nome>!", detalhe "Autenticado com sucesso via JWT como … (<ROLE>)" | título "Olá, <firstName(nome)>!", **sem** detalhe |
| erro ao carregar compromissos | detalhe "`<status> — <mensagem>`" | detalhe só "<mensagem>" (sem o código) |
| conectar Telegram, erro | detalhe "`<status> — …`" | detalhe só a mensagem |
| desconectar Telegram, erro | detalhe "`<status> — …`" | detalhe só a mensagem |
| cancelar compromisso, sucesso | título "Compromisso cancelado com sucesso.", detalhe "200 OK — log de auditoria gravado" | título "Compromisso cancelado.", sem detalhe |
| cancelar compromisso, erro | detalhe "`<status> — <mensagem>`" | detalhe só a mensagem; se o status for 403, só o título de `getErrorMessageByStatus(403)` sem detalhe |
| remover acesso, erro | detalhe "`<status> — …`" | detalhe só a mensagem |
| "Telegram conectado com sucesso!" / "Telegram desconectado com sucesso!" | — | "Telegram conectado." / "Telegram desconectado." |
Os avisos que só acontecem nos Bastidores (executar ciclo, simular falha, testar acesso da secretária) **não mudam**.

### 4. Mensagens de 403 vindas do servidor
Na agenda e no painel, quando o servidor devolve 403, nunca mostrar a mensagem crua do backend (ela tem "RBAC").
Conferir no `handleSaveAppointment` e no cancelamento: com `errorStatus(err) === 403`, usar `getErrorMessageByStatus(403)`.

### 5. Revisão final de termos
Procurar em `src/` (fora de `pages/LembretesPage.tsx`, `pages/AssistentePage.tsx`, `pages/TesteAcessoPage.tsx`, `pages/AuditoriaPage.tsx`,
`pages/SaudePage.tsx`, `components/BastidoresLayout.tsx`, `lib/routes.ts`) por texto **visível** com: JWT, RBAC, Worker, webhook, Chatbot,
SCHEDULED, CANCELLED, PROFESSIONAL, SECRETARY, "Origem", "delegação", "200 OK", "403 —". Corrigir o que for texto de tela pelo vocabulário da seção 10.
(Nomes de variáveis, tipos, comentários e caminhos de API não contam.)

## Critérios de aceite
- `npm run build` e `npm run lint` (0 erros).
- Login mostra o toast "Olá, João!" no canto, que some em 4 s; erros ficam até fechar.
- No celular, o toast não cobre o botão "+".
- Nenhum termo da lista aparece em `/agenda`, `/agenda/compartilhar`, `/agenda/historico` e no login.
- Nos Bastidores os avisos técnicos continuam iguais.

## O que NÃO alterar
- Backend, páginas dos Bastidores, lógica dos handlers além dos textos.
