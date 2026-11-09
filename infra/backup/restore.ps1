# ==============================================================================
# VIDAEMDIA - RECUPERAÇÃO (RESTORE) DO POSTGRESQL VIA DOCKER (PowerShell / Windows)
# ==============================================================================
param(
    [Parameter(Mandatory=$true)]
    [string]$BackupFile,
    [string]$ContainerName = "vidaemdia-postgres",
    [string]$DbUser = "vidaemdia",
    [string]$DbName = "vidaemdia_db"
)

$ErrorActionPreference = "Stop"

if (!(Test-Path $BackupFile)) {
    throw "Arquivo de backup não encontrado: $BackupFile"
}

Write-Host "Restaurando backup '$BackupFile' no container '$ContainerName' ($DbName)..." -ForegroundColor Yellow
Get-Content $BackupFile | docker exec -i $ContainerName psql -U $DbUser -d $DbName

Write-Host "Recuperação (Restore) concluída com sucesso!" -ForegroundColor Green

