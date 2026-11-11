# 23 — Segurança do backend (roteiro passos 1.1 a 1.4; itens S1, S2, S16, S6)

Cada seção é executada e commitada separadamente. Quando o pedido disser "seção X",
implemente SÓ a seção X. Não execute comandos de terminal (dependências já instaladas:
`@nestjs/throttler@6` e `helmet@8`). Use só ferramentas de arquivo.

---

## Seção 1.1 — Registro público cria sempre USER (S1)

Arquivos: `backend/src/auth/dto/auth.dto.ts`, `backend/src/auth/auth.service.ts`, `backend/src/auth/auth.controller.ts`.

Passos:
1. Em `RegisterDto`, remover o campo `role` inteiro (decorators `@ApiPropertyOptional`, `@IsOptional`, `@IsEnum(UserRole)` e a propriedade). Se `UserRole` ficar sem uso no arquivo, remover do import.
2. Em `AuthService.register`, trocar `const role = dto.role || UserRole.USER;` por `const role = UserRole.USER;`.
3. Ainda em `register`, remover o bloco `if (role === UserRole.PROFESSIONAL) { ... }` que cria a Agenda Profissional (ficou inalcançável). Ajustar o comentário acima da criação da agenda pessoal para: `// Cria automaticamente a Agenda Pessoal do novo usuário`.
4. Em `AuthController`, trocar o summary do `register` para `'Cadastra novo usuário (papel USER) e cria sua agenda pessoal'`.

Aceite: `RegisterDto` não tem `role`; um `POST /auth/register` com `"role":"ADMIN"` cria usuário `USER` (o `ValidationPipe` com `whitelist: true` descarta o campo).

---

## Seção 1.2 — Remover GET /auth/demo-accounts (S2)

Arquivos: `backend/src/auth/auth.controller.ts`, `backend/src/auth/auth.service.ts`.

Passos:
1. Remover o método `demoAccounts()` do controller, com seus decorators.
2. Remover o método `listDemoAccounts()` do service.

Aceite: não existe mais nenhuma ocorrência de `demoAccounts`/`listDemoAccounts`/`demo-accounts` em `backend/src`.

---

## Seção 1.3 — Auditoria por agenda checa acesso (S16)

Arquivo: `backend/src/audit/audit.service.ts` (só este).

Hoje, com `calendarId`, o filtro de dono é ignorado e qualquer conta lê o histórico de qualquer agenda.

Passos:
1. Importar `ForbiddenException` e `NotFoundException` de `@nestjs/common`.
2. Em `findAllForUser`, no ramo `if (calendarId)`, antes de `where.targetCalendarId = calendarId;`, quando `role !== 'ADMIN'`:
   ```ts
   const calendar = await this.prisma.calendar.findUnique({
     where: { id: calendarId },
     select: {
       ownerId: true,
       permissions: { where: { granteeUserId: userId, canView: true }, select: { id: true } },
     },
   });
   if (!calendar) {
     throw new NotFoundException('Agenda não encontrada');
   }
   if (calendar.ownerId !== userId && calendar.permissions.length === 0) {
     throw new ForbiddenException('Você não tem acesso ao histórico desta agenda');
   }
   ```
   (Não usar `CalendarAccessService`: ele depende do `AuditService` e criaria dependência circular.)
3. Não mudar o ramo sem `calendarId`.

Aceite: dono vê o histórico; quem tem `canView` vê; quem não tem recebe 403; agenda inexistente, 404; ADMIN vê qualquer uma.

---

## Seção 1.4 — Limite de tentativas no login/registro e helmet (S6)

Arquivos: `backend/src/app.module.ts`, `backend/src/auth/auth.controller.ts`, `backend/src/main.ts`.

Passos:
1. `app.module.ts`: importar `ThrottlerModule` de `@nestjs/throttler` e adicionar em `imports`:
   `ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 100 }]),`
   NÃO registrar `ThrottlerGuard` como guard global (`APP_GUARD`): o limite vale só para o auth.
2. `auth.controller.ts`: importar `Throttle` e `ThrottlerGuard` de `@nestjs/throttler`.
   - No `login`: `@UseGuards(ThrottlerGuard)` e `@Throttle({ default: { limit: 10, ttl: 60_000 } })`.
   - No `register`: `@UseGuards(ThrottlerGuard)` e `@Throttle({ default: { limit: 5, ttl: 60_000 } })`.
3. `main.ts`:
   - `import helmet from 'helmet';`
   - Logo após criar o app: `app.use(helmet({ contentSecurityPolicy: false }));` (a API só devolve JSON; CSP desligado para não quebrar o Swagger UI).
   - Como o backend fica atrás do nginx (que envia `X-Forwarded-For`), para o limite contar por IP do cliente e não do nginx:
     `NestFactory.create<NestExpressApplication>(AppModule)` (importar `NestExpressApplication` de `@nestjs/platform-express`) e `app.set('trust proxy', 1);`.

Aceite: a 11ª tentativa de login em 1 minuto do mesmo IP recebe 429; as demais rotas não têm limite; respostas trazem os cabeçalhos do helmet (ex.: `X-Content-Type-Options: nosniff`).

---

## O que NÃO alterar (todas as seções)
- Frontend, prisma/schema, seed, Dockerfiles, compose, testes existentes.
- Qualquer arquivo não listado na seção pedida.
