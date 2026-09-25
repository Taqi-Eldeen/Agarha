# One image, three entrypoints: API (default), worker and migrate. Build from the repo root:
#   docker build -f apps/api/Dockerfile --target api    -t agarha-api .
#   docker build -f apps/api/Dockerfile --target worker -t agarha-worker .
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=1
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
WORKDIR /repo

FROM base AS build
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --filter "@agarha/api..."
RUN pnpm --filter "@agarha/api..." build
# Self-contained production tree: dist + drizzle migrations + prod node_modules (workspace deps included).
RUN pnpm --filter @agarha/api deploy --prod --legacy /out

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production NODE_OPTIONS=--enable-source-maps
WORKDIR /app
COPY --from=build --chown=node:node /out ./
USER node

FROM runtime AS migrate
CMD ["node", "dist/db/migrate.js"]

FROM runtime AS worker
CMD ["node", "dist/worker/main.js"]

FROM runtime AS api
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=3s --retries=3 CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main.js"]
