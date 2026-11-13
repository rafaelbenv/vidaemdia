# 53 — Só o nginx publicado; sem HTTPS falso (roteiro 7.6 e 7.7, itens S7 e S13)

## Decisões (2026-11-12)
- **7.7 (usuário):** remover a porta 443 e o cabeçalho HSTS (só HTTP em `localhost:8080`).
- **7.6 (usuário delegou):** Grafana acessível por `http://localhost:8080/grafana/` (atrás do nginx, com o login do próprio Grafana);
  Prometheus só na rede interna (o Grafana já lê os dados dele).
- **7.6 (orquestrador):** Postgres e backend deixam de ficar abertos na rede, mas continuam acessíveis **só pela própria máquina**
  (`127.0.0.1`), porque o desenvolvimento usa: o proxy do Vite chama `localhost:3000` e as migrations são geradas contra `localhost:5432`.

Não execute comandos de terminal. Use só ferramentas de arquivo.

## Arquivos
- Editar: `docker-compose.yml`, `infra/nginx/nginx.conf`, `frontend/Dockerfile` (só o `EXPOSE`), `README.md`, `.env.example`,
  `frontend/src/pages/SaudePage.tsx` (um link)

## Passos

### 1. `docker-compose.yml`
- `postgres.ports`: `"127.0.0.1:${POSTGRES_PORT:-5432}:5432"`.
- `backend.ports`: `"127.0.0.1:3000:3000"`.
- `frontend.ports`: só `"8080:80"` (remover `"8443:443"`). Acrescentar `grafana` em `depends_on` do frontend.
- `prometheus`: remover `ports`.
- `grafana`: remover `ports`; acrescentar em `environment`:
  `GF_SERVER_ROOT_URL: ${GRAFANA_ROOT_URL:-http://localhost:8080/grafana/}` e `GF_SERVER_SERVE_FROM_SUB_PATH: "true"`.

### 2. `infra/nginx/nginx.conf`
- Remover a linha `add_header Strict-Transport-Security ...`.
- Acrescentar, dentro do `server`, antes de `location /`:
  ```nginx
  # Resolve o nome do container na hora (o nginx sobe mesmo se o Grafana ainda não estiver no ar)
  resolver 127.0.0.11 valid=30s ipv6=off;

  # Grafana (monitoramento) em /grafana/, com o login do próprio Grafana
  location /grafana/ {
      set $grafana_upstream http://grafana:3000;
      proxy_pass $grafana_upstream;
      proxy_http_version 1.1;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto $scheme;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection $http_connection;
  }
  ```
  (Com `proxy_pass` usando variável, o caminho `/grafana/...` é repassado inteiro, que é o que o Grafana espera com `serve_from_sub_path`.)

### 3. `frontend/Dockerfile`
`EXPOSE 80 443` → `EXPOSE 80`.

### 4. Bastidores
Na `SaudePage`, ao lado do botão "Abrir /metrics (Prometheus)", um link no mesmo estilo "Abrir Grafana" para `/grafana/` (`target="_blank" rel="noreferrer"`).

### 5. Documentação
- `README.md`: tabela/lista de endereços: app `http://localhost:8080`, Grafana `http://localhost:8080/grafana/`, API e Swagger `http://localhost:3000` (só nesta máquina),
  Postgres `localhost:5432` (só nesta máquina), Prometheus só interno. Remover menções a `:9090`, `:3001`, `8443`/HTTPS e HSTS como ativos.
- `.env.example`: comentário sobre `GRAFANA_ROOT_URL` (opcional; padrão `http://localhost:8080/grafana/`).

## Critérios de aceite (o revisor confere com o sistema no ar)
- `docker compose up -d`: app em `:8080` funciona; `http://localhost:8080/grafana/` abre o login do Grafana; `:9090` e `:3001` não respondem; `:8443` não responde.
- Resposta do nginx sem `Strict-Transport-Security`.
- Bastidores > Saúde tem o link "Abrir Grafana".

## O que NÃO alterar
- `prometheus.yml`, provisionamento do Grafana, backend, Dockerfile do backend.
