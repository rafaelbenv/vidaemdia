# 09 — Seed idempotente

## Objetivo
Rodar `npx prisma db seed` várias vezes sem duplicar agendas, compromissos e lembretes, e sem apagar o vínculo real com o Telegram.

## Problema encontrado no teste da etapa 08
`prisma/seed.ts` usa `calendar.create` e `appointment.create`. Cada execução criou outra "Agenda Pessoal - Carlos" (4 cópias). O bot lê a agenda mais antiga (vazia) e o worker envia lembretes das cópias.

## Arquivo
- SOMENTE `backend/prisma/seed.ts`

## Passos
1. Logo após os 4 `user.upsert`, apagar os dados de demonstração antigos desses 4 usuários:
   `await prisma.calendar.deleteMany({ where: { ownerId: { in: [userCarlos.id, drJoao.id, draAna.id, secMaria.id] } } });`
   (o cascade do schema remove permissões, compromissos e lembretes dessas agendas). Não apagar usuários nem audit logs.
2. Nos 4 `user.upsert`: o bloco `update` NÃO pode alterar `telegramChatId` (para não desfazer um vínculo real). Manter no `update` apenas campos que não sejam `telegramChatId`; se o `update` hoje repete o `create`, removê-lo de lá.
3. No `create` dos usuários: `telegramChatId: null` para todos, inclusive Carlos (o id fictício `100001111` confunde no modo real).
4. Manter o resto do seed igual (mesmas agendas, permissões, compromissos e textos).
5. Adicionar no log final: "Seed idempotente: dados de demonstração recriados".

## Critérios de aceite
- `npm run build` passa (o seed não entra no build, mas não pode quebrar tipos).
- `DATABASE_URL="postgresql://u:p@localhost:5432/db" npx tsc --noEmit -p tsconfig.json` sem erros em `prisma/seed.ts` (se o tsconfig não incluir `prisma/`, rodar `npx tsc --noEmit prisma/seed.ts --esModuleInterop --skipLibCheck`).

## NÃO alterar
- Qualquer outro arquivo. Não rodar o seed (não há banco local; o Opus roda no Docker).
