# 31 — Tailwind compilado no lugar do CDN (roteiro 2.4, item A9)

## Objetivo
Tirar `<script src="https://cdn.tailwindcss.com">` do `index.html` e compilar o Tailwind no build do Vite (PostCSS),
levando junto a configuração (`brand`, fonte Figtree) e os estilos do `<style>` do `index.html`.
**Sem nenhuma mudança visual.** `tailwindcss@3`, `postcss` e `autoprefixer` já estão instalados.
Não execute comandos de terminal. Use só ferramentas de arquivo.

## Arquivos (somente estes)
- Criar: `frontend/tailwind.config.js`, `frontend/postcss.config.js`, `frontend/src/index.css`
- Editar: `frontend/index.html`, `frontend/src/main.tsx`, `frontend/eslint.config.js` (só se precisar ignorar os dois `.config.js`)

## Passos
1. `frontend/tailwind.config.js` (ESM, o package é `"type": "module"`):
```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Figtree', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#F0FDFA',
          600: '#0D9488',
          700: '#0F766E',
          800: '#115E59',
        },
      },
    },
  },
  plugins: [],
};
```
2. `frontend/postcss.config.js`:
```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```
3. `frontend/src/index.css`: as três diretivas `@tailwind base;`, `@tailwind components;`, `@tailwind utilities;`
   seguidas, sem alteração, de todo o conteúdo do `<style>` que hoje está no `index.html`
   (`::selection`, `html`, `*`, `.tabular-nums`).
4. `frontend/src/main.tsx`: acrescentar `import './index.css';` logo depois dos imports existentes.
5. `frontend/index.html`: remover o `<script src="https://cdn.tailwindcss.com"></script>`, o `<script>` com `tailwind.config = ...`
   e o bloco `<style>...</style>`. Manter os `<link>` do Google Fonts, `<title>`, `<meta>` e o `<body class="...">` exatamente como estão.

## Critérios de aceite
- `npm run build` e `npm run lint` (0 erros).
- O CSS gerado em `dist/assets/*.css` existe e contém `.bg-brand-700`.
- Comparação pixel a pixel com a versão anterior, nas três contas, sem diferenças de layout (o revisor faz).

## O que NÃO alterar
- Nenhum arquivo em `src/pages`, `src/components`, `src/hooks`, `src/lib`, `App.tsx`, `api.ts`.
- `package.json`, `vite.config.ts`, backend.
