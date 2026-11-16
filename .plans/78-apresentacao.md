# 78 — Preparação da apresentação: checagem automática e roteiro no README

## Objetivo

A apresentação será feita no computador do aluno, com o Docker Compose local. Não há hospedagem pública: o Telegram usa `polling` e o Google redireciona para `localhost`. Este plano entrega:

1. um script PowerShell que confere, com um comando, se está tudo pronto para apresentar;
2. uma seção nova no README com a preparação, o roteiro de demonstração e os problemas comuns.

## Arquivos envolvidos (só estes)

- `infra/apresentacao/checar.ps1` (novo)
- `README.md`

## Passos

### 1. `infra/apresentacao/checar.ps1`

Precisa rodar no **Windows PowerShell 5.1** a partir da raiz do projeto: `powershell -ExecutionPolicy Bypass -File infra\apresentacao\checar.ps1`.

Regras de escrita:
- **Mensagens sem acento e sem emoji** (o PowerShell 5.1 lê o arquivo sem BOM como ANSI e estraga acentos). Exemplo: `Configuracao`, `nao`.
- Nunca imprimir segredos (tokens, senhas, chaves). Ler o `.env` só para as chaves listadas abaixo.
- Sem `&&`/`||`, sem `?:` e sem `??` (não existem no 5.1).
- Cada checagem imprime uma linha começando por `[OK]`, `[AVISO]` ou `[FALHA]`, com `Write-Host` e cor (verde, amarelo, vermelho). No fim, um resumo com o total de cada tipo. Sai com código 1 se houver alguma `[FALHA]`, senão 0.
- Funções pequenas por checagem; erros de uma checagem não interrompem as outras (`try/catch`).

Começo do script:
- `$ErrorActionPreference = 'Continue'`.
- Se `docker` não estiver no PATH e existir `$env:LOCALAPPDATA\Programs\DockerDesktop\resources\bin\docker.exe`, acrescentar essa pasta ao `$env:PATH`.
- Raiz do projeto = duas pastas acima do script (`Split-Path -Parent (Split-Path -Parent $PSScriptRoot)`); fazer `Set-Location` nela.

Checagens, nesta ordem:

