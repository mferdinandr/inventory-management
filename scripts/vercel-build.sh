#!/usr/bin/env bash
# Vercel build: generate the Prisma client, apply database migrations (production and the `dev`
# branch only), then build the app. Migrating here means the new schema is in place before the new deployment takes
# traffic. Migrations must stay backward compatible with the previous release (docs/09).
set -euo pipefail

# Nothing connects during the build (except migrate in production), but the Prisma config and
# some modules read the variable on import.
export DATABASE_URL="${DATABASE_URL:-postgresql://build:build@localhost:5432/build}"

# `pnpm install` answers "Already up to date" from Vercel's build cache without running the
# postinstall hook, and src/generated is not committed, so generate explicitly every time.
node_modules/.bin/prisma generate

# The `dev` branch deploys as a Preview against its own database (Preview env vars scoped to
# that branch). Every other preview has no DATABASE_URL and never touches a database.
if [ "${VERCEL_ENV:-}" = "production" ] || { [ "${VERCEL_ENV:-}" = "preview" ] && [ "${VERCEL_GIT_COMMIT_REF:-}" = "dev" ]; }; then
  echo "Applying database migrations (VERCEL_ENV=${VERCEL_ENV}, branch=${VERCEL_GIT_COMMIT_REF:-unset})"
  node_modules/.bin/prisma migrate deploy
else
  echo "Skipping migrations (VERCEL_ENV=${VERCEL_ENV:-unset}); other previews never touch the database"
fi

exec node_modules/.bin/next build
