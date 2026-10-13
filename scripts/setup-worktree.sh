#!/usr/bin/env bash
# Prepare a fresh git worktree for development, safe to run next to other worktrees.
#
#   scripts/setup-worktree.sh            # run from inside the worktree
#
# Each worktree gets its own database (simaset_<branch>) inside the one shared dev Postgres
# container, its own test database (<db>_test, see tests/global-setup.ts) and its own dev
# server port, so parallel agents never share state.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

branch="$(git branch --show-current)"
[ -n "$branch" ] || { echo "Detached HEAD: check out a branch first." >&2; exit 1; }
slug="$(printf '%s' "$branch" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/_/g; s/^_+|_+$//g' | cut -c1-40)"
db="simaset_${slug}"
# Stable port in 3100-3999 derived from the branch name.
port=$((3100 + $(printf '%s' "$branch" | cksum | cut -d' ' -f1) % 900))

# 1. .env: copy from any sibling worktree that has one, else from the example.
if [ ! -f .env ]; then
  source_env=""
  while read -r path; do
    [ -f "$path/.env" ] && [ "$path" != "$PWD" ] && { source_env="$path/.env"; break; }
  done < <(git worktree list --porcelain | sed -n 's/^worktree //p')
  cp "${source_env:-.env.example}" .env
  echo "Created .env from ${source_env:-.env.example}"
fi

# 2. Point this worktree at its own database and port.
python3 - "$db" "$port" <<'PY'
import re, sys
db, port = sys.argv[1], sys.argv[2]
text = open(".env").read()
text = re.sub(r"(?m)^DATABASE_URL=(postgresql://[^/]+)/[^\s]*$", rf"DATABASE_URL=\1/{db}", text)
text = re.sub(r"(?m)^PORT=.*\n", "", text)
text = text.rstrip("\n") + f"\nPORT={port}\n"
open(".env", "w").write(text)
PY

# 3. Shared dev Postgres container, then this worktree's database.
docker compose -f docker-compose.dev.yml up -d --wait db
docker exec simaset-dev-db psql -U simaset -tAc "SELECT 1 FROM pg_database WHERE datname='${db}'" | grep -q 1 \
  || docker exec simaset-dev-db psql -U simaset -c "CREATE DATABASE ${db}"

# 4. Dependencies, Prisma client, migrations.
pnpm install --frozen-lockfile
node_modules/.bin/prisma generate
node_modules/.bin/prisma migrate deploy

echo
echo "Worktree ready: branch=${branch} database=${db} port=${port}"
echo "  dev server : pnpm dev        (http://localhost:${port})"
echo "  checks     : node_modules/.bin/biome check . && node_modules/.bin/tsc --noEmit && node_modules/.bin/vitest run"
