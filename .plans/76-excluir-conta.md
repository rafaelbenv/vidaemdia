# 76 — Excluir minha conta (roteiro 9.7, LGPD)

## Objetivo

Em **Minha conta**, a pessoa exclui a própria conta confirmando com a senha. Apaga o usuário, as agendas dele e o que depende delas; desconecta o Google (revogando o acesso) e não deixa compromissos órfãos nas agendas de outras pessoas.

## O que o banco já faz (conferido em `schema.prisma`)

- `Calendar.owner`, `CalendarPermission.granteeUser`, `TelegramLinkToken`, `PasswordResetCode` e `GoogleAccount`: `onDelete: Cascade` → somem com o usuário. Compromissos, lembretes e jobs do Google das agendas dele somem em cascata pela agenda.
- `AuditLog.actorUser`: `SetNull` → o histórico fica, sem o vínculo com a pessoa.
- **`Appointment.createdBy` não tem `onDelete`** (fica `Restrict`): se a pessoa criou compromissos em agendas de outras pessoas (por exemplo, como secretária), a exclusão falharia. Tratar no passo 2.

## Arquivos envolvidos (só estes)

Backend:
- `backend/src/auth/dto/auth.dto.ts`
- `backend/src/auth/account-deletion.service.ts` (novo)
- `backend/src/auth/account-deletion.service.spec.ts` (novo)
- `backend/src/auth/auth.controller.ts`
- `backend/src/auth/auth.module.ts`

Front:
- `frontend/src/api.ts`
- `frontend/src/pages/MinhaContaPage.tsx`
- `frontend/src/App.tsx`
- `frontend/src/test/mockApi.ts`
- `frontend/src/test/minha-conta.test.tsx`

Docs:
- `README.md`

## Passos

### 1. DTO

`DeleteAccountDto { password: string }` com `@IsString()` e `@IsNotEmpty({ message: 'Informe a sua senha para confirmar' })`.

### 2. `account-deletion.service.ts`

`AccountDeletionService` com `PrismaService`, `AuditService`, `MetricsService` e `GoogleAccountService` (de `../google/google-account.service`).

`deleteAccount(userId: string, dto: DeleteAccountDto, ipAddress?: string): Promise<{ ok: true; message: string }>`
1. Busca o usuário; se não existir → `NotFoundException('Usuário não encontrado')`.
2. Confere a senha com `bcrypt.compare`; se errada → `metricsService.incrementAuthFailure()` e `BadRequestException('Senha incorreta.')` (400, não 401, porque o front desloga em 401).
3. Se `googleConfig().configured` (de `../google/google.config`), chama `googleAccountService.disconnect(userId)` dentro de `try/catch` (falha no Google não impede a exclusão; registrar no `Logger`).
4. Numa `prisma.$transaction(async (tx) => { ... })`:
   - Compromissos criados por essa pessoa em agendas de **outros** donos: passam a ter `createdById` = dono da agenda. Fazer com `tx.appointment.findMany({ where: { createdById: userId, calendar: { ownerId: { not: userId } } }, select: { id: true, calendar: { select: { ownerId: true } } } })` e um `update` por compromisso (ou agrupar por dono com `updateMany`).
   - `tx.user.delete({ where: { id: userId } })` (o resto vai em cascata).
5. Depois da transação, auditoria **sem dados pessoais**: `actorUserId: null` (ou omitido, conferir o tipo aceito por `AuditService.log`), `entityType: 'AUTH'`, `entityId: userId`, `action: 'CANCEL'`, `details: 'Conta excluída pelo próprio usuário.'`, `ipAddress`.
6. Devolve `{ ok: true, message: 'Conta excluída.' }`.

Os eventos que já foram enviados para o Google Agenda da pessoa continuam lá (são do Google dela); só o acesso é revogado. Registrar isso no README.

### 3. Controller e módulo

