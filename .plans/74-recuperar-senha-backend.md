# 74 — Recuperar a senha por código no Telegram, no backend (roteiro 9.6, parte 1)

## Objetivo

Quem esqueceu a senha e tem o Telegram vinculado pede um código. O bot envia um código de 6 números, que vale por 15 minutos e serve uma vez só. Com ele, a pessoa cria uma senha nova. A resposta do pedido é sempre a mesma, exista a conta ou não, para não revelar quem tem conta.

## Arquivos envolvidos (só estes)

- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/20261115090000_recuperar_senha/migration.sql` (novo)
- `backend/src/auth/dto/auth.dto.ts`
- `backend/src/auth/password-reset.service.ts` (novo)
- `backend/src/auth/password-reset.service.spec.ts` (novo)
- `backend/src/auth/auth.controller.ts`
- `backend/src/auth/auth.module.ts`

## Passos

### 1. Banco

`schema.prisma`: novo modelo e a relação no `User` (`passwordResetCodes PasswordResetCode[]`, junto de `telegramLinkTokens`):

```prisma
model PasswordResetCode {
  id        String    @id @default(uuid())
  userId    String    @map("user_id")
  codeHash  String    @map("code_hash")
  expiresAt DateTime  @map("expires_at")
  usedAt    DateTime? @map("used_at")
  attempts  Int       @default(0)
  createdAt DateTime  @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("password_reset_codes")
}
```

`migration.sql` (exatamente):

```sql
-- CreateTable
CREATE TABLE "password_reset_codes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "password_reset_codes_user_id_idx" ON "password_reset_codes"("user_id");

-- AddForeignKey
ALTER TABLE "password_reset_codes" ADD CONSTRAINT "password_reset_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

### 2. DTOs (`auth.dto.ts`)

- `ForgotPasswordDto { email }`: o mesmo `@Transform` (trim + minúsculas) e `@IsEmail` do `RegisterDto`.
- `ResetPasswordDto`:
  - `email`: igual ao de cima.
  - `code`: `@IsString()`, `@Matches(/^\d{6}$/, { message: 'O código tem 6 números' })`, com `@Transform` que tira espaços (`value.replace(/\s+/g, '')`).
  - `newPassword`: `@NewPasswordRules()` (já existe no arquivo).

### 3. `password-reset.service.ts`

`@Injectable() PasswordResetService`, com `PrismaService`, `TelegramService`, `AuditService` e `MetricsService`. Constantes no topo: `CODE_TTL_MINUTES = 15`, `MAX_ATTEMPTS = 5`, `RESEND_COOLDOWN_SECONDS = 60`, `GENERIC_REQUEST_MESSAGE = 'Se o e-mail estiver cadastrado e com o Telegram vinculado, enviamos um código pelo Telegram.'`, `INVALID_CODE_MESSAGE = 'Código inválido ou expirado. Peça um novo código.'`.

Usar `(this.prisma as any).passwordResetCode` se o client tipado ainda não tiver o modelo.

`requestCode(email: string, ipAddress?: string): Promise<{ ok: true; message: string }>`
1. Busca o usuário pelo e-mail. Se não existir ou não tiver `telegramChatId`, devolve `{ ok: true, message: GENERIC_REQUEST_MESSAGE }` sem fazer mais nada.
2. Se houver código desse usuário criado há menos de `RESEND_COOLDOWN_SECONDS`, devolve a mesma resposta sem enviar outro.
3. Marca como usados (`usedAt: now`) os códigos ainda não usados desse usuário.
4. Gera o código com `crypto.randomInt(0, 1_000_000)` e `padStart(6, '0')`; grava `codeHash = await bcrypt.hash(code, 10)` e `expiresAt = now + 15 min`.
5. Envia pelo `telegramService.sendMessage(user.telegramChatId, ...)` o texto:
   `🔐 Seu código para criar uma senha nova no VidaEmDia: <b>${code}</b>\nVale por 15 minutos. Se não foi você que pediu, ignore esta mensagem.`
   Se o envio lançar erro, registrar com o `Logger` do Nest (sem o código no log) e seguir.
