# 26 — Estrutura do front, parte A: utilitários, componentes pequenos e API central (roteiro 2.1a)

Primeira de três partes do passo 2.1 (quebrar o `App.tsx`). Mapa do arquivo em `.plans/25-contexto-app.md`.

**Regra de ouro: refatoração sem nenhuma mudança visual nem de comportamento.**
Mover código, não reescrever. Textos, classes CSS, ordem dos elementos e mensagens ficam idênticos.
Não execute comandos de terminal. Use só ferramentas de arquivo.

## Arquivos (somente estes)
- Criar: `frontend/src/lib/format.ts`, `frontend/src/lib/tabs.ts`,
  `frontend/src/components/ConfirmDialog.tsx`, `frontend/src/components/TechTag.tsx`
- Editar: `frontend/src/api.ts`, `frontend/src/App.tsx`, `frontend/src/types.ts` (só acrescentar tipos, se precisar)

## Passos

### 1. `lib/format.ts`
Mover do `App.tsx` (recortar, sem alterar o corpo) e exportar:
`sanitizeTelegramHtml`, `getErrorMessageByStatus`, `todayStr`, `checkIsPast`, `formatApptDateTime`.

### 2. `lib/tabs.ts`
Mover `TabId` (se estiver no App), `TAB_DEFINITIONS` e `getVisibleTabs`, exportando-os. Os imports de ícones
do `lucide-react` usados por `TAB_DEFINITIONS` vão junto.

### 3. Componentes
- `components/TechTag.tsx`: mover `TechTag` (export nomeado).
- `components/ConfirmDialog.tsx`: mover `ConfirmDialog` e a interface `ConfirmDialogProps` (exportar os dois).
  Se o `App` usa um tipo de estado do modal (ex.: `ConfirmModalProps`), exportar daqui também.

### 4. `api.ts` — todas as chamadas em um lugar, 401 tratado em um lugar só
a) Acrescentar ao módulo:
```ts
let unauthorizedHandler: (() => void) | null = null;
export function setUnauthorizedHandler(fn: (() => void) | null) { unauthorizedHandler = fn; }
```
Em `apiRequest`, quando `response.status === 401` **e** havia `token`, chamar `unauthorizedHandler?.()` antes de lançar o erro
(o erro continua sendo lançado igual a hoje). Requisição sem token (login) não dispara o handler.

b) Criar uma função exportada para cada endpoint da tabela da seção 3 de `.plans/25-contexto-app.md`
que ainda não tem função, com o mesmo método, caminho e corpo que o `App.tsx` usa hoje. Nomes:
`login(email, password)`, `getMe(token)`, `getCalendars(token)`, `getProfessionals(token)`, `getAuditLogs(token)`,
`getNotificationsStatus(token)`, `getHealth(token)`, `getAppointments(token, calendarId)`,
`createAppointment(token, body)`, `cancelAppointment(token, id)`, `verifyCalendarAccess(token, calendarId)`,
`grantPermission(token, calendarId, body)`, `runWorkerNow(token)`, `simulateFailure(token, body?)`,
`sendBotMessage(token, body)`.
Tipos de retorno: usar os tipos de `types.ts` que o `App.tsx` já usa em cada chamada (`apiRequest<Tipo>`);
onde hoje é `any`, manter `any` (os tipos são o passo 2.5).

c) No `App.tsx`, trocar cada `apiRequest(...)` pela função correspondente. Depois disso,
`apiRequest` não deve mais aparecer no `App.tsx`.

d) No `App.tsx`, registrar o handler uma vez:
```ts
useEffect(() => {
  setUnauthorizedHandler(() => handleLogout());
  return () => setUnauthorizedHandler(null);
}, []);
```
(Se `handleLogout` for declarado depois, usar uma ref ou declarar o efeito depois dele; não mudar o que `handleLogout` faz.)
Manter os tratamentos de 401 que já existem em `loadInitialData` (não remover ainda; são inofensivos).

### 5. `App.tsx`
Importar tudo dos novos módulos. Remover as definições movidas. Nada mais muda.

## Critérios de aceite
- `npm run build` e `npm run lint` (0 erros) passam em `frontend/`.
- `App.tsx` não contém mais `apiRequest`, nem as funções/componentes movidos.
- Diff do JSX do `App.tsx`: só imports e as chamadas de API trocadas.

## O que NÃO alterar
- Nenhum texto visível, classe CSS, comportamento, ordem de elementos.
- `index.html`, `main.tsx`, `vite.config.ts`, `package.json`, backend.
