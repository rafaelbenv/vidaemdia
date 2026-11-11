# 22 — CI mínimo no GitHub Actions (roteiro passo 0.4, item S10 parte 1)

## Objetivo
A cada push e pull request na `main`, rodar: lint + build do front; lint + build + testes do backend.

Não execute comandos de terminal. Use só ferramentas de arquivo.

## Arquivo a criar (somente este)
- `.github/workflows/ci.yml`

## Conteúdo exato
```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  frontend:
    name: Front (lint e build)
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: frontend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: frontend/package-lock.json
      - run: npm ci
      - run: npm run lint
      - run: npm run build

  backend:
    name: Backend (lint, build e testes)
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: backend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: backend/package-lock.json
      - run: npm ci
      - run: npx prisma generate
      - run: npm run lint
      - run: npm run build
      - run: npm test
```

## Critérios de aceite
- O arquivo existe exatamente com o conteúdo acima (YAML válido, indentação de 2 espaços).

## O que NÃO alterar
- Nenhum outro arquivo do repositório.
