# 47 — Testes do front com Vitest e Testing Library (roteiro 6.5, item E5)

## Objetivo
Testes de integração que renderizam o `<App />` inteiro com uma API falsa em memória e cobrem: login, criar, editar e cancelar compromisso,
troca de agenda e visão de mês. Rodar no CI.
Dependências JÁ INSTALADAS: `vitest@2`, `jsdom@25`, `@testing-library/react@16`, `@testing-library/dom@10`, `@testing-library/user-event@14`, `@testing-library/jest-dom@6`.
Não execute comandos de terminal. Use só ferramentas de arquivo.

## Arquivos
- Criar: `frontend/vitest.config.ts`, `frontend/src/test/setup.ts`, `frontend/src/test/mockApi.ts`, `frontend/src/test/renderApp.tsx`,
  `frontend/src/test/login.test.tsx`, `frontend/src/test/agenda.test.tsx`, `frontend/src/test/lib.test.ts`
- Editar: `frontend/package.json` (só `scripts`), `frontend/tsconfig.json` (só se precisar incluir tipos do vitest), `.github/workflows/ci.yml` (um passo)

## Passos

### 1. Configuração
`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
process.env.TZ = 'America/Sao_Paulo';
export default defineConfig({
  plugins: [react()],
  test: { environment: 'jsdom', setupFiles: ['./src/test/setup.ts'], pool: 'forks', css: false, restoreMocks: true },
});
```
`package.json` scripts: `"test": "vitest run"`, `"test:watch": "vitest"`.
`src/test/setup.ts`: `import '@testing-library/jest-dom/vitest';`, `afterEach(cleanup)` e limpeza de `localStorage`/`sessionStorage`;
mock de `window.matchMedia` (retorna `matches: true` para `(min-width: 640px)`, ou seja, desktop), `window.open = vi.fn()` e
`Element.prototype.scrollIntoView = vi.fn()`.

### 2. API falsa (`src/test/mockApi.ts`)
`installMockApi(seed?)` substitui `globalThis.fetch` por um `vi.fn` que responde (objetos `Response` com JSON) às rotas usadas pelo app, com estado em memória:
- Usuários: Carlos (`USER`, com Telegram), Dr. João (`PROFESSIONAL`, sem Telegram), Maria (`SECRETARY`), senha `123456`.
  Agendas: "Agenda Pessoal - Carlos" (dono Carlos); "Consultório Dr. João Mendes" (`PROFESSIONAL`, dono João, Maria com todas as permissões); "Agenda Pessoal - Dr. João".
  Compromissos iniciais: dois no Consultório em `2026-11-10` (08:00 e 10:30), um cancelado no mesmo dia.
- Rotas (prefixo `/api`): `POST /auth/login` (401 com senha errada), `GET /auth/me`, `GET /agendas` (formato `{ owned, delegated }` com `myPermissions`, igual ao backend),
  `GET /telegram/status`, `GET /compromissos?calendarId=`, `POST /compromissos` (gera id, cria `reminders` como o backend: `remindAt = startTime - minutos`,
  sem lembrete se `reminderEnabled === false`), `PATCH /compromissos/:id`, `DELETE /compromissos/:id` (status `CANCELLED`), `GET /auditoria?calendarId=` (lista vazia).
  O token devolvido identifica o usuário (ex.: `token-<id>`); sem token válido → 401.
- Exportar também `calls()` (lista de `{ method, path, body }`) para os testes conferirem o que foi enviado.

### 3. `src/test/renderApp.tsx`
`renderApp({ path = '/', token? })`: se `token`, grava `localStorage['vidaemdia_jwt']`; renderiza `<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>`
(não usar o `BrowserRouter` do `main.tsx`). Retorna `userEvent.setup()` e o resultado do `render`.
Fixar a data: `vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-10T07:00:00-03:00'))` nos testes que dependem de "hoje" (e `vi.useRealTimers()` no `afterEach`).

