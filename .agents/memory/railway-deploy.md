---
name: Railway deploy for this pnpm monorepo
description: Hard-won config to build/run this workspace on Railway (Nixpacks) and the Plan B failover setup.
---

# Railway deploy (Nixpacks) — what finally worked

App is live at https://workspaceapi-server-production-01d8.up.railway.app (branch main, auto-deploy may need manual Redeploy).
- **Railway project name: NATURAL-EXPLORATION** (service @workspace/api-server + Postgres).
- **GitHub repo: tahamuzza-ship-it/ALTAMAGIA** (remote `origin`; user created it via Git pane).

Required combo (each fixed a distinct failure):
- `packageManager: pnpm@10.26.1` in root package.json — Nixpacks otherwise picks an old pnpm that can't read the workspace `overrides` (ERR_PNPM_LOCKFILE_CONFIG_MISMATCH).
- `nixpacks.toml` `[variables]`: `COREPACK_INTEGRITY_KEYS="0"` (corepack "Cannot find matching keyid" signature error), `NODE_ENV="development"` + `NPM_CONFIG_PRODUCTION="false"` (Nixpacks defaults NODE_ENV=production and pnpm then skips devDependencies → vite/tsc missing at build).
- Node 22 pinned via `engines.node` and `.node-version` (Nixpacks gave Node 18; Vite requires 20+, also broke @tailwindcss/oxide native binding).
- `railway.json`: buildCommand `pnpm run railway:build`, startCommand `pnpm run railway:start`.
- `SERVE_STATIC_DIR` must be absolute (`$PWD/...`) in railway:start — `pnpm --filter run` changes cwd, relative path 404s the frontend.
- Railway service needs `DATABASE_URL = ${{Postgres.DATABASE_URL}}` reference variable, plus copies of all app env vars (Railway inherits nothing from Replit).
- Project API validation rejects `null` optional fields — when copying data via POST, strip null entries first (PUT is 404, use PATCH).

**Why:** six consecutive deploy failures, each masking the next; changing any one piece reintroduces its failure.

# Plan B failover
- Emergency cabin at `/api/planb` (api-server route): phrase + Telegram OTP login, moves bot webhook between Railway (primary) and Replit backup (https://hello-hola.replit.app).
- Telegram bot @Resercher5x_bot is EXCLUSIVE to BioCasa (was detached from a Make.com webhook with user's consent). Webhook secret is HMAC-derived from the bot token — both servers compute it identically; no extra shared secret.
- Env needed on BOTH servers: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, PLANB_AUTH_PHRASE, PLANB_RAILWAY_URL, PLANB_REPLIT_URL.

## Base de datos compartida (taller ↔ Railway)
- Secret `RAILWAY_DATABASE_URL` quedó guardado SIN host:puerto (Railway lo copió como `...@:/railway` porque el Public Access no estaba activado al copiar).
- Fix: env no-secreto `RAILWAY_DB_HOST_PORT` (switchback.proxy.rlwy.net:18588) + `lib/db` (index.ts y drizzle.config.ts) reconstruye la URL reemplazando `@:/` por `@host:port/`. RAILWAY_DATABASE_URL tiene prioridad sobre DATABASE_URL.
- Consecuencia: los checkpoints de Replit YA NO respaldan los datos; la DB de Railway es la única fuente.