- `auth.controller.ts`: `@Delete('me')`, `@HttpCode(200)`, `@UseGuards(JwtAuthGuard, ThrottlerGuard)`, `@Throttle({ default: { limit: 5, ttl: 60_000 } })`, `@ApiBearerAuth()`, `@ApiOperation({ summary: 'Exclui a conta do usuário autenticado (exige a senha)' })` → `accountDeletionService.deleteAccount(req.user.sub, dto, req.ip)`. O `AuthController` recebe o `AccountDeletionService` no construtor.
- `auth.module.ts`: importar `GoogleModule` (de `../google/google.module`) e acrescentar `AccountDeletionService` aos `providers`. Conferir que não cria dependência circular (o `GoogleModule` não importa o `AuthModule`).

### 4. Testes do backend (`account-deletion.service.spec.ts`)

Com mocks de Prisma (incluindo `$transaction` que executa o callback com o próprio mock), Audit, Metrics e GoogleAccountService:
- senha errada → `BadRequestException`, `incrementAuthFailure` chamado, nada apagado;
- sucesso → `user.delete` chamado com o id; compromissos em agendas de outros donos recebem o `createdById` do dono; auditoria com `'Conta excluída pelo próprio usuário.'` e sem o e-mail nem o nome;
- Google configurado → `disconnect` chamado; se `disconnect` lançar, a conta é excluída mesmo assim;
- Google não configurado → `disconnect` não chamado (simular `googleConfig` com `jest.mock` do módulo `../google/google.config`).

### 5. Front

- `api.ts`: `deleteAccount(token, password): Promise<{ ok: boolean; message: string }>` → `DELETE /auth/me` com corpo `{ password }`. Conferir que o `apiRequest` aceita corpo em DELETE (é só `fetch`).
- `MinhaContaPage.tsx`: quarto card no fim, com borda vermelha clara (`border-red-200`), `<h2>Excluir conta</h2>`, o texto `Apaga a sua conta, as suas agendas, compromissos e lembretes. Não dá para desfazer. Os eventos já enviados ao seu Google Agenda continuam lá.` e o botão `Excluir minha conta` (vermelho, no padrão do botão `Sair` do `UserMenu`). Ao clicar, aparece no próprio card um campo `Confirme com a sua senha` (`type="password"`, `autoComplete="current-password"`) e os botões `Excluir definitivamente` e `Cancelar`. Senha vazia → `Informe a sua senha para confirmar.` sem chamar a API. Erro da API → mensagem com `role="alert"`. Nova prop `onAccountDeleted: () => void`, chamada em sucesso.
- `App.tsx`: passa `onAccountDeleted` para a `MinhaContaPage`: faz o mesmo que o `handleLogout` (sem abrir o diálogo de sair) e mostra o banner `Sua conta foi excluída.` na tela de login. Se o banner não aparece na tela de login hoje, guardar a mensagem num estado e mostrá-la no topo da `LoginPage` (prop opcional `notice?: string`, num bloco `role="status"` verde claro) e limpar no próximo login. Se precisar da prop, incluir `frontend/src/pages/LoginPage.tsx` e registrar no relatório.
- `mockApi.ts`: `DELETE /auth/me` → senha `123456` remove o usuário de `currentUsers` e responde `{ ok: true, message: 'Conta excluída.' }`; senão 400 `{ message: 'Senha incorreta.' }`.
- `minha-conta.test.tsx`: senha errada mostra `Senha incorreta.`; senha certa volta à tela de login com `Sua conta foi excluída.`; `Cancelar` esconde o campo de senha.

### 6. README

Na seção de cadastro (seção 6), acrescentar: **Excluir conta** — em Minha conta, confirmando a senha (`DELETE /auth/me`): apaga a conta, as agendas, compromissos, lembretes e vínculos; desconecta o Google revogando o acesso (os eventos já enviados ao Google da pessoa continuam lá); compromissos que a pessoa criou em agendas de outras pessoas passam para o dono da agenda; a auditoria guarda só o registro da exclusão, sem nome nem e-mail.

## Critérios de aceite

- Backend: `npx jest`, `npx tsc --noEmit`, `npm run lint` sem erros.
- Front: `npm test`, `npm run lint`, `npm run build` passam.

## O que NÃO alterar

- `schema.prisma` (não precisa de migration), o `GoogleAccountService` e qualquer arquivo fora da lista.
