# 48 — Migrations versionadas do Prisma (roteiro 7.1, item S8)

## Objetivo
Trocar o `prisma db push --accept-data-loss` da subida do backend por migrations versionadas (`prisma migrate deploy`),
sem perder os dados do banco que já existe.

## Já feito pelo orquestrador
- `backend/prisma/migrations/0_init/migration.sql` gerado do `schema.prisma` atual (`prisma migrate diff --from-empty`), 7 tabelas e 5 enums.
- `backend/prisma/migrations/migration_lock.toml` (`provider = "postgresql"`).
- Conferido: o banco atual é idêntico ao schema (`prisma migrate diff --from-url ... --exit-code` = 0). Então marcar `0_init` como aplicada é seguro.

Não execute comandos de terminal. Use só ferramentas de arquivo.

## Arquivos
- Criar: `backend/prisma/migrate.sh`
- Editar: `backend/Dockerfile` (só a linha `CMD`), `backend/package.json` (só `scripts`), `README.md` (seção sobre banco/migrations)

## Passos

### 1. `backend/prisma/migrate.sh` (POSIX `sh`, fim de linha LF)
```sh
#!/bin/sh
# Aplica as migrations pendentes. Num banco criado antes das migrations (por "db push"),
# o Prisma recusa com P3005 (schema não vazio): nesse caso marca a 0_init como aplicada e tenta de novo.
set -e
if out=$(npx prisma migrate deploy 2>&1); then
  echo "$out"
  exit 0
fi
echo "$out"
if echo "$out" | grep -q "P3005"; then
  echo "Banco existente sem histórico de migrations: marcando 0_init como aplicada."
  npx prisma migrate resolve --applied 0_init
  npx prisma migrate deploy
else
  exit 1
fi
```

### 2. `backend/Dockerfile`
Trocar `CMD ["sh", "-c", "npx prisma db push --accept-data-loss && npm run start:prod"]` por
`CMD ["sh", "-c", "sh prisma/migrate.sh && npm run start:prod"]`. Nada mais muda.

### 3. `backend/package.json` (scripts)
- `"prisma:migrate": "prisma migrate deploy"` (já existe; manter).
- Acrescentar `"prisma:migrate:dev": "prisma migrate dev"` e `"prisma:migrate:status": "prisma migrate status"`.
- Remover o script `"prisma:push"`.

### 4. `README.md`
Na parte que fala de banco/Prisma (ou criar uma seção "Banco de dados e migrations"), explicar em poucas linhas:
- A estrutura do banco é versionada em `backend/prisma/migrations/`; o backend aplica as pendentes ao subir (`prisma/migrate.sh`).
- Para mudar o banco: editar `schema.prisma` e rodar `npm run prisma:migrate:dev -- --name <nome>` com o Postgres local no ar; commitar a pasta da migration gerada.
- Bancos criados antes desta mudança são adotados automaticamente (a `0_init` é marcada como aplicada na primeira subida).
- Não usar mais `prisma db push` (apaga dados quando há mudança destrutiva).
Remover do README qualquer instrução que mande usar `db push`.

## Critérios de aceite (o revisor confere com o sistema no ar)
- Reconstruir e subir o backend sobre o banco existente: o log mostra a adoção da `0_init` e o backend sobe; os dados continuam (login e compromissos).
- Subir de novo: `migrate deploy` diz que não há migrations pendentes.
- Banco vazio (container novo): `0_init` é aplicada do zero.

## O que NÃO alterar
- `schema.prisma`, `seed.ts`, `0_init/migration.sql`, `docker-compose.yml`, código do backend, frontend.