1. **Docker no ar**: `docker info` com código 0. Se falhar: `[FALHA] Docker Desktop nao esta rodando. Abra o Docker Desktop e rode de novo.` e encerrar o script com código 1 (as outras dependem dele).
2. **Containers**: para cada nome `vidaemdia-postgres`, `vidaemdia-backend`, `vidaemdia-frontend`, `vidaemdia-prometheus`, `vidaemdia-grafana`, `vidaemdia-backup`, ler `docker inspect -f '{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{end}}' <nome>`. `running` + (`healthy` ou sem healthcheck) → `[OK]`; `running` + `starting` → `[AVISO] ... ainda iniciando`; outro estado ou inexistente → `[FALHA]` com a dica `docker compose up -d`.
3. **API**: `Invoke-RestMethod http://localhost:8080/api/health` com `status` igual a `OK` → `[OK]`; senão `[FALHA]`.
4. **Front**: `Invoke-WebRequest http://localhost:8080/ -UseBasicParsing` com status 200.
5. **Grafana**: `http://localhost:8080/grafana/login` com status 200.
6. **Prometheus coletando**: `docker exec vidaemdia-prometheus wget -qO- "http://localhost:9090/api/v1/query?query=up"`, converter com `ConvertFrom-Json`; o valor do resultado com `job` `vidaemdia-backend` igual a `"1"` → `[OK]`.
7. **Alertas disparados**: `docker exec vidaemdia-prometheus wget -qO- "http://localhost:9090/api/v1/alerts"`; para cada alerta com `state` `firing`, `[AVISO] Alerta disparado: <alertname>` (o `BackendReiniciado` logo depois de subir é esperado: dizer isso na mensagem). Nenhum → `[OK] Nenhum alerta disparado`.
8. **Bot do Telegram**: `docker exec vidaemdia-backend node -e "fetch('https://api.telegram.org/bot'+process.env.TELEGRAM_BOT_TOKEN+'/getMe').then(r=>r.json()).then(j=>console.log(j.ok?('ok '+j.result.username):'erro')).catch(()=>console.log('erro'))"`. Saída começando por `ok` → `[OK] Bot @<username> respondendo`; senão `[FALHA] Bot do Telegram nao respondeu (internet ou TELEGRAM_BOT_TOKEN)`.
9. **Erros recentes do polling**: `docker logs --since 10m vidaemdia-backend 2>&1` e contar linhas com `Erro no polling do Telegram`. 0 → `[OK]`; 1 a 5 → `[AVISO] <n> falhas de conexao com o Telegram nos ultimos 10 min (instabilidade de rede; o bot tenta de novo sozinho)`; mais de 5 → `[FALHA]` com a dica de conferir a internet e reiniciar o backend (`docker compose restart backend`). Atenção: no 5.1 o `2>&1` de executável nativo vira ErrorRecord; usar `cmd /c "docker logs --since 10m vidaemdia-backend 2>&1"` para capturar como texto.
10. **Google conectado e validade**: `docker exec vidaemdia-postgres psql -U <POSTGRES_USER> -d <POSTGRES_DB> -At -F "|" -c "select u.name, to_char(g.connected_at, 'YYYY-MM-DD\"T\"HH24:MI:SS') from google_accounts g join users u on u.id = g.user_id"` (usuário e banco lidos do `.env`, com padrão `vidaemdia` e `vidaemdia_db`). Para cada linha: o token do modo de teste vale 7 dias a partir de `connected_at` (UTC). Faltando mais de 2 dias → `[OK] Google de <nome> conectado; reconectar ate <data dd/MM HH:mm no horario local>`; de 0 a 2 dias → `[AVISO] ... vence em menos de 2 dias: reconecte em Menu do usuario > Google Agenda`; vencido → `[FALHA] ... Google de <nome> expirado: desconecte e conecte de novo`. Nenhuma conta → `[AVISO] Nenhuma conta Google conectada (a demonstracao do Google nao vai funcionar)`.
11. **Erro de sincronização nas agendas**: mesma forma de consulta, `select name, google_sync_error from calendars where google_sync_error is not null`. Cada linha → `[AVISO] Agenda <nome>: <erro>`. Nenhuma → `[OK]`.
12. **`.env` da apresentação**: ler `.env` (linhas `CHAVE=valor`, ignorando comentários e aspas) e conferir:
    - `TELEGRAM_MODE` igual a `polling` → `[OK]`; senão `[AVISO]` explicando que sem endereço público só o `polling` funciona.
    - `VITE_SHOW_DEMO_ACCOUNTS` igual a `true` → `[OK]`; senão `[AVISO] Botoes das contas de demonstracao escondidos. Coloque VITE_SHOW_DEMO_ACCOUNTS=true no .env e rode: docker compose up -d --build frontend`.
    - `GOOGLE_CLIENT_ID` preenchido → `[OK]` (sem mostrar o valor); vazio → `[AVISO]`.
13. **Backup recente**: o arquivo `*.sql.gz` mais novo em `infra/backup/backups`. Menos de 2 dias → `[OK] Ultimo backup: <nome>`; mais velho → `[AVISO]` com o comando `docker exec vidaemdia-backup /scripts/backup.sh`; nenhum → `[AVISO]`.

### 2. README — nova seção `## 9. Apresentação (checklist e roteiro)`

Acrescentar no fim do README, em português, direto. Conteúdo:

**9.1 Na véspera**
- Abrir o Docker Desktop e subir tudo: `docker compose up -d --build`.
- No `.env`: `TELEGRAM_MODE=polling` e `VITE_SHOW_DEMO_ACCOUNTS=true` (depois de mudar, `docker compose up -d --build frontend`).
- Reconectar o Google se faltarem menos de 2 dias para os 7 dias (o script avisa).
- Fazer um backup: `docker exec vidaemdia-backup /scripts/backup.sh` (no Git Bash, usar `MSYS_NO_PATHCONV=1` antes do comando ou rodar pelo PowerShell, porque o Git Bash converte o caminho `/scripts/...`).
- Rodar o checklist: `powershell -ExecutionPolicy Bypass -File infra\apresentacao\checar.ps1`; tudo deve sair `[OK]` ou com avisos entendidos.
- Não rodar o seed (`prisma:seed`): ele apaga e recria as agendas das contas de demonstração, e o vínculo com o Google se perde.

