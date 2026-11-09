# ==============================================================================
# VIDAEMDIA - BACKUP DO POSTGRESQL VIA DOCKER (PowerShell / Windows)
# ==============================================================================
param(
    [string]$ContainerName = "vidaemdia-postgres",
    [string]$DbUser = "vidaemdia",
    [string]$DbName = "vidaemdia_db"
)

$ErrorActionPreference = "Stop"
$BackupDir = Join-Path $PSScriptRoot "backups"
if (!(Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir | Out-Null
}

$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$BackupFile = Join-Path $BackupDir "vidaemdia_backup_$Timestamp.sql"

Write-Host "Iniciando backup do container '$ContainerName' (Banco: $DbName)..." -ForegroundColor Cyan
docker exec -t $ContainerName pg_dump -U $DbUser -d $DbName --clean --if-exists > $BackupFile

if ((Get-Item $BackupFile).Length -eq 0) {
    throw "Falha no backup: arquivo gerado está vazio."
}

$Hash = (Get-FileHash $BackupFile -Algorithm SHA256).Hash
Set-Content -Path "$BackupFile.sha256" -Value "$Hash  vidaemdia_backup_$Timestamp.sql"

Write-Host "Backup concluído com sucesso: $BackupFile" -ForegroundColor Green
Write-Host "SHA-256: $Hash" -ForegroundColor Gray

