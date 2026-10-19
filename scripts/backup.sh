#!/usr/bin/env bash
# Daily database backup (docs/09-deployment-ops.md section 5).
#   scripts/backup.sh
# Writes ./backups/simaset-YYYY-MM-DD.sql.gz from the compose database, deletes dumps older
# than KEEP_DAYS, and copies the dump off the server when RCLONE_REMOTE is set.
#
# Environment (defaults suit the production stack):
#   COMPOSE_FILE   docker-compose.yml        use docker-compose.dev.yml for the dev database
#   DB_SERVICE     db                        compose service running PostgreSQL
#   DB_USER        simaset
#   DB_NAME        simaset                   dev worktrees use simaset_<branch>
#   BACKUP_DIR     ./backups
#   KEEP_DAYS      30
#   RCLONE_REMOTE  (empty)                   e.g. "gdrive:simaset-backups"; skipped when empty
set -euo pipefail

cd "$(dirname "$0")/.."

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
DB_SERVICE="${DB_SERVICE:-db}"
DB_USER="${DB_USER:-simaset}"
DB_NAME="${DB_NAME:-simaset}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
KEEP_DAYS="${KEEP_DAYS:-30}"

mkdir -p "$BACKUP_DIR"
target="$BACKUP_DIR/simaset-$(date +%F).sql.gz"
partial="$target.partial"
trap 'rm -f "$partial"' EXIT

docker compose -f "$COMPOSE_FILE" exec -T "$DB_SERVICE" \
  pg_dump -U "$DB_USER" --no-owner --no-privileges "$DB_NAME" | gzip > "$partial"

# pipefail already fails the script on a broken dump; also refuse an empty or corrupt file.
gzip -t "$partial"
if [ "$(gzip -dc "$partial" | wc -c)" -lt 100 ]; then
  echo "Backup gagal: hasil dump kosong" >&2
  exit 1
fi
mv "$partial" "$target"
echo "Backup selesai: $target ($(du -h "$target" | cut -f1))"

find "$BACKUP_DIR" -name 'simaset-*.sql.gz' -type f -mtime "+$KEEP_DAYS" -print -delete |
  sed 's/^/Dihapus (lebih dari '"$KEEP_DAYS"' hari): /'

if [ -n "${RCLONE_REMOTE:-}" ]; then
  rclone copy "$target" "$RCLONE_REMOTE"
  echo "Disalin ke $RCLONE_REMOTE"
fi