**9.2 Endereços**
Tabela: Aplicação `http://localhost:8080`; Swagger `http://localhost:8080/api/api/docs`; Grafana `http://localhost:8080/grafana/` (usuário e senha do `.env`: `GRAFANA_ADMIN_USER`/`GRAFANA_ADMIN_PASSWORD`); bot `@<TELEGRAM_BOT_USERNAME>` (no `.env`).

**9.3 Roteiro de demonstração** (lista numerada; cada item diz a conta, o que fazer e o que aparece):
1. **Criar conta**: em `/criar-conta`, criar uma conta nova; mostrar a regra da senha e o cartão Primeiros passos na agenda.
2. **Compromisso e lembrete no Telegram**: entrar como Carlos (conta com o Telegram vinculado), criar um compromisso para daqui a poucos minutos com lembrete; mostrar a mensagem chegando no Telegram. Atalho: Bastidores > Envio de lembretes > executar o worker agora.
3. **Bot**: no Telegram, mandar `/agenda` ou criar um compromisso por mensagem; mostrar que ele aparece na agenda.
4. **Google Agenda**: na agenda do Carlos (ligada ao Google), criar um compromisso e mostrar no Google Agenda; criar um evento no Google e usar "Sincronizar agora" para trazer ao VidaEmDia (marca Google). Mostrar também a marca de conflito.
5. **Compartilhar e RBAC**: Dr. João compartilha o consultório com a secretária Maria; entrar como Maria e mostrar o acesso; em Bastidores > Controle de acesso, mostrar o `403` ao tentar a agenda da Dra. Ana.
6. **Histórico e auditoria**: Histórico da agenda e Bastidores > Auditoria.
7. **Minha conta e Esqueci a senha**: trocar o nome, mostrar a recuperação de senha pelo Telegram (só com conta que tem o Telegram vinculado).
8. **Monitoramento**: Grafana, painel VidaEmDia — Visão geral (compromissos, lembretes, Telegram, Google, segurança) e os alertas; Bastidores > Envio de lembretes > simular falha para mostrar o contador de falhas.
9. **DevOps**: CI no GitHub Actions (lint, testes, build, imagens, Trivy, validação do monitoramento), Docker Compose com healthchecks, backup e restauração (seção 7).

**9.4 Acesso pelo celular (opcional)**
- `cloudflared tunnel --url http://localhost:8080` gera um endereço `https://...trycloudflare.com` temporário, sem conta e sem cartão. Vale enquanto o comando e o computador estiverem ligados.
- Para o cadastro e o login pelo túnel funcionarem, o endereço do túnel precisa estar no `CORS_ORIGIN` do `.env` (separado por vírgula, se o backend aceitar lista; conferir em `backend/src/config/cors.ts` antes de escrever esta frase e descrever o formato real) e o backend precisa ser reiniciado (`docker compose up -d backend`).
- O "Conectar Google" não funciona pelo túnel (o Google só aceita o redirecionamento cadastrado); mostrar essa parte no computador.

**9.5 Problemas comuns**
Tabela problema → o que fazer:
- Botões das contas demo não aparecem → `VITE_SHOW_DEMO_ACCOUNTS=true` e rebuild do front.
- "Conexão com o Google expirou" → Menu do usuário > Google Agenda > desconectar e conectar de novo.
- Avisos `Erro no polling do Telegram: fetch failed` no log → instabilidade da internet; o bot tenta de novo sozinho. Se o bot não responder, `docker compose restart backend`.
- Lembrete não chegou → conferir se a conta tem o Telegram vinculado e usar "executar o worker agora".
- Alerta `BackendReiniciado` no Grafana logo após subir → esperado nos primeiros 2 minutos.
- Porta 8080 ocupada → fechar o outro programa ou mudar a porta no `docker-compose.yml`.

## Critérios de aceite

- O script roda no Windows PowerShell 5.1 sem erro de sintaxe e mostra as 13 checagens.
- O README tem a seção 9 com as cinco subseções; nada mais do README muda.

## O que NÃO alterar

- Código do backend/front, `docker-compose.yml`, `.env` e qualquer arquivo fora da lista.
