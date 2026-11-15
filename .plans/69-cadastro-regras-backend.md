# 69 — Regras do cadastro no backend (roteiro 9.1)

## Objetivo

Deixar o `POST /auth/register` pronto para pessoas reais: senha mais forte, nome limpo e com tamanho máximo, agenda pessoal com nome simples e mensagem de e-mail já usado que não confirma se a conta existe.

## Arquivos envolvidos (só estes)

- `backend/src/auth/dto/auth.dto.ts`
- `backend/src/auth/auth.service.ts`
- `backend/src/auth/dto/auth.dto.spec.ts`
- `backend/src/auth/auth.service.spec.ts`
- `README.md`

## Passos

### 1. `RegisterDto` (`auth.dto.ts`)

- `name`: além do que já tem, `@MaxLength(80, { message: 'O nome pode ter no máximo 80 caracteres' })` e `@Transform(({ value }) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value))` (de `class-transformer`). O `@IsNotEmpty` continua, então um nome só com espaços é recusado.
- `email`: `@Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))` antes do `@IsEmail`, e `@MaxLength(254)`.
- `password`: trocar `@MinLength(6, ...)` por:
  - `@MinLength(8, { message: 'A senha deve ter no mínimo 8 caracteres' })`
  - `@MaxLength(72, { message: 'A senha pode ter no máximo 72 caracteres' })` (limite do bcrypt)
  - `@Matches(/(?=.*[A-Za-z])(?=.*\d)/, { message: 'A senha precisa ter pelo menos uma letra e um número' })`
  - Atualizar o `@ApiProperty` de exemplo para `'senhaForte1'`.
- `LoginDto` não muda (as contas do seed têm senha `123456` e precisam continuar entrando).

Conferir que o `ValidationPipe` global está com `transform: true` (em `backend/src/main.ts`); se não estiver, NÃO alterar o `main.ts`: nesse caso, fazer a limpeza do nome no `auth.service.ts` (`dto.name.trim().replace(/\s+/g, ' ')`) e manter o `@Transform` mesmo assim. Registrar no fim qual dos dois casos aconteceu.

### 2. `auth.service.ts`, método `register`

- Usar o nome limpo (`trim` + espaços repetidos viram um) ao gravar o usuário.
- Mensagem de e-mail repetido: `'Não foi possível criar a conta com este e-mail. Se você já tem conta, entre ou recupere a senha.'` (continua `BadRequestException`).
- Nome da agenda pessoal criada: `'Minha agenda'` (descrição continua `'Compromissos pessoais'`).
- Chamar `this.login` com o e-mail já normalizado.
- Nada mais muda (papel `USER`, auditoria, retorno do login).

### 3. Testes

`auth.dto.spec.ts` (usar `plainToInstance` + `validate`, como o arquivo já faz):
- recusa senha com 7 caracteres;
- recusa senha só com letras (`'abcdefgh'`) e só com números (`'12345678'`);
- aceita `'senhaForte1'`;
- recusa senha com 73 caracteres;
- recusa nome com 81 caracteres e nome só com espaços;
- o e-mail `'  Ana@Exemplo.COM '` vira `'ana@exemplo.com'` depois do `plainToInstance`;
- ajustar o teste existente "rejeita senha com menos de 6 caracteres" para a nova regra (8) e conferir que o teste do `role` continua usando uma senha válida pela regra nova.

`auth.service.spec.ts`:
- o teste de registro existente passa a usar uma senha válida e confere que a agenda criada se chama `'Minha agenda'`;
- nome `'  Ana   Souza '` é gravado como `'Ana Souza'`;
- o teste de e-mail repetido confere a mensagem nova.

### 4. README

Na seção `## 6. Contas de Teste Criadas pelo Seed`, logo depois do título e da lista, acrescentar uma linha em destaque (`>`): contas criadas pelo cadastro (`POST /auth/register`) são de uso pessoal (papel `USER`), recebem a agenda "Minha agenda" e exigem senha de 8 a 72 caracteres com pelo menos uma letra e um número; as contas do seed mantêm a senha `123456`.

## Critérios de aceite

- `npx jest src/auth` passa; `npm test` inteiro continua passando.
- `npx tsc --noEmit` e `npm run lint` sem erros.

## O que NÃO alterar

- `LoginDto`, `main.ts`, o seed, o front e qualquer arquivo fora da lista.
