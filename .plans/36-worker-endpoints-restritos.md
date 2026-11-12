# 36 — Endpoints do worker restritos (roteiro 3.4, item S4)

Pré-requisito cumprido: o passo 3.2 tirou `/notificacoes/status` da carga da Agenda (só os Bastidores chamam).
Não execute comandos de terminal. Use só ferramentas de arquivo.

## Problema
Em `backend/src/notifications/bot-webhook.controller.ts`:
- `GET /notificacoes/status` devolve os 50 lembretes mais recentes de **todas** as agendas e todas as mensagens
  despachadas (com texto e destinatário) para qualquer conta logada.
- `POST /notificacoes/executar-worker` e `POST /notificacoes/simular-falha` aceitam qualquer conta logada.

## Arquivos
- Editar: `backend/src/notifications/bot-webhook.controller.ts`
- Criar: `backend/src/notifications/bot-webhook.controller.spec.ts`

## Passos
1. `GET /notificacoes/status` recebe `@Req() req` e usa `req.user.sub` e `req.user.role`.
   - Se `role !== 'ADMIN'`, filtrar os lembretes pelas agendas que o usuário pode ver:
     ```ts
     where: {
       appointment: {
         calendar: {
           OR: [
             { ownerId: userId },
             { permissions: { some: { granteeUserId: userId, canView: true } } },
           ],
         },
       },
     }
     ```
     (ADMIN: sem filtro, como hoje.) Manter `include`, `orderBy` e `take: 50`.
   - `dispatchedMessages`: para quem não é ADMIN, manter só as mensagens cujo `appointmentId` pertence a uma agenda que o usuário pode ver.
     Buscar esses ids com uma consulta `prisma.appointment.findMany({ where: { id: { in: ids }, calendar: <mesmo OR acima> }, select: { id: true } })`
     sobre os `appointmentId` das mensagens, e filtrar a lista.
   - `worker` continua igual.
2. `POST /notificacoes/executar-worker` e `POST /notificacoes/simular-falha`:
   `@UseGuards(JwtAuthGuard, RbacGuard)` e `@Roles(UserRole.PROFESSIONAL, UserRole.ADMIN)`
   (`RbacGuard` e `Roles` já existem em `backend/src/auth/jwt-auth.guard.ts`; `UserRole` de `@prisma/client`).
   Atualizar o `summary` do Swagger com "(Profissional e Admin)" no fim.
3. Testes em `bot-webhook.controller.spec.ts` (instanciar o controller com `new` e mocks, como em `bot.service.spec.ts`):
   - `getStatus` com usuário USER: `prisma.reminder.findMany` recebe `where` com o `OR` de dono e permissão;
     mensagens despachadas de agendas fora do acesso são removidas.
   - `getStatus` com ADMIN: `findMany` sem `where` de agenda; todas as mensagens.
   - `RbacGuard` com metadados `[PROFESSIONAL, ADMIN]`: USER e SECRETARY lançam `ForbiddenException`; PROFESSIONAL passa
     (testar o guard diretamente, com um `Reflector` mockado e um `ExecutionContext` fake).

## Critérios de aceite
- `npm run build`, `npm run lint` (0 erros) e `npm test` passando no backend.
- Com o sistema no ar: Carlos recebe 403 em `executar-worker`; Dr. João recebe 200.
  Em `/notificacoes/status`, Carlos só vê lembretes das agendas dele.

## O que NÃO alterar
- `bot/webhook`, worker, provider, frontend, schema.
