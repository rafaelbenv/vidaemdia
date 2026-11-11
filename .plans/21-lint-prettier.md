# 21 — ESLint + Prettier no front e no backend (roteiro passo 0.3, item E4)

## Objetivo
Ter `npm run lint` funcionando em `frontend/` e em `backend/`, terminando com **zero erros**
(avisos são permitidos), e `npm run format` / `npm run format:check` com Prettier.
Não reformatar o código existente agora (isso geraria um diff enorme antes da refatoração do passo 2.1).

As dependências JÁ ESTÃO INSTALADAS (não rode npm, não rode nenhum comando de terminal).
Use apenas suas ferramentas de ler, criar e editar arquivos.

## Arquivos a criar/editar (somente estes)
1. `frontend/eslint.config.js` (novo)
2. `frontend/.prettierrc.json` (novo)
3. `frontend/.prettierignore` (novo)
4. `frontend/package.json` (só a seção `scripts`)
5. `backend/eslint.config.mjs` (novo)
6. `backend/.prettierrc.json` (novo)
7. `backend/.prettierignore` (novo)
8. `backend/package.json` (só a seção `scripts`)

## Passos exatos

### Front
`frontend/eslint.config.js` (ESM, o package já é `"type": "module"`), formato flat config:
```js
import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['dist', 'node_modules'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended, prettier],
    files: ['**/*.{ts,tsx}'],
    languageOptions: { ecmaVersion: 2020, globals: globals.browser },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
);
```
`frontend/.prettierrc.json`: `{ "singleQuote": true, "semi": true, "trailingComma": "all", "printWidth": 100 }`
`frontend/.prettierignore`: linhas `dist`, `node_modules`, `package-lock.json`.
Scripts a acrescentar em `frontend/package.json` (mantendo os existentes):
- `"lint": "eslint ."`
- `"format": "prettier --write \"src/**/*.{ts,tsx,css}\""`
- `"format:check": "prettier --check \"src/**/*.{ts,tsx,css}\""`

### Backend
`backend/eslint.config.mjs`:
```js
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'coverage', 'eslint.config.mjs', 'jest.config.js'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended, prettier],
    files: ['**/*.ts'],
    languageOptions: { ecmaVersion: 2021, sourceType: 'module', globals: { ...globals.node, ...globals.jest } },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-require-imports': 'warn',
    },
  },
);
```
`backend/.prettierrc.json`: `{ "singleQuote": true, "trailingComma": "all", "printWidth": 100 }`
`backend/.prettierignore`: linhas `dist`, `node_modules`, `coverage`, `package-lock.json`.
Scripts em `backend/package.json`:
- `"lint": "eslint \"{src,prisma}/**/*.ts\""`
- substituir o `format` atual por `"format": "prettier --write \"src/**/*.ts\" \"prisma/**/*.ts\""`
- `"format:check": "prettier --check \"src/**/*.ts\" \"prisma/**/*.ts\""`

## Critérios de aceite (o revisor confere)
- `npm run lint` em `frontend/` e em `backend/` termina com 0 erros.
- `npm run build` continua passando nos dois; `npm test` do backend continua passando.
- Nenhum arquivo `.ts`/`.tsx` de código-fonte foi alterado.

## O que NÃO alterar
- Nenhum arquivo em `src/`, `prisma/`, `index.html`, tsconfig, vite.config, Dockerfile.
- Dependências do package.json (já instaladas). Só a seção `scripts`.
- Não executar comandos de terminal.
