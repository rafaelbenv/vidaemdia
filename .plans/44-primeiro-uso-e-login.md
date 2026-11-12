# 44 — Cartão do Telegram e login em uma coluna (roteiro 6.1 e 6.2; Fase 8 do plano 19; itens C1 e A5)

Referência de desenho: seções 7 e 8 do `.plans/19-novo-front.md`.
Duas seções, executadas e commitadas separadamente. Quando o pedido disser "seção 6.1" ou "seção 6.2", fazer só ela.
Não execute comandos de terminal. Use só ferramentas de arquivo.

---

## Seção 6.1 — Cartão "Receba seus lembretes no Telegram"

Arquivos: criar `frontend/src/components/agenda/TelegramCard.tsx`; editar `frontend/src/pages/AgendaPage.tsx` e `frontend/src/App.tsx` (props).

1. `TelegramCard` — props `{ waiting: boolean; connecting: boolean; onConnect: () => void; onDismiss: () => void }`.
   Card `bg-white rounded-lg border border-brand-600/40 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between`:
   - Esquerda: ícone `Send` (lucide) em `text-brand-700`, título `h2` "Receba seus lembretes no Telegram" (`text-sm font-semibold text-stone-900`)
     e texto `text-sm text-stone-600` "Sem conectar, os compromissos ficam salvos mas nenhum lembrete é enviado."
     Com `waiting`: o texto vira "Abra o Telegram e toque em Iniciar. Esta tela atualiza sozinha." e aparece `Loader2` girando ao lado.
   - Direita: botão primário "Conectar Telegram" (`disabled` com `connecting` ou `waiting`; com `connecting`, "Conectando…")
     e botão-link "Agora não" (`text-sm text-stone-500 hover:text-stone-800`) que chama `onDismiss`.
   - `role="region"` e `aria-label="Conectar o Telegram"`.
2. `AgendaPage`: mostrar o cartão **acima da tira da semana** (na visão de dia e na de mês) quando `!telegramLinked` e o cartão não foi dispensado.
   Dispensar grava `sessionStorage['vidaemdia_tg_card'] = 'hidden'` (com `try/catch`) e esconde até o fim da sessão do navegador.
   Ao conectar (`telegramLinked` vira `true`), o cartão some sozinho.
3. Props novas da `AgendaPage`: `telegramWaiting`, `telegramConnecting` (= `submitting['telegram']`). Reaproveitar `onConnectTelegram`.

Aceite: build e lint (0 erros); Dr. João (sem Telegram) vê o cartão; "Agora não" esconde até fechar a aba; Carlos (com Telegram) não vê.
Não alterar: backend, `UserMenu`, Bastidores.

---

## Seção 6.2 — Login em uma coluna

Arquivos: reescrever `frontend/src/pages/LoginPage.tsx`; editar `frontend/src/App.tsx`.

1. `App.tsx`:
   - `email` e `password` começam vazios (`''`).
   - `handleLogin(e?: React.FormEvent, demo?: { email: string; password: string })`: com `demo`, usa o e-mail e a senha dele
     (não depende do campo de senha); sem `demo`, usa os campos. O resto do handler fica igual.
   - Validação antes de chamar a API (sem `demo`): e-mail ou senha vazios → `setAuthError('Informe o e-mail e a senha.')`.
2. `LoginPage.tsx` — mesmas props, com `onLogin: (e?: React.FormEvent, demo?: { email: string; password: string }) => Promise<void>`:
   - Fundo `min-h-screen bg-stone-50 flex items-center justify-center p-4`; coluna `w-full max-w-sm`.
   - Marca: ícone `Calendar` em `p-2 bg-brand-700 rounded-md text-white`, "VidaEmDia" (`text-2xl font-bold text-stone-900`)
     e "Sua agenda com lembretes no Telegram" (`text-sm text-stone-600`). Centralizado.
   - Card `bg-white rounded-lg border border-stone-200 p-6 mt-6` com o formulário:
     "E-mail" (`type=email`, `autoComplete="email"`) e "Senha" (`type=password`, `autoComplete="current-password"`), cada um com `<label htmlFor>`;
     erro (`authError`) em `role="alert"` `text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2`;
     botão "Entrar" primário de largura total (com `Loader2` e "Entrando…" quando `loading`).
   - Abaixo do card, um `<details>` (ou botão com `aria-expanded`) fechado por padrão: "Entrar com uma conta de demonstração".
     Aberto, três botões de largura total, cada um com nome e papel em português, sem selos:
     "Carlos Silva — Usuário" (`carlos@vidaemdia.com.br`), "Dr. João Mendes — Profissional" (`dr.joao@vidaemdia.com.br`),
     "Maria Oliveira — Secretária" (`secretaria.maria@vidaemdia.com.br`), todos com senha `123456`, chamando `onLogin(undefined, { email, password: '123456' })`.
     Uma linha `text-xs text-stone-500`: "Contas de exemplo para testar o sistema. Senha de todas: 123456".
   - **Sai** a coluna que explica os "três fluxos arquiteturais" e todo `TechTag`/termo técnico (JWT, RBAC, Worker, Retry).

Aceite: build e lint (0 erros); campos vazios ao abrir; entrar pelo formulário e pelos três botões de demonstração funciona;
campos vazios mostram "Informe o e-mail e a senha."; senha errada mostra o erro do servidor; em 375px sem rolagem horizontal.
Não alterar: backend, agenda, Bastidores.
