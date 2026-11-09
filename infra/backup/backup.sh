#!/bin/sh
# ==============================================================================
# VIDAEMDIA - PROCEDIMENTO DE BACKUP AUTOMATIZADO DO POSTGRESQL (Linux / Docker)
# ==============================================================================
set -e

BACKUP_DIR="${BACKUP_DIR:-/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/vidaemdia_backup_${TIMESTAMP}.sql.gz"

mkdir -p "${BACKUP_DIR}"

echo "[$(date -Iseconds)] Iniciando backup do banco PostgreSQL (${PGDATABASE:-vidaemdia_db})..."

pg_dump \
  --host="${PGHOST:-postgres}" \
  --username="${PGUSER:-vidaemdia}" \
  --dbname="${PGDATABASE:-vidaemdia_db}" \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges | gzip -9 > "${BACKUP_FILE}"

# Verifica se o arquivo gerado não está vazio
if [ ! -s "${BACKUP_FILE}" ]; then
  echo "[ERRO] O arquivo de backup ${BACKUP_FILE} está vazio!"
  exit 1
fi

# Gera hash SHA-256 para auditoria de integridade
sha256sum "${BACKUP_FILE}" > "${BACKUP_FILE}.sha256"

echo "[$(date -Iseconds)] Backup concluído com sucesso: ${BACKUP_FILE}"

# Rotação de backups antigos (mantém últimos N dias)
find "${BACKUP_DIR}" -name "vidaemdia_backup_*.sql.gz*" -type f -mtime +"${RETENTION_DAYS}" -delete
echo "[$(date -Iseconds)] Limpeza de backups com mais de ${RETENTION_DAYS} dias finalizada."

