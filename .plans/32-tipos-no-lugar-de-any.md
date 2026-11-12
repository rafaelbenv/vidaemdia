# 32 — Tipos no lugar dos `any` no front (roteiro 2.5, item E3)

## Objetivo
Zerar os avisos `@typescript-eslint/no-explicit-any` do `frontend/`, com tipos que reflitam o que o backend devolve de verdade.
**Sem mudança de comportamento nem visual.**
Não execute comandos de terminal. Use só ferramentas de arquivo.

## Arquivos
- Editar: `frontend/src/types.ts`, `frontend/src/api.ts`, `frontend/src/App.tsx`,
  `frontend/src/pages/LembretesPage.tsx`, `frontend/src/pages/AuditoriaPage.tsx`, e outros arquivos de `frontend/src` que usem os tipos alterados.
- Só LER (nunca alterar): `backend/src/**` — para descobrir o formato exato de cada resposta.

## Passos

### 1. Erro de API tipado (`api.ts`)
```ts
export class ApiError extends Error {
  constructor(message: string, public readonly status: number, public readonly body: unknown) {
    super(message);
    this.name = 'ApiError';
  }
}
export function errorStatus(err: unknown): number | undefined {
  return err instanceof ApiError ? err.status : undefined;
}
export function errorMessage(err: unknown, fallback = 'Erro inesperado'): string {
  return err instanceof Error && err.message ? err.message : fallback;
}
```
- Em `apiRequest`, lançar `new ApiError(message, response.status, errorData)` no lugar do `Error` com `.status`.
  A mensagem é calculada exatamente como hoje. `errorData` vira `unknown`; para ler `message`, usar uma checagem de tipo
  (`typeof errorData === 'object' && errorData !== null && 'message' in errorData`).
- `import.meta.env`: criar `frontend/src/vite-env.d.ts` com `/// <reference types="vite/client" />` e usar `import.meta.env.VITE_API_URL` sem cast.

### 2. Tipos das respostas (`types.ts`)
Ler os controllers e services do backend e criar interfaces para:
- `GET /notificacoes/status` → `NotificationsStatus` (com `worker: WorkerStats`, `reminders: Reminder[]`, `dispatchedMessages: DispatchedMessageLog[]`). `WorkerStats` com os campos que o backend devolve.
- `GET /health` → `HealthData`.
- `GET /agendas/:id/verificar-acesso` → `VerifyAccessResponse`.
- `POST /agendas/:id/permissoes` → corpo `GrantPermissionBody` e resposta `GrantPermissionResponse`.
- `POST /notificacoes/executar-worker` → `RunWorkerResponse`.
- `POST /notificacoes/simular-falha` → corpo `SimulateFailureBody` e resposta.
- `POST /compromissos` → corpo `CreateAppointmentBody` (os campos que o front envia hoje).
- `DELETE /compromissos/:id` → resposta.
- `POST /notificacoes/bot/webhook` → corpo `BotMessageBody`.
- O `any` que já existe em `types.ts` (linha ~110): trocar por tipo concreto ou `Record<string, unknown>` se for JSON livre (ex.: `metadata`).
Campos que o front não lê podem ser omitidos; campos que o front lê têm de existir na interface.

### 3. Usar os tipos
- `api.ts`: cada função com o tipo de corpo e de retorno corretos; nenhum `any`.
- `App.tsx`: `useState<WorkerStats | null>`, `useState<HealthData | null>`.
  Trocar `catch (err: any)` por `catch (err: unknown)` e usar `errorStatus(err)` / `errorMessage(err, '<o mesmo texto padrão de hoje>')`.
  O `(me as any).telegramLinked`: acrescentar `telegramLinked?: boolean` em `User` e remover o cast.
- `LembretesPage.tsx` e `AuditoriaPage.tsx`: props com `WorkerStats | null` e `HealthData | null`.
  Onde o JSX lê um campo que pode faltar, usar `?.` como já faz hoje. Não mudar texto nem classes.

## Critérios de aceite
- `npm run build` sem erros e `npm run lint` com 0 erros e **nenhum** aviso `no-explicit-any` em `frontend/`.
  (Os avisos `react-hooks/exhaustive-deps` continuam; não mexer neles.)
- Nenhum texto visível alterado.

## O que NÃO alterar
- Qualquer arquivo do backend.
- Lógica dos handlers, efeitos, rotas, JSX (além de tipos e `?.` necessários).
