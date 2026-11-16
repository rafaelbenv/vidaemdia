# ==============================================================================
# Script de verificacao pre-apresentacao (Windows PowerShell 5.1)
# ==============================================================================

$ErrorActionPreference = 'Continue'

# Se docker nao estiver no PATH, tentar o caminho padrao do Docker Desktop
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    $dockerBin = Join-Path $env:LOCALAPPDATA "Programs\DockerDesktop\resources\bin"
    if (Test-Path (Join-Path $dockerBin "docker.exe")) {
        $env:PATH = "$dockerBin;$env:PATH"
    }
}

# Raiz do projeto = duas pastas acima deste script
$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $projectRoot

$script:okCount = 0
$script:warnCount = 0
$script:failCount = 0

function Report-Ok($msg) {
    $script:okCount++
    Write-Host "[OK] $msg" -ForegroundColor Green
}

function Report-Aviso($msg) {
    $script:warnCount++
    Write-Host "[AVISO] $msg" -ForegroundColor Yellow
}

function Report-Falha($msg) {
    $script:failCount++
    Write-Host "[FALHA] $msg" -ForegroundColor Red
}

function Get-EnvMap {
    $envMap = @{}
    $envPath = Join-Path $projectRoot ".env"
    if (Test-Path $envPath) {
        $lines = Get-Content $envPath
        foreach ($line in $lines) {
            $trimmed = $line.Trim()
            if ($trimmed -ne "" -and -not $trimmed.StartsWith("#")) {
                $idx = $trimmed.IndexOf("=")
                if ($idx -gt 0) {
                    $key = $trimmed.Substring(0, $idx).Trim()
                    $val = $trimmed.Substring($idx + 1).Trim()
                    if (($val.StartsWith('"') -and $val.EndsWith('"')) -or ($val.StartsWith("'") -and $val.EndsWith("'"))) {
                        if ($val.Length -ge 2) {
                            $val = $val.Substring(1, $val.Length - 2)
                        }
                    }
                    $envMap[$key] = $val
                }
            }
        }
    }
    return $envMap
}

$envVars = Get-EnvMap

# 1. Docker no ar
try {
    $null = & docker info 2>&1
    if ($LASTEXITCODE -ne 0) {
        Report-Falha "Docker Desktop nao esta rodando. Abra o Docker Desktop e rode de novo."
        Write-Host ""
        Write-Host "Resumo: $script:okCount OK, $script:warnCount AVISO, $script:failCount FALHA" -ForegroundColor Red
        exit 1
    }
    Report-Ok "Docker Desktop rodando"
}
catch {
    Report-Falha "Docker Desktop nao esta rodando. Abra o Docker Desktop e rode de novo."
    Write-Host ""
    Write-Host "Resumo: $script:okCount OK, $script:warnCount AVISO, $script:failCount FALHA" -ForegroundColor Red
    exit 1
}

# 2. Containers
$containers = @(
    "vidaemdia-postgres",
    "vidaemdia-backend",
    "vidaemdia-frontend",
    "vidaemdia-prometheus",
    "vidaemdia-grafana",
    "vidaemdia-backup"
)

foreach ($c in $containers) {
    try {
        $format = '{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{end}}'
        $inspect = (& docker inspect -f $format $c 2>&1)
        if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($inspect)) {
            Report-Falha "Container $c nao encontrado ou parado. Execute: docker compose up -d"
        }
        else {
            $inspectStr = ($inspect | Out-String).Trim()
            $parts = $inspectStr -split '\s+'
            $status = $parts[0]
            $health = ""
            if ($parts.Length -gt 1) {
                $health = $parts[1]
            }

            if ($status -eq "running" -and ($health -eq "healthy" -or $health -eq "")) {
                $detail = ""
                if ($health -ne "") {
                    $detail = " ($health)"
                }
                Report-Ok "Container $c rodando$detail"
            }
            elseif ($status -eq "running" -and $health -eq "starting") {
                Report-Aviso "Container $c ainda iniciando"
            }
            else {
                Report-Falha "Container $c em estado inesperado ($inspectStr). Execute: docker compose up -d"
            }
        }
    }
    catch {
        Report-Falha "Container $c com erro ao inspecionar. Execute: docker compose up -d"
    }
}

