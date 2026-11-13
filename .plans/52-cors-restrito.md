# 52 — CORS restrito à origem configurada (roteiro 7.5, item S5)

## Problema
`main.ts` usa `origin: process.env.CORS_ORIGIN || '*'` e o `docker-compose.yml` não repassa `CORS_ORIGIN` ao backend: no Docker, qualquer site pode chamar a API.
Desde o passo 2.3 o front chama `/api` no mesmo endereço (nginx no Docker, proxy do Vite no dev), então o CORS nem é necessário no uso normal.

Não execute comandos de terminal. Use só ferramentas de arquivo.

## Arquivos
- Editar: `backend/src/main.ts`, `docker-compose.yml`, `.env.example`, `README.md`
- Criar: `backend/src/config/cors.ts`, `backend/src/config/cors.spec.ts`

## Passos
1. `config/cors.ts`:
   ```ts
   export function parseCorsOrigins(value: string | undefined): string[] {
     return (value ?? '').split(',').map((s) => s.trim()).filter((s) => s.length > 0 && s !== '*');
   }
   ```
   (Um `*` na lista é ignorado de propósito: não existe mais "qualquer origem".)
2. `main.ts`: `const origins = parseCorsOrigins(process.env.CORS_ORIGIN);`
   - lista vazia → **não** chamar `enableCors` (só mesma origem) e `Logger.log('CORS desligado: só o próprio endereço chama a API.', 'Segurança')`;
   - senão → `app.enableCors({ origin: origins, credentials: true })` e logar as origens permitidas.
3. `docker-compose.yml` (serviço `backend`, `environment`): `CORS_ORIGIN: ${CORS_ORIGIN:-}` (vazio por padrão).
4. `.env.example`: `CORS_ORIGIN=""` com o comentário: "Opcional. Só preencha se o front rodar em outro endereço que não passe pelo /api (ex.: http://localhost:5173). Vários: separados por vírgula."
5. `README.md`: uma linha na parte de configuração explicando o mesmo.
6. Testes de `parseCorsOrigins`: vazio/indefinido → `[]`; `"a, b"` → `['a','b']`; `"*"` → `[]`.

## Critérios de aceite
- Build, lint (0 erros) e testes no backend.
- Com o sistema no ar: `curl -H "Origin: https://site-qualquer.com" -I http://localhost:3000/health` **não** devolve `Access-Control-Allow-Origin`;
  o front em http://localhost:8080 continua funcionando (login e agenda).

## O que NÃO alterar
- Frontend, nginx, `.env` local.
