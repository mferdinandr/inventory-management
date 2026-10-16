#!/usr/bin/env bash
# Run on the server from the project folder (also called by the deploy workflow over SSH).
# Pulls main, rebuilds the app image, applies migrations, restarts. Backs up the database first.
set -euo pipefail
cd "$(dirname "$0")/.."

BRANCH="${DEPLOY_BRANCH:-main}"

if [ -x scripts/backup.sh ] && docker compose ps --status running db >/dev/null 2>&1; then
  scripts/backup.sh || echo "backup failed; continuing" >&2
fi

git fetch --quiet origin "$BRANCH"
git checkout --quiet "$BRANCH"
git reset --hard "origin/$BRANCH"

docker compose build app
docker compose up -d db
docker compose run --rm app node_modules/.bin/prisma migrate deploy
docker compose up -d
docker image prune -f >/dev/null

echo "deployed $(git rev-parse --short HEAD)"