# 3. API
try {
    $resp = Invoke-RestMethod -Uri "http://localhost:8080/api/health" -Method Get -TimeoutSec 5 -ErrorAction Stop
    if ($resp -and $resp.status -eq "OK") {
        Report-Ok "API respondendo em http://localhost:8080/api/health (status OK)"
    }
    else {
        Report-Falha "API nao respondeu com status OK em http://localhost:8080/api/health"
    }
}
catch {
    Report-Falha "API nao respondeu em http://localhost:8080/api/health. Verifique o backend e o nginx"
}

# 4. Front
try {
    $resp = Invoke-WebRequest -Uri "http://localhost:8080/" -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
    if ($resp.StatusCode -eq 200) {
        Report-Ok "Frontend respondendo em http://localhost:8080/ (HTTP 200)"
    }
    else {
        Report-Falha "Frontend retornou status HTTP $($resp.StatusCode) em http://localhost:8080/"
    }
}
catch {
    Report-Falha "Falha ao conectar no frontend em http://localhost:8080/"
}

# 5. Grafana
try {
    $resp = Invoke-WebRequest -Uri "http://localhost:8080/grafana/login" -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
    if ($resp.StatusCode -eq 200) {
        Report-Ok "Grafana respondendo em http://localhost:8080/grafana/login (HTTP 200)"
    }
    else {
        Report-Falha "Grafana retornou status HTTP $($resp.StatusCode) em http://localhost:8080/grafana/login"
    }
}
catch {
    Report-Falha "Falha ao conectar no Grafana em http://localhost:8080/grafana/login"
}

# 6. Prometheus coletando
try {
    $raw = & docker exec vidaemdia-prometheus wget -qO- "http://localhost:9090/api/v1/query?query=up" 2>$null
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($raw)) {
        Report-Falha "Prometheus nao respondeu a consulta up"
    }
    else {
        $json = $raw | ConvertFrom-Json
        $backendUp = $false
        if ($json -and $json.data -and $json.data.result) {
            foreach ($item in $json.data.result) {
                if ($item.metric -and $item.metric.job -eq "vidaemdia-backend") {
                    if ($item.value -and $item.value.Length -ge 2 -and [string]$item.value[1] -eq "1") {
                        $backendUp = $true
                        break
                    }
                }
            }
        }
        if ($backendUp) {
            Report-Ok "Prometheus coletando metricas do backend (job vidaemdia-backend = 1)"
        }
        else {
            Report-Falha "Prometheus nao esta coletando do backend ou job vidaemdia-backend diferente de 1"
        }
    }
}
catch {
    Report-Falha "Erro ao consultar metricas do Prometheus"
}

# 7. Alertas disparados
try {
    $raw = & docker exec vidaemdia-prometheus wget -qO- "http://localhost:9090/api/v1/alerts" 2>$null
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($raw)) {
        Report-Aviso "Nao foi possivel consultar alertas do Prometheus"
    }
    else {
        $json = $raw | ConvertFrom-Json
        $firingAlerts = @()
        if ($json -and $json.data -and $json.data.alerts) {
            foreach ($a in $json.data.alerts) {
                if ($a.state -eq "firing") {
                    $firingAlerts += $a
                }
            }
        }
        if ($firingAlerts.Count -eq 0) {
            Report-Ok "Nenhum alerta disparado"
        }
        else {
            foreach ($a in $firingAlerts) {
                $alertName = "desconhecido"
                if ($a.labels -and $a.labels.alertname) {
                    $alertName = $a.labels.alertname
                }
                if ($alertName -eq "BackendReiniciado") {
                    Report-Aviso "Alerta disparado: BackendReiniciado (esperado logo depois de subir nos primeiros 2 minutos)"
                }
                else {
                    Report-Aviso "Alerta disparado: $alertName"
                }
            }
        }
    }
}
catch {
    Report-Aviso "Erro ao verificar alertas do Prometheus"
}