6. Auditoria: `entityType: 'AUTH'`, `entityId: user.id`, `actorUserId: user.id`, `action: 'UPDATE'`, `details: 'Pedido de código para recuperar a senha.'`.
7. Devolve a resposta genérica.

`resetPassword(dto: ResetPasswordDto, ipAddress?: string): Promise<{ ok: true; message: string }>`
1. Busca o usuário pelo e-mail; se não existir → `BadRequestException(INVALID_CODE_MESSAGE)`.
2. Busca o código mais recente do usuário com `usedAt: null` e `expiresAt > now`; se não houver → mesma exceção.
3. Se `bcrypt.compare(dto.code, codeHash)` falhar: soma 1 em `attempts`; se chegar a `MAX_ATTEMPTS`, grava também `usedAt: now`; `metricsService.incrementAuthFailure()`; lança a mesma exceção.
4. Se der certo: marca o código como usado, grava `passwordHash = await bcrypt.hash(dto.newPassword, 10)`, auditoria `details: 'Senha redefinida com o código do Telegram.'` e envia pelo Telegram `🔐 A senha da sua conta no VidaEmDia foi alterada. Se não foi você, fale com quem administra o VidaEmDia.` (erro no envio só é registrado no log).
5. Devolve `{ ok: true, message: 'Senha alterada. Entre com a senha nova.' }`.

Nunca gravar o código em texto na auditoria nem no log.

### 4. Controller e módulo

`auth.controller.ts` (o `AuthController` recebe também o `PasswordResetService` no construtor):
- `@Post('senha/esqueci')`, `@HttpCode(200)`, `@UseGuards(ThrottlerGuard)`, `@Throttle({ default: { limit: 3, ttl: 60_000 } })`, `@ApiOperation({ summary: 'Pede um código de recuperação de senha pelo Telegram' })` → `requestCode(dto.email, req.ip)`.
- `@Post('senha/redefinir')`, `@HttpCode(200)`, `@UseGuards(ThrottlerGuard)`, `@Throttle({ default: { limit: 5, ttl: 60_000 } })`, `@ApiOperation({ summary: 'Cria uma senha nova com o código recebido no Telegram' })` → `resetPassword(dto, req.ip)`.

`auth.module.ts`: importar `TelegramModule` e incluir `PasswordResetService` nos `providers`. Conferir que o `AuditService` já está disponível para o `AuthService` da mesma forma (usar o mesmo caminho para o novo service).

### 5. Testes (`password-reset.service.spec.ts`)

Com mocks de Prisma, Telegram, Audit e Metrics, no estilo de `auth.service.spec.ts`:
- e-mail sem conta → resposta genérica, sem gravar código e sem enviar;
- conta sem Telegram → resposta genérica, sem enviar;
- conta com Telegram → grava um código (o hash confere com o código enviado na mensagem: extrair os 6 números do texto passado ao `sendMessage`), invalida os anteriores, e a mensagem contém `15 minutos`;
- segundo pedido em menos de 60 s não envia de novo;
- falha no `sendMessage` não muda a resposta;
- `resetPassword` com código certo grava a senha nova (o hash confere), marca o código como usado e envia o aviso;
- código errado soma 1 em `attempts` e lança `BadRequestException`; na 5ª tentativa errada grava `usedAt`;
- código expirado ou já usado (o `findFirst` não acha) lança a exceção;
- a auditoria nunca contém o código.

## Critérios de aceite

- `npx jest` (todos), `npx tsc --noEmit` e `npm run lint` sem erros. (O Claude roda `npx prisma generate` e aplica a migration no banco local antes de testar.)

## O que NÃO alterar

- Login, cadastro, troca de senha logado, o `TelegramService`, o front e qualquer arquivo fora da lista. Sem README neste plano (vem no plano 75).
