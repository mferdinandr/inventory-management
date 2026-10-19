#!/usr/bin/env bash
# certbot deploy hook: copies the renewed certificate where docker-compose.yml mounts it
# (./certs), gives PostgreSQL (uid 999) ownership of the key, and reloads the database.
#   certbot certonly --standalone -d db.example.org --deploy-hook /opt/simaset/scripts/pg-cert-hook.sh
set -euo pipefail

SRC="${RENEWED_LINEAGE:?run this through certbot --deploy-hook}"
APP_DIR="${APP_DIR:-/opt/simaset}"

install -d -m 755 "$APP_DIR/certs"
install -m 644 "$SRC/fullchain.pem" "$APP_DIR/certs/fullchain.pem"
install -m 600 -o 999 -g 999 "$SRC/privkey.pem" "$APP_DIR/certs/privkey.pem"

cd "$APP_DIR"
# SIGHUP makes PostgreSQL re-read its certificate without dropping connections.
docker compose kill -s SIGHUP db 2>/dev/null || true
