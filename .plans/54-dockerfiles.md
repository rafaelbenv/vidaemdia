# 54 — Dockerfiles mais seguros e enxutos (roteiro 7.8, item S11)

## Objetivo
`npm ci` (instalação reprodutível pelo lockfile), usuário sem privilégio, só dependências de produção na imagem final, healthcheck no backend e no front.

## Já feito pelo orquestrador
- `prisma` (CLI) movido para `dependencies` no `backend/package.json` — o `prisma/migrate.sh` usa o CLI ao subir.

Não execute comandos de terminal. Use só ferramentas de arquivo.

## Arquivos
- Editar: `backend/Dockerfile`, `frontend/Dockerfile`, `infra/nginx/nginx.conf` (só a porta do `listen`), `docker-compose.yml`, `README.md` (comando do seed),
  `backend/package.json` (só `scripts` e a chave `prisma.seed`)
- Criar: `backend/tsconfig.seed.json`

## Passos

### 1. Seed compilado (para rodar sem `ts-node` na imagem de produção)
- `backend/tsconfig.seed.json`:
  ```json
  { "extends": "./tsconfig.json", "compilerOptions": { "outDir": "./dist-seed", "rootDir": "./prisma", "declaration": false, "incremental": false, "sourceMap": false },
    "include": ["prisma/seed.ts"] }
  ```
- `package.json` scripts: `"build:seed": "tsc -p tsconfig.seed.json"`, `"prisma:seed:prod": "node dist-seed/seed.js"`. Manter `"prisma:seed"` (ts-node, para dev) e a chave `prisma.seed` como está.
- Acrescentar `dist-seed` ao `backend/.dockerignore` e ao `.gitignore` da raiz (linha `backend/dist-seed/`).

### 2. `backend/Dockerfile`
```dockerfile
FROM node:20-alpine AS builder
RUN apk add --no-cache openssl
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci
RUN npx prisma generate
COPY . .
RUN npm run build && npm run build:seed

FROM node:20-alpine AS deps
RUN apk add --no-cache openssl
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci --omit=dev && npx prisma generate && npm cache clean --force

FROM node:20-alpine AS runner
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/package*.json ./
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/dist-seed ./dist-seed
COPY --from=builder --chown=node:node /app/prisma ./prisma
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health >/dev/null || exit 1
CMD ["sh", "-c", "sh prisma/migrate.sh && node dist/src/main"]
```
(O `npx prisma` no `migrate.sh` usa o CLI instalado em `node_modules`, sem baixar nada.)

### 3. `frontend/Dockerfile` e nginx sem root
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.27-alpine AS runner
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/ >/dev/null || exit 1
```
- `infra/nginx/nginx.conf`: `listen 80;` → `listen 8080;` (a imagem sem root não pode usar portas abaixo de 1024).
- `docker-compose.yml`: `frontend.ports` → `"8080:8080"`. O volume do `nginx.conf` continua em `/etc/nginx/conf.d/default.conf`.

### 4. `docker-compose.yml` — limpeza
- Remover a linha `version: '3.9'` (obsoleta; o Docker avisa a cada comando).
- `frontend.depends_on.backend`: `condition: service_healthy` (agora o backend tem healthcheck). Manter `grafana` como está.

### 5. `README.md`
Trocar o comando do seed no Docker por `docker exec vidaemdia-backend npm run prisma:seed:prod`. Citar que os containers do backend e do front rodam sem root e têm healthcheck (`docker compose ps` mostra "healthy").

## Critérios de aceite (o revisor confere)
- `docker compose up -d --build`: backend e front ficam `healthy`; app em `http://localhost:8080` funciona.
- `docker exec vidaemdia-backend whoami` → `node`; o front roda como usuário `nginx` (não root).
- A imagem do backend não tem `typescript`, `jest` nem `ts-node` em `node_modules`.
- `docker exec vidaemdia-backend npm run prisma:seed:prod` roda o seed (idempotente).

## O que NÃO alterar
- Código-fonte do backend e do front, `migrate.sh`, migrations, Grafana/Prometheus.