# 8. Bot do Telegram
try {
    $nodeCode = "fetch('https://api.telegram.org/bot'+process.env.TELEGRAM_BOT_TOKEN+'/getMe').then(r=>r.json()).then(j=>console.log(j.ok?('ok '+j.result.username):'erro')).catch(()=>console.log('erro'))"
    $raw = & docker exec vidaemdia-backend node -e $nodeCode 2>$null
    $outStr = ($raw | Out-String).Trim()
    if ($outStr -and $outStr.StartsWith("ok")) {
        $parts = $outStr -split '\s+'
        $botUser = ""
        if ($parts.Length -gt 1) {
            $botUser = $parts[1]
        }
        if ($botUser -ne "") {
            Report-Ok "Bot @$botUser respondendo"
        }
        else {
            Report-Ok "Bot do Telegram respondendo"
        }
    }
    else {
        Report-Falha "Bot do Telegram nao respondeu (internet ou TELEGRAM_BOT_TOKEN)"
    }
}
catch {
    Report-Falha "Bot do Telegram nao respondeu (internet ou TELEGRAM_BOT_TOKEN)"
}

# 9. Erros recentes do polling
try {
    $logLines = cmd /c "docker logs --since 10m vidaemdia-backend 2>&1"
    $count = 0
    if ($logLines) {
        foreach ($line in $logLines) {
            if ($line -like "*Erro no polling do Telegram*") {
                $count++
            }
        }
    }

    if ($count -eq 0) {
        Report-Ok "Nenhum erro no polling do Telegram nos ultimos 10 min"
    }
    elseif ($count -le 5) {
        Report-Aviso "$count falhas de conexao com o Telegram nos ultimos 10 min (instabilidade de rede; o bot tenta de novo sozinho)"
    }
    else {
        Report-Falha "$count falhas de conexao com o Telegram nos ultimos 10 min. Verifique a internet e reinicie o backend: docker compose restart backend"
    }
}
catch {
    Report-Falha "Nao foi possivel consultar logs do backend para o polling"
}

# 10. Google conectado e validade
try {
    $pgUser = "vidaemdia"
    if ($envVars.ContainsKey("POSTGRES_USER") -and $envVars["POSTGRES_USER"] -ne "") {
        $pgUser = $envVars["POSTGRES_USER"]
    }
    $pgDb = "vidaemdia_db"
    if ($envVars.ContainsKey("POSTGRES_DB") -and $envVars["POSTGRES_DB"] -ne "") {
        $pgDb = $envVars["POSTGRES_DB"]
    }

    $sqlGoogle = 'select u.name, floor(extract(epoch from g.connected_at))::bigint from google_accounts g join users u on u.id = g.user_id'
    $rawAccounts = & docker exec vidaemdia-postgres psql -U $pgUser -d $pgDb -At -F "|" -c $sqlGoogle 2>$null
    $accountLines = @()
    if ($rawAccounts) {
        foreach ($l in $rawAccounts) {
            $t = ($l | Out-String).Trim()
            if ($t -ne "") {
                $accountLines += $t
            }
        }
    }

    if ($accountLines.Count -eq 0) {
        Report-Aviso "Nenhuma conta Google conectada (a demonstracao do Google nao vai funcionar)"
    }
    else {
        $nowUtc = [DateTime]::UtcNow
        foreach ($line in $accountLines) {
            $parts = $line.Split('|')
            $name = $parts[0]
            $dateStr = ""
            if ($parts.Length -gt 1) {
                $dateStr = $parts[1]
            }

            try {
                $connectedUtc = ([DateTime]'1970-01-01T00:00:00Z').ToUniversalTime().AddSeconds([double]$dateStr.Trim())
                $expiresUtc = $connectedUtc.AddDays(7)
                $remaining = $expiresUtc - $nowUtc
                $expiresLocal = $expiresUtc.ToLocalTime()
                $dateFormatted = $expiresLocal.ToString("dd/MM HH:mm")

                if ($remaining.TotalDays -lt 0) {
                    Report-Falha "Google de $name expirado: desconecte e conecte de novo"
                }
                elseif ($remaining.TotalDays -le 2) {
                    Report-Aviso "Google de $name vence em menos de 2 dias: reconecte em Menu do usuario > Google Agenda"
                }
                else {
                    Report-Ok "Google de $name conectado; reconectar ate $dateFormatted"
                }
            }
            catch {
                Report-Aviso "Google de $name conectado mas nao foi possivel verificar validade da data ($dateStr)"
            }
        }
    }
}
catch {
    Report-Aviso "Erro ao consultar contas Google no Postgres"
}

