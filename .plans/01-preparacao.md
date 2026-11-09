# 01 — Preparação do ambiente

## Objetivo
Ter o projeto versionado, compilando e com um bot real criado.

## Passos (agy)
1. Na raiz, criar/ajustar `.gitignore` para conter: `node_modules/`, `dist/`, `.env`, `infra/backup/backups/*` (manter `infra/backup/backups/.gitkeep`), `*.log`.
2. Criar `infra/backup/backups/.gitkeep` se não existir.
3. `git init` na raiz (NÃO fazer commit — o Opus revisa e faz).
4. Em `backend/`: `npm install` e `npm run build`. Em `frontend/`: `npm install` e `npm run build`. Registrar erros em `.plans/01-contexto.md` (não corrigir nada).

## Passos (usuário, manual)
1. No Telegram, falar com `@BotFather` → `/newbot` → escolher nome e username (termina em `bot`).
2. Guardar o token. Colocar no `.env` da raiz: `TELEGRAM_BOT_TOKEN=...` e `TELEGRAM_BOT_USERNAME=<username sem @>`.
3. Nunca colar o token em chat, commit ou README.

## Critérios de aceite
- `git status` funciona e não lista `.env`, `dist/`, `node_modules/`.
- Builds do backend e frontend passam (ou erros documentados em `01-contexto.md`).

## NÃO alterar
- Nenhum arquivo em `src/`. Não ler nem imprimir o conteúdo de `.env`.
