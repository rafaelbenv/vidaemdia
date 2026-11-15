# 71 — Primeiros passos para a conta nova (roteiro 9.4)

## Objetivo

Quem acabou de criar a conta (plano 70) vê na agenda um cartão **Primeiros passos** com três itens: conectar o Telegram, criar o primeiro compromisso e (opcional) conectar o Google Agenda. Cada item marca como feito sozinho; o cartão some quando os itens obrigatórios estão feitos ou quando a pessoa dispensa. Contas antigas (e as do seed) não veem o cartão: o comportamento delas não muda.

## Arquivos envolvidos (só estes)

- `frontend/src/components/agenda/PrimeirosPassosCard.tsx` (novo)
- `frontend/src/lib/primeirosPassos.ts` (novo)
- `frontend/src/pages/AgendaPage.tsx`
- `frontend/src/App.tsx`
- `frontend/src/test/primeiros-passos.test.tsx` (novo)
- `frontend/src/test/lib.test.ts`
- `README.md`

## Passos

### 1. `lib/primeirosPassos.ts`

Guarda, por usuário, se o cartão está ativo. Chave: `vidaemdia_primeiros_passos_<userId>`. Valores: `'ativo'` ou `'dispensado'`. Todas as funções protegidas com `try/catch` (localStorage pode falhar):

```ts
export function ativarPrimeirosPassos(userId: string): void   // grava 'ativo'
export function dispensarPrimeirosPassos(userId: string): void // grava 'dispensado'
export function primeirosPassosAtivo(userId: string): boolean  // true só se o valor for 'ativo'
```

Sem valor gravado (contas antigas) → `false`.

### 2. `App.tsx`

- No `handleRegister` (criado no plano 70), logo depois do cadastro dar certo e antes de abrir a sessão, chamar `ativarPrimeirosPassos(res.user.id)`.
- Passar para a `AgendaPage` as novas props: `googleConfigured={googleStatus.configured}`, `googleConnected={googleStatus.connected}` e `onConnectGoogle={handleConnectGoogle}`.
- Nada mais muda.

### 3. `PrimeirosPassosCard.tsx`

Props:
```ts
{
  telegramDone: boolean;
  telegramWaiting: boolean;
  telegramConnecting: boolean;
  onConnectTelegram: () => void;
  appointmentDone: boolean;
  onNewAppointment: () => void;
  showGoogle: boolean;     // só mostra o item 3 se o Google estiver configurado no servidor
  googleDone: boolean;
  onConnectGoogle: () => void;
  onDismiss: () => void;
}
```

Visual no padrão do `TelegramCard` (mesmo card branco com borda `border-brand-600/40`, mesmos botões). `role="region"` e `aria-label="Primeiros passos"`. Título `Primeiros passos`; subtítulo `Três passos para começar a usar a sua agenda.` (ou `Dois passos…` quando `showGoogle` for falso).

Lista ordenada (`<ol>`), cada item com um indicador (ícone `CheckCircle2` verde quando feito, círculo vazio quando não; ícone com `aria-hidden` e o texto `(feito)` só para leitor de tela via `sr-only`):
1. **Conectar o Telegram** — `Os lembretes chegam por lá.` Botão `Conectar Telegram` (desabilitado e com `Conectando…` como no `TelegramCard`). Se `telegramWaiting`, mostrar `Abra o Telegram e toque em Iniciar. Esta tela atualiza sozinha.` no lugar do botão.
2. **Criar o primeiro compromisso** — `Toque em "Novo compromisso" e escolha dia e hora.` Botão `Novo compromisso`.
3. (só com `showGoogle`) **Conectar o Google Agenda (opcional)** — `Seus compromissos aparecem nos dois lugares.` Botão `Conectar Google`.

Item feito: texto com `line-through` em `text-stone-500` e sem botão.

Rodapé: botão de texto `Dispensar` (chama `onDismiss`).

### 4. `AgendaPage.tsx`

- Novas props opcionais: `googleConfigured?: boolean`, `googleConnected?: boolean`, `onConnectGoogle?: () => void`.
- Estado `primeirosPassos` inicializado com `primeirosPassosAtivo(user.id)`.
- Itens obrigatórios: Telegram (`Boolean(telegramLinked)`) e compromisso (`appointments.length > 0` na agenda própria — usar `isOwnCalendar`, que já existe na página; se não for a agenda própria, considerar o passo como não feito apenas para exibição, sem esconder o cartão).
- Mostrar o `PrimeirosPassosCard` (no mesmo lugar do `TelegramCard`, logo abaixo do cabeçalho) quando `primeirosPassos` for verdadeiro e `isOwnCalendar` for verdadeiro.
- Quando o cartão aparece, o `TelegramCard` NÃO aparece (para não repetir o convite do Telegram).
- Quando Telegram e compromisso estiverem feitos (e o Google feito ou não configurado), chamar `dispensarPrimeirosPassos(user.id)` num `useEffect` e esconder o cartão. Se só o Google faltar, o cartão continua até a pessoa dispensar ou conectar.
- `Dispensar`: `dispensarPrimeirosPassos(user.id)` e esconder.
- `onNewAppointment` do cartão chama `handleOpenNew` (a mesma função do botão `+ Novo compromisso`).
- `showGoogle = Boolean(googleConfigured && onConnectGoogle)`.

### 5. Testes

`lib.test.ts`: as três funções de `primeirosPassos.ts` (sem valor → `false`; `ativar` → `true`; `dispensar` → `false`).

`primeiros-passos.test.tsx` (com `installMockApi` e `renderApp`, como `criar-conta.test.tsx`):
- criar conta pela tela → a agenda mostra a região `Primeiros passos` com `Conectar o Telegram` e `Criar o primeiro compromisso`, e não mostra o cartão `Receba seus lembretes no Telegram`;
- `Dispensar` esconde o cartão, e ele não volta ao renderizar de novo com o mesmo usuário;
- conta do seed (`dr.joao@vidaemdia.com.br`) não vê `Primeiros passos`;
- `Novo compromisso` no cartão abre o painel de novo compromisso.

Ajustar o mock só se preciso, e só dentro de `src/test/` — se precisar mudar `mockApi.ts`, incluí-lo e registrar no relatório final.

### 6. README

Na seção que fala do cadastro (`## 6. ...`, linha do `/criar-conta` acrescentada no plano 70), acrescentar: na primeira entrada, a conta nova vê o cartão "Primeiros passos" (Telegram, primeiro compromisso e, se configurado, Google Agenda), que pode ser dispensado.

## Critérios de aceite

- `npm test`, `npm run lint` e `npm run build` no front passam.
- Testes atuais de agenda e login continuam passando sem mudança.

## O que NÃO alterar

- `TelegramCard.tsx`, o backend e qualquer arquivo fora da lista.
