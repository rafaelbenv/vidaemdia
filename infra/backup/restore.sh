#!/bin/sh
# ==============================================================================
# VIDAEMDIA - PROCEDIMENTO DE RECUPERAÇÃO (RESTORE) DO POSTGRESQL (Linux / Docker)
# ==============================================================================
set -e

if [ -z "$1" ]; then
  echo "Uso: ./restore.sh <caminho_do_arquivo_backup.sql.gz>"
  echo "Backups disponíveis em /backups:"
  ls -lh /backups/vidaemdia_backup_*.sql.gz 2>/dev/null || echo "Nenhum backup encontrado."
  exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "${BACKUP_FILE}" ]; then
  echo "[ERRO] Arquivo de backup não encontrado: ${BACKUP_FILE}"
  exit 1
fi

if [ -f "${BACKUP_FILE}.sha256" ]; then
  echo "Verificando integridade SHA-256 do backup..."
  sha256sum -c "${BACKUP_FILE}.sha256"
fi

echo "[$(date -Iseconds)] Restaurando banco ${PGDATABASE:-vidaemdia_db} a partir de ${BACKUP_FILE}..."

gunzip -c "${BACKUP_FILE}" | psql \
  --host="${PGHOST:-postgres}" \
  --username="${PGUSER:-vidaemdia}" \
  --dbname="${PGDATABASE:-vidaemdia_db}"

echo "[$(date -Iseconds)] Recuperação (Restore) concluída com sucesso!"

