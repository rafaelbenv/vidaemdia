# 73 — Tela "Minha conta" no front (roteiro 9.5, parte 2)

## Objetivo

Tela `/conta`, aberta pelo menu do usuário, com: dados (nome editável, e-mail só leitura), troca de senha e as conexões (Telegram e Google). Usa as rotas do plano 72.

## Rotas do backend (plano 72)

- `PATCH /auth/me` com `{ name }` → devolve o perfil (`id, name, email, role, preferredChannel, createdAt, telegramLinked`).
- `POST /auth/me/senha` com `{ currentPassword, newPassword }` → `{ ok: true, message: 'Senha alterada.' }`. Erros em 400 com `message`: `'A senha atual está incorreta.'`, `'A senha nova precisa ser diferente da atual.'` ou as regras de senha.

## Arquivos envolvidos (só estes)

- `frontend/src/lib/routes.ts`
- `frontend/src/api.ts`
- `frontend/src/pages/MinhaContaPage.tsx` (novo)
- `frontend/src/components/UserMenu.tsx`
- `frontend/src/App.tsx`
- `frontend/src/test/mockApi.ts`
- `frontend/src/test/minha-conta.test.tsx` (novo)
- `README.md`

## Passos

### 1. Rota e API

- `routes.ts`: `export const MINHA_CONTA_PATH = '/conta';`.
- `api.ts`:
  - `updateProfile(token, name): Promise<User>` → `PATCH /auth/me`.
  - `changePassword(token, currentPassword, newPassword): Promise<{ ok: boolean; message: string }>` → `POST /auth/me/senha`.

### 2. `App.tsx`

- No efeito de redirecionamento com usuário logado: `MINHA_CONTA_PATH` é um caminho válido (não redireciona para a agenda).
- No `<main>`, antes dos outros casos: `rawPath === MINHA_CONTA_PATH` → `<MinhaContaPage .../>`.
- Props passadas: `user`, `token`, `onUserUpdated={(u) => setUser((prev) => (prev ? { ...prev, name: u.name } : prev))}`, `onBack={() => navigate(AGENDA_PATH)}`, as do Telegram (`telegramLinked`, `telegramWaiting`, `telegramConnecting={submitting['telegram']}`, `onConnectTelegram={handleConnectTelegram}`, `onUnlinkTelegram={openUnlinkTelegramDialog}`) e as do Google (`googleStatus`, `onConnectGoogle={handleConnectGoogle}`, `onDisconnectGoogle={openDisconnectGoogleDialog}`).
- Os seletores de agenda do cabeçalho (o bloco condicionado a `rawPath === AGENDA_PATH || ...`) não aparecem na tela de conta (não acrescentar `MINHA_CONTA_PATH` nessa condição).
- Passar `onOpenAccount={() => navigate(MINHA_CONTA_PATH)}` para o `UserMenu`.

### 3. `UserMenu.tsx`

- Nova prop `onOpenAccount: () => void`. Item `Minha conta` (ícone `UserRound` do lucide), logo antes do bloco dos Bastidores, com as mesmas classes dos outros itens; fecha o menu e chama `onOpenAccount`.

### 4. `MinhaContaPage.tsx`

Layout `max-w-2xl mx-auto`, título `Minha conta` e botão de texto `← Voltar para a agenda` (chama `onBack`). Três cards brancos (`bg-white rounded-lg border border-stone-200 p-5`), cada um com `<h2>`:

**Dados**
- `Nome` (input, `maxLength={80}`, valor inicial `user.name`) e `E-mail` (texto só leitura, com a nota `O e-mail não pode ser alterado.`).
- Botão `Salvar nome`, desabilitado se o nome (com `trim`) estiver vazio ou igual ao atual. Chama `updateProfile`; em sucesso chama `onUserUpdated` e mostra `Nome atualizado.` (mensagem com `role="status"`); em erro mostra a mensagem com `role="alert"`.

**Senha**
- Campos `Senha atual` (`autoComplete="current-password"`), `Nova senha` e `Confirmar nova senha` (`autoComplete="new-password"`), com a dica `Mínimo de 8 caracteres, com letra e número.` ligada por `aria-describedby`.
- Validação antes de chamar a API, com as mesmas mensagens da `CriarContaPage` (regra da senha e `As senhas não são iguais.`) e `Informe a senha atual.`.
- Botão `Trocar senha`. Em sucesso limpa os três campos e mostra `Senha alterada.`; em erro mostra a mensagem do servidor.

**Conexões**
- Telegram: `Conectado` (com botão `Desconectar`, que chama `onUnlinkTelegram`) ou `Não conectado` (botão `Conectar Telegram`; enquanto `telegramWaiting`, o texto `Abra o Telegram e toque em Iniciar. Esta tela atualiza sozinha.`).
- Google Agenda, só se `googleStatus.configured`: `Conectado como <email>` quando `googleStatus.connected` (usar o campo de e-mail que o tipo `GoogleStatus` já tiver; se não tiver, só `Conectado`) com botão `Desconectar`, ou `Não conectado` com botão `Conectar Google`.

Botões e inputs com as mesmas classes já usadas na `CriarContaPage` e no `TelegramCard`. Cada formulário com `noValidate` e `onSubmit`.

### 5. Mock e testes

`mockApi.ts`:
- `PATCH /auth/me`: atualiza o nome do usuário do token em `currentUsers` e devolve o usuário.
- `POST /auth/me/senha`: se `currentPassword !== '123456'` → 400 `{ message: 'A senha atual está incorreta.' }`; senão `{ ok: true, message: 'Senha alterada.' }`.

`minha-conta.test.tsx`:
- pelo menu do usuário, `Minha conta` abre a tela com o título `Minha conta` e o e-mail do usuário;
- mudar o nome e salvar chama `PATCH /auth/me` com o nome novo e mostra `Nome atualizado.`;
- senha atual errada mostra `A senha atual está incorreta.`;
- senha nova fraca não chama a API e mostra a regra;
- troca válida chama `POST /auth/me/senha` com `currentPassword` e `newPassword` e mostra `Senha alterada.`;
- `← Voltar para a agenda` volta à agenda.

### 6. README

Na seção de cadastro (seção 6, onde estão as notas do `/criar-conta`), acrescentar: em **Minha conta** (menu do usuário, `/conta`) a pessoa muda o nome, troca a senha (pedindo a atual) e vê ou desfaz as conexões com o Telegram e o Google; rotas `PATCH /auth/me` e `POST /auth/me/senha` (limite de 5 trocas de senha por minuto), as duas registradas na auditoria.

## Critérios de aceite

- `npm test`, `npm run lint` e `npm run build` no front passam; os testes atuais continuam passando.

## O que NÃO alterar

- O backend e qualquer arquivo fora da lista. Excluir conta fica para o plano do 9.7.