# 11. Erro de sincronizacao nas agendas
try {
    $sqlSync = 'select name, google_sync_error from calendars where google_sync_error is not null'
    $rawSync = & docker exec vidaemdia-postgres psql -U $pgUser -d $pgDb -At -F "|" -c $sqlSync 2>$null
    $syncLines = @()
    if ($rawSync) {
        foreach ($l in $rawSync) {
            $t = ($l | Out-String).Trim()
            if ($t -ne "") {
                $syncLines += $t
            }
        }
    }

    if ($syncLines.Count -eq 0) {
        Report-Ok "Nenhuma agenda com erro de sincronizacao"
    }
    else {
        foreach ($line in $syncLines) {
            $parts = $line.Split('|')
            $calName = $parts[0]
            $syncErr = ""
            if ($parts.Length -gt 1) {
                $syncErr = $parts[1]
            }
            Report-Aviso "Agenda ${calName}: $syncErr"
        }
    }
}
catch {
    Report-Aviso "Erro ao consultar sincronizacao das agendas no Postgres"
}

# 12. .env da apresentacao
# TELEGRAM_MODE
$telegramMode = ""
if ($envVars.ContainsKey("TELEGRAM_MODE")) {
    $telegramMode = $envVars["TELEGRAM_MODE"]
}
if ($telegramMode -eq "polling") {
    Report-Ok "TELEGRAM_MODE configurado como polling"
}
else {
    Report-Aviso "TELEGRAM_MODE nao e polling (sem endereco publico so o polling funciona)"
}

# VITE_SHOW_DEMO_ACCOUNTS
$showDemo = ""
if ($envVars.ContainsKey("VITE_SHOW_DEMO_ACCOUNTS")) {
    $showDemo = $envVars["VITE_SHOW_DEMO_ACCOUNTS"]
}
if ($showDemo -eq "true") {
    Report-Ok "VITE_SHOW_DEMO_ACCOUNTS ativado (contas de demonstracao visiveis)"
}
else {
    Report-Aviso "Botoes das contas de demonstracao escondidos. Coloque VITE_SHOW_DEMO_ACCOUNTS=true no .env e rode: docker compose up -d --build frontend"
}

# GOOGLE_CLIENT_ID
$googleClientId = ""
if ($envVars.ContainsKey("GOOGLE_CLIENT_ID")) {
    $googleClientId = $envVars["GOOGLE_CLIENT_ID"]
}
if ($googleClientId -ne "") {
    Report-Ok "GOOGLE_CLIENT_ID configurado"
}
else {
    Report-Aviso "GOOGLE_CLIENT_ID nao configurado no .env"
}

# 13. Backup recente
$backupDir = Join-Path $projectRoot "infra\backup\backups"
$backups = @()
if (Test-Path $backupDir) {
    $backups = @(Get-ChildItem -Path $backupDir -Filter "*.sql.gz" -File | Sort-Object LastWriteTime -Descending)
}

if ($backups.Count -eq 0) {
    Report-Aviso "Nenhum backup encontrado em infra/backup/backups. Execute: docker exec vidaemdia-backup /scripts/backup.sh"
}
else {
    $newest = $backups[0]
    $age = (Get-Date) - $newest.LastWriteTime
    if ($age.TotalDays -lt 2) {
        Report-Ok "Ultimo backup: $($newest.Name)"
    }
    else {
        Report-Aviso "Ultimo backup ($($newest.Name)) tem mais de 2 dias. Execute: docker exec vidaemdia-backup /scripts/backup.sh"
    }
}

# Resumo final
Write-Host ""
if ($script:failCount -gt 0) {
    Write-Host "Resumo: $script:okCount OK, $script:warnCount AVISO, $script:failCount FALHA" -ForegroundColor Red
    exit 1
}
elseif ($script:warnCount -gt 0) {
    Write-Host "Resumo: $script:okCount OK, $script:warnCount AVISO, $script:failCount FALHA" -ForegroundColor Yellow
    exit 0
}
else {
    Write-Host "Resumo: $script:okCount OK, $script:warnCount AVISO, $script:failCount FALHA" -ForegroundColor Green
    exit 0
}
