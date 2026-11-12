# 24 — Testes de auth e de acesso por agenda (roteiro passo 1.5, item S14 parte 1)

## Objetivo
Cobrir com testes unitários (Jest, mocks, sem banco) o que foi mudado nos passos 1.1 e 1.3,
mais o controle de acesso por agenda (`CalendarAccessService`).

Não execute comandos de terminal. Use só ferramentas de arquivo.
Siga o estilo de `backend/src/notifications/bot.service.spec.ts`: instanciar o service com `new`,
passando objetos mock com `jest.fn()` convertidos com `as unknown as Tipo`.

## Arquivos a criar (somente estes)
1. `backend/src/auth/auth.service.spec.ts`
2. `backend/src/auth/dto/auth.dto.spec.ts`
3. `backend/src/audit/audit.service.spec.ts`
4. `backend/src/calendars/calendar-access.service.spec.ts`

## 1. `auth.service.spec.ts`
Construtor: `new AuthService(prisma, jwtService, auditService, metricsService)`.
Mocks: `prisma.user.findUnique`, `prisma.user.create`, `prisma.calendar.create`;
`jwtService.sign` retornando `'token-fake'`; `auditService.log`; `metricsService.incrementAuthFailure`.
Para a senha, gerar o hash real no `beforeAll` com `bcrypt.hash('123456', 4)` (`import * as bcrypt from 'bcryptjs'`).

Casos:
- **login com sucesso**: `findUnique` devolve usuário com `passwordHash` do hash acima e `role: 'PROFESSIONAL'`.
  Espera `accessToken === 'token-fake'`, `user.role === 'PROFESSIONAL'`, `user` sem a chave `passwordHash`,
  `jwtService.sign` chamado com objeto contendo `sub`, `email`, `role`, e `auditService.log` chamado com `action: 'LOGIN'`.
- **login normaliza e-mail**: chamar com `'  Dr.Joao@VidaEmDia.com.br '` e esperar `findUnique` com `{ where: { email: 'dr.joao@vidaemdia.com.br' } }`.
- **login com e-mail inexistente**: `findUnique` devolve `null` → rejeita com `UnauthorizedException` e chama `incrementAuthFailure`.
- **login com senha errada**: rejeita com `UnauthorizedException`, chama `incrementAuthFailure`, não chama `jwtService.sign`.
- **registro cria sempre USER**: `findUnique` devolve `null` na 1ª chamada (checagem de e-mail) e, na 2ª (o login feito no fim do registro), devolve o usuário criado com o hash correto. Use `mockResolvedValueOnce` duas vezes.
  Chamar `register({ name: 'Ana', email: 'ana@x.com', password: '123456', role: 'ADMIN' } as any)`.
  Espera `prisma.user.create` chamado com `data` contendo `role: 'USER'`; `prisma.calendar.create` chamado 1 vez com `type: 'PERSONAL'`.
- **registro com e-mail repetido**: `findUnique` devolve um usuário → rejeita com `BadRequestException`, e `user.create` não é chamado.

## 2. `dto/auth.dto.spec.ts`
Confere que o `ValidationPipe` usado em `main.ts` descarta `role` no registro:
```ts
import { ValidationPipe } from '@nestjs/common';
import { RegisterDto } from './auth.dto';

const pipe = new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false });
const result = await pipe.transform(
  { name: 'Ana', email: 'ana@x.com', password: '123456', role: 'ADMIN' },
  { type: 'body', metatype: RegisterDto },
);
expect(result).not.toHaveProperty('role');
expect(result.email).toBe('ana@x.com');
```
Segundo caso: senha com 5 caracteres → `pipe.transform` rejeita (`await expect(...).rejects.toBeDefined()`).

## 3. `audit/audit.service.spec.ts`
Construtor: `new AuditService(prisma)`. Mocks: `prisma.calendar.findUnique`, `prisma.auditLog.findMany` (devolve `[]`).

Casos de `findAllForUser(userId, role, calendarId)`:
- **dono da agenda**: `calendar.findUnique` devolve `{ ownerId: 'u1', permissions: [] }`; `findAllForUser('u1','USER','c1')` resolve e `auditLog.findMany` recebe `where` igual a `{ targetCalendarId: 'c1' }`.
- **com permissão canView**: devolve `{ ownerId: 'outro', permissions: [{ id: 'p1' }] }` → resolve.
- **sem acesso**: devolve `{ ownerId: 'outro', permissions: [] }` → rejeita com `ForbiddenException`; `auditLog.findMany` não é chamado.
- **agenda inexistente**: devolve `null` → rejeita com `NotFoundException`.
- **ADMIN**: `findAllForUser('adm','ADMIN','c1')` resolve sem chamar `calendar.findUnique`.
- **sem calendarId, usuário comum**: `where` recebido tem a chave `OR` (array com 3 itens).

## 4. `calendars/calendar-access.service.spec.ts`
Construtor: `new CalendarAccessService(prisma, auditService, metricsService)`.
Mocks: `prisma.calendar.findUnique`, `prisma.calendarPermission.findUnique`, `auditService.log`, `metricsService.incrementRbacDenied`.
Agenda padrão devolvida: `{ id: 'c1', ownerId: 'dono', name: 'Agenda X', owner: { id: 'dono', name: 'Dr. João', email: 'j@x.com', role: 'PROFESSIONAL' } }`.

Casos de `verifyAccessOrThrow(userId, role, 'c1', operação)`:
- dono → resolve com `isDelegated: false`, sem consultar `calendarPermission`.
- ADMIN não dono → resolve com `isDelegated: false`.
- agenda inexistente → `NotFoundException`.
- secretária com `canView: true` pedindo `VIEW` → resolve com `isDelegated: true`.
- secretária com `canView: true, canCreate: false` pedindo `CREATE` → `ForbiddenException`, chama `incrementRbacDenied` e `auditService.log` com `action: 'ACCESS_DENIED'`.
- usar `it.each` para `UPDATE` (flag `canUpdate`) e `CANCEL` (flag `canCancel`): com a flag `true` resolve, com `false` lança `ForbiddenException`.
- sem nenhuma permissão (`calendarPermission.findUnique` devolve `null`) → `ForbiddenException`.

## Critérios de aceite
- `npm test` no backend passa (os 46 testes antigos e os novos).
- `npm run lint` sem erros.

## O que NÃO alterar
- Nenhum arquivo de código-fonte (só criar os 4 arquivos `.spec.ts`).
