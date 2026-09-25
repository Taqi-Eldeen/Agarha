# @agarha/worker

The background worker is the API codebase started with a different entrypoint
(`apps/api/src/worker/main.ts` → `dist/worker/main.js`), so jobs share modules, schemas and the DB
layer with the HTTP API (ADR-0001: modular monolith). It runs as its own process and container so it
scales and restarts independently of the API.

| Queue           | Jobs                                                                                           |
| --------------- | ---------------------------------------------------------------------------------------------- |
| `notifications` | OTP/lead/nudge WhatsApp + SMS + push fan-out with provider failover                            |
| `media`         | EXIF strip, WebP/AVIF 320/640/1280, blurhash                                                   |
| `events`        | analytics events, search projection refresh, audit fan-out                                     |
| repeatable      | freshness sweep (hide after 14 days), availability nudges, review prompts, saved-search alerts |

```bash
pnpm --filter @agarha/worker dev        # watch mode, reads apps/api/.env
pnpm --filter @agarha/worker start      # compiled (after pnpm --filter @agarha/api build)
docker build -f apps/api/Dockerfile --target worker -t agarha-worker .
```

Configuration is the API's (`apps/api/.env.example`); the worker needs `DATABASE_URL`, `REDIS_URL`,
storage and messaging provider keys but no HTTP port.
