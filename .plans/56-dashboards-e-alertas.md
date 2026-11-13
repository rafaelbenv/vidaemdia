# 56 — Dashboard do Grafana provisionado e alertas no Prometheus (roteiro 7.10, item S12)

## Situação
- Grafana em `http://localhost:8080/grafana/` com a fonte de dados Prometheus provisionada (sem `uid` fixo), mas **nenhum dashboard**.
- Prometheus coleta `backend:3000/metrics` (job `vidaemdia-backend`), sem regras de alerta.
- Métricas do backend (todas `counter`, exceto a última):
  `vidaemdia_appointments_created_total{source}`, `vidaemdia_reminders_sent_total{channel}`, `vidaemdia_reminders_failed_total`,
  `vidaemdia_telegram_updates_received_total`, `vidaemdia_telegram_api_errors_total`, `vidaemdia_rbac_access_denied_total`,
  `vidaemdia_auth_failures_total`, `vidaemdia_uptime_seconds` (gauge). Também existe `up{job="vidaemdia-backend"}`.
- Não há Alertmanager: os alertas ficam visíveis no próprio dashboard (painel com a série `ALERTS`).

Não execute comandos de terminal. Use só ferramentas de arquivo.

## Arquivos
- Editar: `infra/monitoring/grafana/provisioning/datasources/datasource.yml` (acrescentar `uid: prometheus`), `infra/monitoring/prometheus.yml`,
  `docker-compose.yml` (volume das regras no Prometheus), `.github/workflows/ci.yml` (job de validação), `README.md`
- Criar: `infra/monitoring/alerts.yml`, `infra/monitoring/grafana/provisioning/dashboards/dashboards.yml`,
  `infra/monitoring/grafana/provisioning/dashboards/vidaemdia.json`

## Passos

### 1. Fonte de dados com `uid` fixo
Em `datasource.yml`, acrescentar `uid: prometheus` (o dashboard referencia esse uid).

### 2. Regras de alerta (`infra/monitoring/alerts.yml`)
Grupo `vidaemdia`, cada regra com `labels.severity` (`critical` ou `warning`) e `annotations.summary`/`description` em português:
| Nome | Expressão | `for` | Severidade | Resumo |
|------|-----------|-------|------------|--------|
| `BackendFora` | `up{job="vidaemdia-backend"} == 0` | `1m` | critical | "O backend não responde às coletas do Prometheus" |
| `BackendReiniciado` | `vidaemdia_uptime_seconds < 120` | `0m` | warning | "O backend reiniciou há menos de 2 minutos" |
| `LembretesFalhando` | `increase(vidaemdia_reminders_failed_total[15m]) > 5` | `0m` | warning | "Mais de 5 falhas de envio de lembrete em 15 minutos" |
| `ErrosApiTelegram` | `increase(vidaemdia_telegram_api_errors_total[15m]) > 5` | `0m` | warning | "Erros repetidos na API do Telegram" |
| `MuitosAcessosNegados` | `increase(vidaemdia_rbac_access_denied_total[10m]) > 10` | `0m` | warning | "Muitas tentativas de acesso a agendas sem permissão" |
| `PossivelForcaBrutaLogin` | `increase(vidaemdia_auth_failures_total[5m]) > 20` | `0m` | critical | "Muitas falhas de login em 5 minutos" |

`prometheus.yml`: acrescentar `rule_files: ['/etc/prometheus/alerts.yml']`.
`docker-compose.yml` (serviço `prometheus`): montar `./infra/monitoring/alerts.yml:/etc/prometheus/alerts.yml:ro`.

### 3. Provisionamento do dashboard
`dashboards/dashboards.yml`:
```yaml
apiVersion: 1
providers:
  - name: vidaemdia
    folder: VidaEmDia
    type: file
    disableDeletion: true
    allowUiUpdates: false
    options:
      path: /etc/grafana/provisioning/dashboards
      foldersFromFilesStructure: false
```
`dashboards/vidaemdia.json` — dashboard "VidaEmDia — Visão geral" (`uid: vidaemdia-visao-geral`, `schemaVersion: 39`, `refresh: "30s"`,
`time: { from: "now-6h", to: "now" }`, `timezone: "browser"`), todos os painéis com `datasource: { type: "prometheus", uid: "prometheus" }`. Painéis, em linhas:
1. **Linha "Saúde"** — `stat` "Backend no ar" (`up{job="vidaemdia-backend"}`, mapeamento 1 → "No ar" verde, 0 → "Fora" vermelho);
   `stat` "Tempo no ar" (`vidaemdia_uptime_seconds`, unidade `s`); `table` "Alertas disparados" (`ALERTS{alertstate="firing"}`, formato tabela, colunas alertname, severity).
2. **Linha "Uso"** — `timeseries` "Compromissos criados por origem" (`sum by (source) (increase(vidaemdia_appointments_created_total[$__rate_interval]))`);
   `stat` "Compromissos criados (período)" (`sum(increase(vidaemdia_appointments_created_total[$__range]))`).
3. **Linha "Lembretes"** — `timeseries` "Lembretes enviados x falhas" (duas consultas: `sum(increase(vidaemdia_reminders_sent_total[$__rate_interval]))` legenda "Enviados",
   `sum(increase(vidaemdia_reminders_failed_total[$__rate_interval]))` legenda "Falhas"); `stat` "Taxa de falha (período)"
   (`sum(increase(vidaemdia_reminders_failed_total[$__range])) / clamp_min(sum(increase(vidaemdia_reminders_sent_total[$__range])) + sum(increase(vidaemdia_reminders_failed_total[$__range])), 1)`, unidade `percentunit`).
4. **Linha "Telegram"** — `timeseries` "Mensagens recebidas do Telegram" e "Erros na API do Telegram" (increase com `$__rate_interval`).
5. **Linha "Segurança"** — `timeseries` "Acessos negados (403)" e "Falhas de login" (increase com `$__rate_interval`).
Use `gridPos` coerentes (24 colunas; `stat` com largura 6–8, `timeseries` com 12), títulos e descrições em português.

### 4. Validação no CI
Novo job `monitoring` em `ci.yml` (`runs-on: ubuntu-latest`, sem `needs`):
```yaml
steps:
  - uses: actions/checkout@v4
  - name: Validar configuração e regras do Prometheus
    run: |
      docker run --rm -v "$PWD/infra/monitoring:/cfg" --entrypoint promtool prom/prometheus:v2.53.0 check rules /cfg/alerts.yml
  - name: Validar JSON do dashboard
    run: python3 -c "import json; json.load(open('infra/monitoring/grafana/provisioning/dashboards/vidaemdia.json')); print('dashboard ok')"
```

### 5. `README.md`
Na parte de monitoramento: o dashboard "VidaEmDia — Visão geral" (pasta VidaEmDia no Grafana), a lista de alertas com uma linha cada, e que os alertas aparecem no painel "Alertas disparados".

## Critérios de aceite (o revisor confere com o sistema no ar)
- Grafana mostra o dashboard na pasta VidaEmDia, com dados nos painéis.
- A API do Prometheus (pelo proxy do Grafana) lista as 6 regras carregadas.
- CI: job `monitoring` passa.

## O que NÃO alterar
- Backend, frontend, nginx.
