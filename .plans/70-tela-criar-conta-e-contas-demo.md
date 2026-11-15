# 70 — Tela "Criar conta" e contas demo atrás de variável (roteiro 9.2 e 9.3)

## Objetivo

1. (9.3) Os botões "Entrar com uma conta de demonstração" só aparecem quando `VITE_SHOW_DEMO_ACCOUNTS=true`. O padrão é desligado.
2. (9.2) Nova tela pública **Criar conta** em `/criar-conta`, ligada à tela de login. Ao criar, a pessoa já entra na agenda, como no login.

O backend já tem `POST /auth/register` (plano 69): recebe `{ name, email, password }` e devolve `{ accessToken, user }`, igual ao login. Regras de senha: 8 a 72 caracteres, pelo menos uma letra e um número. Nome: até 80 caracteres. Erros chegam com `message` (string ou lista de strings; o `errorMessage` de `src/api.ts` já trata).

## Arquivos envolvidos (só estes)

Front:
- `frontend/src/lib/routes.ts`
- `frontend/src/vite-env.d.ts`
- `frontend/src/api.ts`
- `frontend/src/pages/LoginPage.tsx`
- `frontend/src/pages/CriarContaPage.tsx` (novo)
- `frontend/src/App.tsx`
- `frontend/vitest.config.ts`
- `frontend/src/test/mockApi.ts`
- `frontend/src/test/login.test.tsx`
- `frontend/src/test/criar-conta.test.tsx` (novo)

Build e docs:
- `frontend/Dockerfile`
- `docker-compose.yml`
- `.env.example`
- `README.md`

## Passos

### 1. Variável das contas demo (9.3)

- `vite-env.d.ts`: acrescentar `readonly VITE_SHOW_DEMO_ACCOUNTS?: string;`.
- `routes.ts`: `export const SHOW_DEMO_ACCOUNTS = import.meta.env.VITE_SHOW_DEMO_ACCOUNTS === 'true';` (atenção: o padrão é desligado, ao contrário de `SHOW_BASTIDORES`).
- `LoginPage.tsx`: o bloco `<details>` das contas de demonstração só é renderizado quando `SHOW_DEMO_ACCOUNTS` for verdadeiro. Para facilitar o teste, a `LoginPage` recebe a prop opcional `showDemoAccounts?: boolean`, com padrão `SHOW_DEMO_ACCOUNTS`.
- `vitest.config.ts`: dentro de `test`, `env: { VITE_SHOW_DEMO_ACCOUNTS: 'true' }`, para os testes atuais do botão de demonstração continuarem valendo.
- `Dockerfile` (estágio `builder`, antes do `RUN npm run build`): `ARG VITE_SHOW_DEMO_ACCOUNTS=false`, `ARG VITE_SHOW_BASTIDORES=true`, e `ENV` com os dois valores.
- `docker-compose.yml`, serviço `frontend`, em `build`: `args:` com `VITE_SHOW_DEMO_ACCOUNTS: ${VITE_SHOW_DEMO_ACCOUNTS:-false}` e `VITE_SHOW_BASTIDORES: ${VITE_SHOW_BASTIDORES:-true}`.
- `.env.example`: acrescentar, com comentário curto em português, `VITE_SHOW_DEMO_ACCOUNTS=false` (ligar só na apresentação; exige rebuild do front) e `VITE_SHOW_BASTIDORES=true`.

### 2. API (`api.ts`)

```ts
export async function register(name: string, email: string, password: string): Promise<{ accessToken: string; user: User }>
```
POST `/auth/register` com `{ name, email, password }`, no mesmo formato do `login`.

### 3. Rota

- `routes.ts`: `export const CRIAR_CONTA_PATH = '/criar-conta';`.
- `App.tsx`:
  - No efeito de redirecionamento, sem token: só redireciona para `LOGIN_PATH` se o caminho não for `LOGIN_PATH` nem `CRIAR_CONTA_PATH`.
  - No `if (!token)` que hoje devolve a `LoginPage`: se o caminho atual (sem a barra final) for `CRIAR_CONTA_PATH`, devolver `<CriarContaPage loading={...} onRegister={handleRegister} onGoToLogin={() => navigate(LOGIN_PATH)} />`; senão a `LoginPage`, com a nova prop `onGoToRegister={() => navigate(CRIAR_CONTA_PATH)}`.
  - Novo `handleRegister(name, email, password): Promise<string | null>`: chama `register`; em sucesso faz exatamente o mesmo que o `handleLogin` faz em sucesso (guardar `vidaemdia_jwt`, limpar a agenda escolhida, `setToken`, `setUser`, `navigate(AGENDA_PATH)`, fechar o menu), mas o banner de boas-vindas é `Conta criada. Bem-vindo(a), <primeiro nome>!`. Em erro devolve a mensagem (`errorMessage(err, 'Não foi possível criar a conta')`) para a tela mostrar. Usar o mesmo estado `loading` do login. Para não repetir código, extrair o trecho de sucesso do `handleLogin` numa função `startSession(res, welcomeTitle)` e usá-la nos dois.
  - Usuário logado que abre `/criar-conta` vai para a agenda (o efeito atual já faz isso, porque o caminho não é válido para quem está logado; conferir).

