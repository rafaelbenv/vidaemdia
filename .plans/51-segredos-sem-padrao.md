# 51 — Segredos sem valor padrão (roteiro 7.4, item S3)

## Problema
O `JWT_SECRET` tem um valor padrão no código (`auth.module.ts`, `jwt.strategy.ts`) e no `docker-compose.yml`; as senhas do Postgres e do Grafana
também têm padrão no compose. Esses padrões são públicos no repositório: quem os conhece forja tokens e entra no banco/Grafana.

## Decisões (orquestrador, 2026-11-12)
- Sem a variável → o sistema **não sobe**, com mensagem clara.
- `JWT_SECRET` com menos de 32 caracteres → não sobe.
- `JWT_SECRET` igual ao exemplo público antigo (`vidaemdia_jwt_super_secret_key_2026`) → sobe, mas registra um **aviso** no log (o `.env` local do usuário ainda usa esse valor; trocar só invalida as sessões abertas).
- Senhas do Postgres e do Grafana: obrigatórias no `.env`, sem padrão. (Trocar a senha do Postgres no `.env` não muda a senha de um volume já criado; o README explica.)

Não execute comandos de terminal. Use só ferramentas de arquivo.

## Arquivos
- Criar: `backend/src/config/jwt-secret.ts`, `backend/src/config/jwt-secret.spec.ts`
- Editar: `backend/src/auth/auth.module.ts`, `backend/src/auth/jwt.strategy.ts`, `backend/src/main.ts`, `docker-compose.yml`, `.env.example`, `README.md`

## Passos
1. `config/jwt-secret.ts`:
   ```ts
   export const PUBLIC_EXAMPLE_JWT_SECRET = 'vidaemdia_jwt_super_secret_key_2026';
   export function getJwtSecret(env: NodeJS.ProcessEnv = process.env): string {
     const s = env.JWT_SECRET;
     if (!s) throw new Error('JWT_SECRET não definido. Defina no .env (ex.: gere com "openssl rand -hex 32").');
     if (s.length < 32) throw new Error('JWT_SECRET muito curto: use pelo menos 32 caracteres.');
     return s;
   }
   export function isPublicExampleSecret(env: NodeJS.ProcessEnv = process.env): boolean {
     return env.JWT_SECRET === PUBLIC_EXAMPLE_JWT_SECRET;
   }
   ```
2. `auth.module.ts` e `jwt.strategy.ts`: usar `getJwtSecret()` no lugar de `process.env.JWT_SECRET || '...'`. Remover o valor padrão literal do código.
3. `main.ts`: logo no começo do `bootstrap()`, chamar `getJwtSecret()` (falha cedo com a mensagem) e, se `isPublicExampleSecret()`,
   `Logger.warn('JWT_SECRET igual ao valor de exemplo público. Troque no .env (openssl rand -hex 32); as sessões abertas serão encerradas.', 'Segurança')`.
4. `docker-compose.yml` — trocar os padrões por variáveis obrigatórias (sintaxe `${VAR:?mensagem}`):
   - `POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?Defina POSTGRES_PASSWORD no .env}` (no serviço do Postgres, no `DATABASE_URL` do backend e no `PGPASSWORD` do backup);
   - `JWT_SECRET: ${JWT_SECRET:?Defina JWT_SECRET no .env}`;
   - `GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_ADMIN_PASSWORD:?Defina GRAFANA_ADMIN_PASSWORD no .env}`.
   Usuário, nome do banco e usuário do Grafana podem manter o padrão.
5. `.env.example`: trocar os valores desses três por marcadores que não funcionam como senha real, com um comentário acima de cada:
   `POSTGRES_PASSWORD=troque-esta-senha`, `JWT_SECRET=gere-com-openssl-rand-hex-32`, `GRAFANA_ADMIN_PASSWORD=troque-esta-senha`
   (e o `DATABASE_URL` de exemplo usando `troque-esta-senha`). Comentário: "Obrigatório. Gere com: openssl rand -hex 32".
6. `README.md`, na parte de configuração: os três segredos são obrigatórios; como gerar; aviso de que a senha do Postgres só vale na criação do volume
   (para trocar num banco existente: `ALTER USER <usuario> WITH PASSWORD '...'` antes de mudar o `.env`); o CI não precisa desses segredos (os testes não usam banco).
7. Testes em `jwt-secret.spec.ts`: sem variável → lança; curta → lança; válida → devolve; `isPublicExampleSecret` reconhece o valor antigo.

## Critérios de aceite
- Build, lint (0 erros) e testes no backend.
- Com o `.env` atual, o sistema sobe e o log do backend mostra o aviso do segredo de exemplo.
- `docker compose config` sem `JWT_SECRET` no ambiente falha com a mensagem "Defina JWT_SECRET no .env".

## O que NÃO alterar
- O arquivo `.env` (é local do usuário), frontend, schema.
