# 72 — Minha conta: mudar nome e trocar senha, no backend (roteiro 9.5, parte 1)

## Objetivo

Duas rotas novas para o usuário logado: mudar o próprio nome e trocar a senha (pedindo a atual). Ambas registram auditoria.

## Arquivos envolvidos (só estes)

- `backend/src/auth/dto/auth.dto.ts`
- `backend/src/auth/auth.controller.ts`
- `backend/src/auth/auth.service.ts`
- `backend/src/auth/dto/auth.dto.spec.ts`
- `backend/src/auth/auth.service.spec.ts`

## Passos

### 1. DTOs (`auth.dto.ts`)

- Extrair as regras repetidas em constantes/decorators locais para não duplicar:
  - `NameRules()`: o `@Transform` de limpeza do nome, `@IsString`, `@IsNotEmpty({ message: 'O nome é obrigatório' })`, `@MaxLength(80, ...)` — exatamente as mensagens que o `RegisterDto` já usa. Implementar com `applyDecorators` de `@nestjs/common`.
  - `NewPasswordRules()`: `@IsString`, `@MinLength(8, ...)`, `@MaxLength(72, ...)`, `@Matches(...)` — as mesmas mensagens do `RegisterDto`.
  - O `RegisterDto` passa a usar `@NameRules()` no `name` e `@NewPasswordRules()` no `password` (o comportamento não muda; os testes atuais têm de continuar passando).
- `UpdateProfileDto { @ApiProperty name: string }` com `@NameRules()`.
- `ChangePasswordDto`:
  - `currentPassword: string` com `@IsString()` e `@IsNotEmpty({ message: 'Informe a senha atual' })`.
  - `newPassword: string` com `@NewPasswordRules()`.

### 2. Service (`auth.service.ts`)

- `updateProfile(userId: string, dto: UpdateProfileDto, ipAddress?: string)`:
  - `prisma.user.update` com o nome (já limpo pelo DTO; limpar de novo com `trim().replace(/\s+/g, ' ')` por segurança).
  - Auditoria: `entityType: 'AUTH'`, `entityId: userId`, `action: 'UPDATE'`, `details: 'Nome alterado para <nome novo>.'`.
  - Devolve `this.getProfile(userId)`.
- `changePassword(userId: string, dto: ChangePasswordDto, ipAddress?: string)`:
  - Busca o usuário; se não existir, `NotFoundException('Usuário não encontrado')`.
  - Se `bcrypt.compare(dto.currentPassword, user.passwordHash)` falhar: incrementar `metricsService.incrementAuthFailure()` e lançar `BadRequestException('A senha atual está incorreta.')`. Usar 400, **não** 401: o front desloga a pessoa quando recebe 401.
  - Se a senha nova for igual à atual (`bcrypt.compare(dto.newPassword, user.passwordHash)`): `BadRequestException('A senha nova precisa ser diferente da atual.')`.
  - Grava o hash novo (`bcrypt.hash(dto.newPassword, 10)`).
  - Auditoria: `action: 'UPDATE'`, `details: 'Senha alterada.'` (nunca registrar a senha).
  - Devolve `{ ok: true, message: 'Senha alterada.' }`.

### 3. Controller (`auth.controller.ts`)

- `@Patch('me')`, `@UseGuards(JwtAuthGuard)`, `@ApiBearerAuth()`, `@ApiOperation({ summary: 'Altera o nome do usuário autenticado' })` → `updateProfile(req.user.sub, dto, req.ip)`.
- `@Post('me/senha')`, `@UseGuards(JwtAuthGuard, ThrottlerGuard)`, `@Throttle({ default: { limit: 5, ttl: 60_000 } })`, `@ApiBearerAuth()`, `@ApiOperation({ summary: 'Troca a senha do usuário autenticado (exige a senha atual)' })` → `changePassword(req.user.sub, dto, req.ip)`. `@HttpCode(200)`.

### 4. Testes

`auth.dto.spec.ts`:
- `UpdateProfileDto`: recusa nome vazio e com 81 caracteres; limpa espaços.
- `ChangePasswordDto`: recusa `currentPassword` vazia; recusa `newPassword` fraca (`'abcdefgh'`); aceita `{ currentPassword: '123456', newPassword: 'senhaForte1' }`.

`auth.service.spec.ts`:
- `updateProfile` grava o nome, registra auditoria `UPDATE` e devolve o perfil.
- `changePassword`: senha atual errada → `BadRequestException` com a mensagem e `incrementAuthFailure` chamado, sem gravar; senha nova igual à atual → `BadRequestException`; sucesso → grava um hash que confere com a senha nova (`bcrypt.compare`), registra auditoria com `'Senha alterada.'` e o `details` não contém a senha.

## Critérios de aceite

- `npx jest src/auth` e `npm test` passam; `npx tsc --noEmit` e `npm run lint` sem erros.

## O que NÃO alterar

- `LoginDto`, o login, o cadastro (além de usar os decorators extraídos), o schema do Prisma e qualquer arquivo fora da lista. Não mexer no README (a documentação vem no plano 73).