### 4. `LoginPage.tsx`

- Nova prop opcional `onGoToRegister?: () => void`. Logo abaixo do card do formulário, se ela existir: texto `Ainda não tem conta?` e um botão com aparência de link `Criar conta` (`type="button"`, cor `text-brand-700`, sublinhado no hover).

### 5. `CriarContaPage.tsx` (novo)

Mesmo visual da `LoginPage` (marca no topo, card branco, mesmas classes de input e de botão). Título do card: `Criar conta`. Subtítulo da marca: `Crie sua agenda pessoal com lembretes no Telegram`.

Campos, cada um com `<label htmlFor>`:
- `Nome` (`id="cadastro-nome"`, `autoComplete="name"`, `maxLength={80}`)
- `E-mail` (`id="cadastro-email"`, `type="email"`, `autoComplete="email"`)
- `Senha` (`id="cadastro-senha"`, `type="password"`, `autoComplete="new-password"`), com dica abaixo: `Mínimo de 8 caracteres, com letra e número.` ligada por `aria-describedby`
- `Confirmar senha` (`id="cadastro-confirmar"`, `type="password"`, `autoComplete="new-password"`)

Validação ao enviar (antes de chamar a API), na ordem, mostrando a primeira mensagem que falhar no mesmo bloco `role="alert"` da `LoginPage`:
1. nome vazio (após `trim`): `Informe o seu nome.`
2. e-mail vazio ou sem `@`: `Informe um e-mail válido.`
3. senha com menos de 8 ou mais de 72 caracteres, ou sem letra, ou sem número: `A senha precisa ter de 8 a 72 caracteres, com pelo menos uma letra e um número.`
4. confirmação diferente: `As senhas não são iguais.`

Se passar, chama `onRegister(name.trim(), email.trim(), password)`; se voltar uma string, mostra essa mensagem no alerta. Botão `Criar conta` (com `Criando…` e o ícone `Loader2` enquanto `loading`). Abaixo do card: `Já tem conta?` + botão-link `Entrar`, que chama `onGoToLogin`.

Props: `loading: boolean`, `onRegister: (name: string, email: string, password: string) => Promise<string | null>`, `onGoToLogin: () => void`. O estado dos campos fica dentro da própria página.

### 6. Mock e testes

`mockApi.ts`: rota `POST /auth/register`. Se o e-mail já existir em `currentUsers`, responde 400 com `{ message: 'Não foi possível criar a conta com este e-mail. Se você já tem conta, entre ou recupere a senha.' }`. Senão cria um usuário `USER` novo (id gerado, `telegramChatId: null`), acrescenta em `currentUsers`, cria para ele uma agenda pessoal `Minha agenda` na lista de agendas do mock (seguir o formato das agendas existentes) e responde `{ accessToken: 'token-<id>', user }`. A rota fica junto da de login, antes da checagem de token.

`criar-conta.test.tsx` (mesmo estilo do `login.test.tsx`), no mínimo:
- na tela de login, o botão `Criar conta` leva à tela com o título `Criar conta`;
- enviar vazio mostra `Informe o seu nome.` e não chama `/auth/register`;
- senha `abcdefgh` mostra a mensagem da regra de senha;
- confirmação diferente mostra `As senhas não são iguais.`;
- e-mail já usado (`dr.joao@vidaemdia.com.br`) mostra a mensagem do servidor;
- cadastro válido chama `/auth/register` com nome, e-mail e senha e leva à agenda (aparece o botão `+ Novo compromisso`);
- `Entrar` volta à tela de login.

`login.test.tsx`: acrescentar um teste que renderiza `<LoginPage ... showDemoAccounts={false} />` direto (com props mínimas) e confere que o texto `Entrar com uma conta de demonstração` não aparece.

### 7. README

- Na seção `## 6. Contas de Teste Criadas pelo Seed`, acrescentar que os botões das contas de demonstração na tela de login só aparecem com `VITE_SHOW_DEMO_ACCOUNTS=true` no `.env` (e rebuild do front: `docker compose up -d --build frontend`).
- Acrescentar uma linha dizendo que qualquer pessoa pode criar uma conta pessoal em `/criar-conta` (link "Criar conta" na tela de login).

## Critérios de aceite

- `npm test`, `npm run lint` e `npm run build` no front passam.
- Sem a variável, a tela de login não mostra as contas demo; com `VITE_SHOW_DEMO_ACCOUNTS=true`, mostra.
- Criar conta pela tela entra direto na agenda nova.

## O que NÃO alterar

- O backend, o nginx e qualquer arquivo fora da lista.
- O comportamento atual do login e dos Bastidores.
