#!/usr/bin/env bash
# Vercel build: apply database migrations (production only), then build the app.
# Migrating here means the new schema is in place before the new deployment takes traffic.
# Migrations must stay backward compatible with the previous release (docs/09).
set -euo pipefail

if [ "${VERCEL_ENV:-}" = "production" ]; then
  echo "Applying database migrations"
  node_modules/.bin/prisma migrate deploy
else
  echo "Skipping migrations (VERCEL_ENV=${VERCEL_ENV:-unset}); previews never touch the database"
  # Nothing connects during the build, but modules read the variable on import.
  export DATABASE_URL="${DATABASE_URL:-postgresql://build:build@localhost:5432/build}"
fi

exec node_modules/.bin/next build
