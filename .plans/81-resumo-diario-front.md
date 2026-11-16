# 81 — Resumo diário: opção na tela Minha conta

## Objetivo

Na tela Minha conta, o usuário liga ou desliga o resumo diário do Telegram e escolhe a hora do envio. O backend já existe (plano 80): `PATCH /auth/me/resumo-diario`, com corpo `{ enabled: boolean, hour: 0..23 }`. A rota devolve o perfil (`User`) com `dailySummaryEnabled` e `dailySummaryHour`, e o `GET /auth/me` também traz esses dois campos.

## Arquivos envolvidos (só estes)

- `frontend/src/types.ts`
- `frontend/src/api.ts`
- `frontend/src/pages/MinhaContaPage.tsx`
- `frontend/src/test/mockApi.ts`
- `frontend/src/test/minha-conta.test.tsx`

## Passos

### 1. Tipo (`types.ts`)

No `interface User`, acrescentar `dailySummaryEnabled?: boolean;` e `dailySummaryHour?: number;`.

### 2. API (`api.ts`)

Logo depois de `updateProfile`:

```ts
export async function updateDailySummary(
  token: string,
  enabled: boolean,
  hour: number,
): Promise<User> {
  return apiRequest<User>(
    '/auth/me/resumo-diario',
    { method: 'PATCH', body: JSON.stringify({ enabled, hour }) },
    token,
  );
}
```

### 3. Tela (`MinhaContaPage.tsx`)

Criar uma nova `<section>` **entre "Conexões" e "Excluir conta"**, com as mesmas classes da seção "Senha" e o título `<h2>` **Resumo diário**.

Estado:
- `summaryEnabled`, que começa em `user.dailySummaryEnabled ?? true`.
- `summaryHour`, que começa em `user.dailySummaryHour ?? 7`.
- `summaryLoading`, `summaryError` e `summarySuccess`, no mesmo padrão do nome.

Conteúdo:
- Texto `text-sm text-stone-600`: "Todo dia, no horário escolhido, o bot manda pelo Telegram os seus compromissos do dia."
- Se `!telegramLinked`: aviso `text-xs text-amber-700` com "Conecte o Telegram em Conexões para receber o resumo." Os controles continuam utilizáveis.
- Um formulário (`onSubmit={handleSaveSummary}`, `noValidate`) com:
  - Checkbox `id="conta-resumo-ligado"` e label "Receber o resumo diário". O checkbox fica com `accent-brand-700` e `w-4 h-4`, e o label com `inline-flex items-center gap-2 text-sm text-stone-800`.
  - `<select id="conta-resumo-hora">` com label "Horário", com 24 opções de `00:00` a `23:00` (o `value` de cada uma é o número). Ele fica `disabled` quando `!summaryEnabled`, com as classes do input de nome, mas sem `w-full`: usar `w-32`.
  - Botão submit "Salvar resumo", no mesmo estilo e com o mesmo estado de carregamento ("Salvando…") do "Salvar nome". Fica desabilitado quando nada mudou em relação a `user` (`summaryEnabled === (user.dailySummaryEnabled ?? true) && summaryHour === (user.dailySummaryHour ?? 7)`) ou durante `summaryLoading`.
  - Os blocos de erro (`role="alert"`) e de sucesso (`role="status"`) seguem o mesmo padrão do nome. A mensagem de sucesso é "Resumo diário salvo." Ao mudar qualquer campo, `summarySuccess` volta a `false`.
- `handleSaveSummary` chama `updateDailySummary(token, summaryEnabled, summaryHour)`, depois `onUserUpdated(updated)` e então `setSummarySuccess(true)`. Em caso de erro, usa `setSummaryError(errorMessage(err, 'Não foi possível salvar o resumo diário.'))`.

### 4. Mock (`test/mockApi.ts`)

- No usuário de teste devolvido pelo `GET /auth/me`, incluir `dailySummaryEnabled: true, dailySummaryHour: 7`. Se o objeto do usuário vier de uma lista de usuários, colocar os campos lá.
- Nova rota, no mesmo estilo de `PATCH /auth/me`: `route === '/auth/me/resumo-diario' && method === 'PATCH'`. Ela devolve o usuário atual com `dailySummaryEnabled` e `dailySummaryHour` do corpo.

### 5. Testes (`test/minha-conta.test.tsx`)

Seguir o padrão dos testes que já existem (`renderApp({ path: '/conta', token: 'token-carlos' })`):
- A seção mostra o título "Resumo diário", o checkbox "Receber o resumo diário" marcado e o select "Horário" com o valor `7`. O botão "Salvar resumo" começa desabilitado.
- Ao mudar o horário para `08:00` (`user.selectOptions`) e salvar, há exatamente uma chamada `PATCH` em `/auth/me/resumo-diario` com o corpo `{ enabled: true, hour: 8 }`, e aparece "Resumo diário salvo."
- Ao desmarcar o checkbox, o select fica desabilitado. Depois de salvar, o corpo enviado é `{ enabled: false, hour: 7 }`.

## Critérios de aceite

- Dentro de `frontend/`, todos passam sem erros:
  - `npx tsc --noEmit` (ou o script de checagem de tipos do projeto)
  - `npm run lint`
  - `npm test`
- Os testes antigos de Minha conta continuam passando.

## O que NÃO alterar

- Os arquivos do `backend/`, `README.md`, `infra/` e `.plans/` (exceto este).
- As seções Dados, Senha, Conexões e Excluir conta, por dentro.
- `App.tsx` e as rotas.
