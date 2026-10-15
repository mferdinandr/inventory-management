#!/usr/bin/env bash
# Proves a backup is restorable (docs/09-deployment-ops.md section 5).
#   scripts/restore-check.sh [dump.sql.gz]
# Restores the newest dump in BACKUP_DIR (or the given file) into a throwaway database,
# checks that the expected tables exist and prints their row counts, then drops the database.
# Exits non-zero on any failure. Takes the same COMPOSE_FILE / DB_SERVICE / DB_USER /
# BACKUP_DIR variables as backup.sh.
set -euo pipefail

cd "$(dirname "$0")/.."

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
DB_SERVICE="${DB_SERVICE:-db}"
DB_USER="${DB_USER:-simaset}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"

dump="${1:-}"
if [ -z "$dump" ]; then
  dump="$(ls -1 "$BACKUP_DIR"/simaset-*.sql.gz 2>/dev/null | sort | tail -1 || true)"
fi
if [ -z "$dump" ] || [ ! -f "$dump" ]; then
  echo "Tidak ada berkas cadangan di $BACKUP_DIR" >&2
  exit 1
fi

scratch="restore_check_$(date +%s)_$$"
psql_admin() { docker compose -f "$COMPOSE_FILE" exec -T "$DB_SERVICE" psql -U "$DB_USER" -d postgres -v ON_ERROR_STOP=1 "$@"; }
psql_scratch() { docker compose -f "$COMPOSE_FILE" exec -T "$DB_SERVICE" psql -U "$DB_USER" -d "$scratch" -v ON_ERROR_STOP=1 "$@"; }

cleanup() { psql_admin -qc "DROP DATABASE IF EXISTS \"$scratch\"" >/dev/null 2>&1 || true; }
trap cleanup EXIT

echo "Memulihkan $dump ke basis data sementara $scratch"
gzip -t "$dump"
psql_admin -qc "CREATE DATABASE \"$scratch\""
gzip -dc "$dump" | psql_scratch -q -o /dev/null

status=0
for table in users items item_contents item_logs maintenance_records; do
  if ! count="$(psql_scratch -tA -c "SELECT count(*) FROM \"$table\"" 2>/dev/null)"; then
    echo "GAGAL  tabel $table tidak ada" >&2
    status=1
    continue
  fi
  printf 'OK     %-20s %s baris\n' "$table" "$count"
done

# The append-only triggers are part of the schema and must survive a restore.
triggers="$(psql_scratch -tA -c "SELECT count(*) FROM pg_trigger WHERE NOT tgisinternal")" || status=1
if [ "${triggers:-0}" -lt 1 ]; then
  echo "GAGAL  trigger append-only tidak ditemukan" >&2
  status=1
else
  echo "OK     trigger: $triggers"
fi

if [ "$status" -eq 0 ]; then
  echo "Pemulihan teruji: $dump"
else
  echo "Pemulihan GAGAL: $dump" >&2
fi
exit "$status"
