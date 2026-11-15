# 75 — "Esqueci a senha" no front (roteiro 9.6, parte 2)

## Objetivo

Na tela de login, o link `Esqueci a senha` abre uma tela pública em duas etapas: 1) informar o e-mail e pedir o código; 2) digitar o código recebido no Telegram e a senha nova. Usa as rotas do plano 74.

## Rotas do backend (plano 74)

- `POST /auth/senha/esqueci` com `{ email }` → sempre `{ ok: true, message: 'Se o e-mail estiver cadastrado e com o Telegram vinculado, enviamos um código pelo Telegram.' }` (limite de 3 por minuto; acima disso o servidor responde 429).
- `POST /auth/senha/redefinir` com `{ email, code, newPassword }` → `{ ok: true, message: 'Senha alterada. Entre com a senha nova.' }`; erro 400 com `message` (`'Código inválido ou expirado. Peça um novo código.'`, `'O código tem 6 números'` ou as regras de senha).

## Arquivos envolvidos (só estes)

- `frontend/src/lib/routes.ts`
- `frontend/src/api.ts`
- `frontend/src/pages/EsqueciSenhaPage.tsx` (novo)
- `frontend/src/pages/LoginPage.tsx`
- `frontend/src/App.tsx`
- `frontend/src/pages/CriarContaPage.tsx`
- `frontend/src/test/mockApi.ts`
- `frontend/src/test/esqueci-senha.test.tsx` (novo)
- `README.md`

## Passos

### 1. Rota e API

- `routes.ts`: `export const ESQUECI_SENHA_PATH = '/esqueci-senha';`.
- `api.ts`: `requestPasswordCode(email)` e `resetPassword(email, code, newPassword)`, sem token, no formato do `register`.

### 2. `App.tsx`

- Sem token: `ESQUECI_SENHA_PATH` também é caminho permitido (não redireciona para o login), como `CRIAR_CONTA_PATH`.
- No `if (!token)`: `rawPath === ESQUECI_SENHA_PATH` → `<EsqueciSenhaPage onGoToLogin={(emailFeito?: string) => { if (emailFeito) setEmail(emailFeito); navigate(LOGIN_PATH); }} />`.
- `LoginPage` recebe `onForgotPassword={() => navigate(ESQUECI_SENHA_PATH)}`.

### 3. `LoginPage.tsx`

- Nova prop opcional `onForgotPassword?: () => void`. Se existir, logo abaixo do campo `Senha` e alinhado à direita, um botão-link `Esqueci a senha` (`type="button"`, `text-sm text-brand-700`).

### 4. `EsqueciSenhaPage.tsx`

Mesmo visual da `CriarContaPage` (marca, card, classes). Título do card `Recuperar a senha`.

**Etapa 1 (e-mail):**
- Texto: `Enviaremos um código pelo Telegram vinculado à sua conta.`
- Campo `E-mail` (`id="recuperar-email"`). Validação: vazio ou sem `@` → `Informe um e-mail válido.`
- Botão `Enviar código`. Em sucesso, guarda o e-mail, passa para a etapa 2 e mostra a `message` do servidor num aviso `role="status"`. Em erro (ex.: 429), mostra a mensagem num alerta `role="alert"`.
- Nota abaixo do botão: `Sem o Telegram vinculado não é possível recuperar a senha por aqui. Fale com quem administra o VidaEmDia.`

**Etapa 2 (código e senha nova):**
- Mostra `Código enviado para o Telegram da conta <email>.` e o botão-link `Usar outro e-mail` (volta à etapa 1).
- Campos: `Código` (`id="recuperar-codigo"`, `inputMode="numeric"`, `autoComplete="one-time-code"`, `maxLength={6}`), `Nova senha` e `Confirmar nova senha` (`autoComplete="new-password"`, com a dica `Mínimo de 8 caracteres, com letra e número.` por `aria-describedby`).
- Validação antes da API: código diferente de 6 números → `O código tem 6 números.`; regra da senha e `As senhas não são iguais.` com as mesmas mensagens da `CriarContaPage`.
- Botão `Criar senha nova`. Em sucesso, chama `onGoToLogin(email)` e o login mostra o e-mail já preenchido; antes, mostrar a mensagem do servidor não é necessário (a tela muda).
- Botão-link `Reenviar código` (chama de novo o pedido; desabilitado por 60 s depois de cada envio, mostrando `Reenviar código (Ns)`).

Rodapé das duas etapas: `Lembrou a senha?` + botão-link `Entrar` (chama `onGoToLogin()`).

Para não repetir a regra da senha, extrair da `CriarContaPage` uma função exportada `passwordRuleError(password: string): string | null` (em `CriarContaPage.tsx`) e usá-la nas duas páginas. A `MinhaContaPage` não muda neste plano.

### 5. Mock e testes

`mockApi.ts`: `POST /auth/senha/esqueci` devolve a resposta genérica; `POST /auth/senha/redefinir` aceita só o código `123456` (senão 400 com `'Código inválido ou expirado. Peça um novo código.'`) e, aceitando, troca a senha do usuário no mock para a nova (o login do mock passa a aceitar essa senha para esse e-mail, além de `123456`).

`esqueci-senha.test.tsx`:
- `Esqueci a senha` no login abre `Recuperar a senha`;
- e-mail vazio mostra `Informe um e-mail válido.` e não chama a API;
- `Enviar código` chama `/auth/senha/esqueci` e mostra a etapa do código;
- código com 5 números mostra `O código tem 6 números.`;
- código errado mostra a mensagem do servidor;
- código `123456` + senha válida volta ao login com o e-mail preenchido, e entrar com a senha nova funciona;
- `Usar outro e-mail` volta à etapa 1.

### 6. README

Na seção de cadastro (seção 6), acrescentar: **Esqueci a senha** — quem vinculou o Telegram pede em `/esqueci-senha` um código de 6 números enviado pelo bot (vale 15 minutos, uso único, até 5 tentativas; limite de 3 pedidos por minuto). Rotas `POST /auth/senha/esqueci` e `POST /auth/senha/redefinir`. A resposta do pedido é sempre a mesma, para não revelar quais e-mails têm conta. Em `TELEGRAM_MODE=mock`, o código aparece no log do backend (`docker logs vidaemdia-backend`).

Também, no texto do passo do Telegram no cartão de primeiros passos e no `TelegramCard`, NÃO mexer (fora deste plano).

## Critérios de aceite

- `npm test`, `npm run lint` e `npm run build` no front passam; os testes atuais continuam passando.

## O que NÃO alterar

- O backend e qualquer arquivo fora da lista.
