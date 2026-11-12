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
