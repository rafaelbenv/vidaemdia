# 77 — Isolamento entre contas para o servidor público (roteiro 9.8)

## Objetivo

Com pessoas de fora usando o sistema, nenhuma conta pode ver dados de outras nem números do sistema inteiro. Hoje:

1. `GET /agendas/profissionais` devolve nome, e-mail e agendas profissionais de **todos** os profissionais para **qualquer** usuário logado.
2. `GET /health` é público (o nginx repassa `/api/health`) e mostra contagens do banco inteiro (usuários, agendas, compromissos…) e os contadores de métricas.
3. `GET /metrics` também passa pelo nginx (`/api/metrics`) sem login. O Prometheus coleta direto em `backend:3000`, pela rede interna, então o caminho público não é necessário.

## Arquivos envolvidos (só estes)

- `backend/src/calendars/calendars.service.ts`
- `backend/src/calendars/calendars.controller.ts`
- `backend/src/calendars/calendars.service.spec.ts`
- `backend/src/monitoring/monitoring.controller.ts`
- `backend/src/monitoring/monitoring.controller.spec.ts` (novo)
- `infra/nginx/nginx.conf`
- `frontend/src/api.ts`
- `frontend/src/App.tsx`
- `frontend/src/test/mockApi.ts`
- `README.md`

## Passos

### 1. Diretório de profissionais

- `listProfessionalsDirectory(currentUserId: string, role: string)`: se `role` não for `SECRETARY` nem `ADMIN`, devolve `[]` sem consultar o banco. Para `SECRETARY`, devolve só os profissionais que deram alguma permissão a ela (`ownedCalendars: { some: { permissions: { some: { granteeUserId: currentUserId } } } }` no `where`, além de `role: 'PROFESSIONAL'`). `ADMIN` continua vendo todos.
- Controller: passar `req.user.role`.
- Testes em `calendars.service.spec.ts`: `USER` e `PROFESSIONAL` recebem `[]` e o `findMany` não é chamado; `SECRETARY` consulta com o filtro de permissão; `ADMIN` consulta sem esse filtro.

### 2. Health

- `GET /health` (público, usado pelo healthcheck do Docker): devolve só `{ status, timestamp, services }` (o mesmo cálculo de `dbStatus` de hoje). Sem `databaseStats` e sem `metrics`.
- Novo `GET /health/detalhes`: `@UseGuards(JwtAuthGuard, RbacGuard)`, `@Roles(UserRole.PROFESSIONAL, UserRole.ADMIN)`, `@ApiBearerAuth()` (importar como em `bot-webhook.controller.ts`). Devolve exatamente o objeto completo que o `/health` devolve hoje.
- Conferir no `monitoring.module.ts` (sem alterá-lo) se o `RbacGuard` precisa de algum provider; se precisar e não houver como sem mexer no módulo, registrar no relatório e parar.
- `monitoring.controller.spec.ts`: `/health` não traz `databaseStats`; `/health/detalhes` traz; o metadado de papéis de `getHealthDetails` é `[PROFESSIONAL, ADMIN]` (ler com `Reflector`, como os outros specs fazem com `@Roles`, se houver exemplo; senão testar só o retorno dos dois métodos).

### 3. nginx

Em `infra/nginx/nginx.conf`, antes do `location /api/`:

```nginx
    # Métricas só pela rede interna (o Prometheus coleta direto em backend:3000)
    location = /api/metrics {
        return 404;
    }
```

### 4. Front

- `api.ts`: `getHealth` passa a chamar `/health/detalhes` (com token, como hoje).
- `App.tsx`, `loadBastidoresData`: trocar o `Promise.all` por chamadas independentes, para um 403 em uma (ex.: Saúde para conta `USER`) não derrubar as outras. Usar `Promise.allSettled`; aplicar cada resultado `fulfilled` no estado correspondente; se `getHealth` falhar com 403, `setHealthData(null)` sem banner. Mostrar o banner de erro só se **todas** falharem ou se alguma falhar com status diferente de 401 e 403 (mantendo o `silent` como hoje).
- `mockApi.ts`: a rota de health do mock passa a responder em `/health/detalhes` (manter `/health` também, devolvendo só `status`, `timestamp` e `services`).

### 5. README

- Na seção 8 (Monitoramento), dizer que `/metrics` só é acessível na rede interna (o nginx responde 404 em `/api/metrics`) e que `/health` público só informa se o sistema está no ar; os números ficam em `GET /health/detalhes` (Profissional e Admin).
- Na seção 6, dizer que o diretório de profissionais (`GET /agendas/profissionais`) só lista para a secretária os profissionais que deram acesso a ela, e para o Admin todos; demais papéis recebem lista vazia.
- Lembrete para o servidor público: `VITE_SHOW_BASTIDORES=false` no `.env` antes do build do front.

## Critérios de aceite

- Backend: `npx jest`, `npx tsc --noEmit`, `npm run lint` sem erros.
- Front: `npm test`, `npm run lint`, `npm run build` passam (os testes atuais, inclusive os de Bastidores, continuam passando).
- O healthcheck do Docker continua funcionando (`/health` responde 200 sem token).

## O que NÃO alterar

- `prometheus.yml`, o `Dockerfile` do backend, as regras de acesso às agendas (`calendar-access.service.ts`) e qualquer arquivo fora da lista.