### 4. Testes
`login.test.tsx`:
- campos vazios ao abrir; enviar vazio mostra "Informe o e-mail e a senha.";
- senha errada mostra o erro do servidor;
- entrar pelo formulário leva à agenda (aparece o botão "+ Novo compromisso");
- entrar pelo botão de demonstração "Dr. João Mendes — Profissional" funciona sem preencher a senha.

`agenda.test.tsx` (logado como Dr. João, `path: '/agenda?dia=2026-11-10'`):
- mostra os dois compromissos ativos e esconde o cancelado; "Mostrar 1 cancelado" revela;
- **criar:** "+ Novo compromisso" → título, horário 15:00, lembrete "30 minutos antes" → "Salvar" → a API recebe `POST /compromissos` com `reminderMinutesBefore: 30`
  e `startTime` de 15:00 em São Paulo; o toast diz "Compromisso salvo. Lembrete às 14:30."; a linha aparece;
- **validação:** salvar sem título mostra "Diga o que é o compromisso." e não chama a API;
- **editar:** clicar na linha de 08:00 abre "Editar compromisso" preenchido; mudar o horário para 09:00 e salvar → `PATCH` com o novo `startTime`; a linha mostra 09:00;
- **cancelar:** abrir a linha, "Cancelar compromisso", confirmar → `DELETE`; a linha some e o link passa a "Mostrar 2 cancelados";
- **troca de agenda:** abrir o menu de agendas, escolher "Agenda Pessoal - Dr. João" → a API recebe `GET /compromissos?calendarId=<da pessoal>` e a lista do dia fica vazia ("Nada marcado para…");
- **visão de mês:** clicar em "Mês" → título "Novembro de 2026"; a célula do dia 10 diz "2 compromissos"; clicar nela volta à visão de dia em 10/11.

`lib.test.ts` (funções puras): `formatLongDate` ("Terça, 10 de novembro"), `monthGridDays` (novembro de 2026 começa num domingo: 6 células vazias antes do dia 1),
`reminderLine` (pendente no mesmo dia, enviado em outro dia → "Lembrete enviado em …", falhou → tom `danger`), `historySentence` (marcou, cancelou, deu acesso, acesso negado),
`firstName("Dr. João Mendes (Cardiologista)") === "João"`.

Usar consultas acessíveis (`getByRole`, `getByLabelText`, `findByText`). Não depender de classes CSS.

### 5. CI
Em `.github/workflows/ci.yml`, no job do front, acrescentar depois de `npm run lint`: `- run: npm test`.

## Critérios de aceite
- `npm test` em `frontend/` passa; `npm run build` e `npm run lint` (0 erros) continuam passando.
- Os testes não fazem requisição de rede de verdade.

## O que NÃO alterar
- Código da aplicação em `src/` (fora de `src/test/`). Se um teste revelar um defeito, **não corrigir**: anotar no fim deste plano, na seção "Defeitos encontrados", com o passo para reproduzir.
- Backend.

## Correções após revisão (devolvido ao executor)
1. **`matchMedia` falso some entre os testes:** com `restoreMocks: true`, o `vi.fn(...)` usado em `setup.ts` perde a implementação e devolve `undefined`, e o teste da visão de mês quebra em `window.matchMedia(...).matches`. Em `src/test/setup.ts`, definir `window.matchMedia` com uma **função comum** (não `vi.fn`), que devolve `{ matches: query.includes("min-width: 640px"), media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; } }`. Fazer o mesmo com `window.open` e `scrollIntoView` (funções comuns).
2. **Build quebrado pelos tipos dos testes** (`npm run build` roda `tsc` em `src/`): em `src/test/lib.test.ts`, os objetos de usuário passados a `historySentence` devem satisfazer o tipo (`{ id, name, email, role: "USER", preferredChannel: "TELEGRAM" } as User` ou um objeto completo); em `src/test/mockApi.ts` linhas 28 e 39, usar `undefined` no lugar de `null` (ou ajustar o tipo local). Não mudar tipos em `src/types.ts`.
Depois: `npm test`, `npm run build` e `npm run lint` precisam passar.
