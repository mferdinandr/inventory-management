FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /app

FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY . .
# Build-time placeholder only: nothing connects during the build, but modules read it on import.
RUN export DATABASE_URL=postgresql://build:build@localhost:5432/build \
 && pnpm exec prisma generate \
 && pnpm exec next build

# Runs `next start` and keeps the Prisma CLI so `prisma migrate deploy` works in the container.
FROM build AS runtime
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node_modules/.bin/next", "start"]
