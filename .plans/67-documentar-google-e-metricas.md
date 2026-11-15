# 67 — Documentar no README a sincronização com o Google, as métricas e o fuso horário

## Objetivo

O README explica só como criar as credenciais do Google (seção 3.6). Faltam:
- como a sincronização funciona nos dois sentidos (roteiro 8.3 a 8.6);
- as métricas e os alertas novos do 8.7 (plano 66);
- a nota de fuso horário que o roteiro pediu (item C13 do plano 20): o sistema assume o fuso de São Paulo.

Público: quem vai avaliar ou rodar o projeto (professor, colegas). Texto em português, direto, sem marketing.

## Fontes (ler antes de escrever, NÃO alterar)

- `.plans/60-google-envio-vidaemdia-para-google.md`, `.plans/62-google-recebe-do-google.md`, `.plans/63-dia-inteiro.md`, `.plans/64-google-regras.md`, `.plans/65-front-marcas-google.md`, `.plans/66-google-testes-e-metricas.md`
- `backend/src/google/google.controller.ts` (rotas), `backend/src/google/google-sync.worker.ts` e `backend/src/google/google-pull.service.ts` (crons e regras)
- `backend/src/monitoring/metrics.service.ts`, `infra/monitoring/alerts.yml`

Escrever só o que está no código. Se um plano e o código divergirem, vale o código.

## Arquivo envolvido (só este)

- `README.md`

## Passos

1. Na seção `## 3.6. Google Agenda (Opcional)`, depois do aviso de expiração do modo de teste e antes do `---`, acrescentar a subseção `### Como funciona a sincronização`, com:
   - Como ligar: o dono conecta a conta Google e escolhe uma agenda do Google para cada agenda do VidaEmDia (só o dono pode).
   - **VidaEmDia → Google:** criar, alterar e cancelar geram um job na fila (`GoogleSyncJob`); o worker roda a cada minuto (`GOOGLE_SYNC_CRON_EXPRESSION`), tenta de novo com espera crescente e desiste após 5 tentativas; conexão expirada ou sem conta falha na hora. Conferir no código os intervalos de espera.
   - **Google → VidaEmDia:** a cada minuto (`GOOGLE_PULL_CRON_EXPRESSION`); primeira carga e depois incremental com `syncToken`; se o Google responder 410, recomeça do zero; o eco das próprias alterações é ignorado pelo `etag`; botão/rota `POST /agendas/:id/google/sincronizar` força uma rodada.
   - **Regras:** conflito de horário é sinalizado e não recusado; dia inteiro (lembrete às 8h); privacidade (quem não é dono vê "Ocupado"); convites recusados não entram; última alteração vence. Confirmar cada uma no plano 64 e no código.
   - Uma tabela curta com as rotas do `google.controller.ts` (método, caminho, para que serve).
   - Onde ver os erros: a agenda e o compromisso mostram a mensagem de erro da sincronização (campos `googleSyncError`), e as marcas da tela (plano 65).
   - Testes: os clients do Google são testados com `fetch` simulado (`google-calendar.client.spec.ts`, `google-oauth.client.spec.ts`); nenhum teste acessa o Google.
2. Na seção `## 8. Monitoramento e Alertas`, na lista de regras de alerta, acrescentar no mesmo formato:
   - **`GoogleSyncFalhando`** (`warning`): mais de 5 erros de sincronização com o Google em 15 minutos.
   - **`FilaGoogleAcumulando`** (`warning`): mais de 20 envios pendentes para o Google por mais de 10 minutos.
3. Ainda na seção 8, depois da lista de alertas, acrescentar `### Métricas expostas em /metrics`: uma tabela com nome, tipo e significado de cada métrica de `metrics.service.ts` (todas, não só as do Google), incluindo os rótulos `direction` (`envio`/`recebimento`) e `result` (`ok`/`erro`) de `vidaemdia_google_sync_total`, `vidaemdia_google_sync_queue{status}` e `vidaemdia_google_last_pull_timestamp_seconds`. Mencionar a linha "Google Agenda" do dashboard (sincronizações por sentido, fila, última sincronização recebida).
4. Na seção `## 1. Arquitetura e Fluxos Implementados`, no fim, acrescentar uma linha em destaque (`>`) dizendo que o sistema assume o fuso de São Paulo (`America/Sao_Paulo`) para horários e lembretes, e que outros fusos estão fora desta versão.

## Critérios de aceite

- Só o `README.md` muda; o restante do README fica igual.
- Nenhuma informação inventada: cada rota, nome de variável, métrica e número confere com o código.
- Markdown válido (tabelas com cabeçalho e separador).

## O que NÃO alterar

- Código, planos e qualquer outro arquivo.
- As seções existentes do README, exceto pelos acréscimos acima.
