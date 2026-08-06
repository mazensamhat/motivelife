# AGENTS.md

## Cursor Cloud specific instructions

This is a pnpm + Turborepo monorepo ("forward" / motivelife.ai). The product is the
Next.js web app in `apps/web`. See `README.md` and `docs/DEPLOY.md` for full docs; the
notes below only cover non-obvious, durable caveats for running it in Cloud VMs.

### Services / apps
- `apps/web` (`@forward/web`) — the product. Next.js 15 dev server on **port 3002**.
- `apps/motive-corp` (`@forward/motive-corp`) — secondary marketing site on port 3010.
  `pnpm dev` runs BOTH apps via turbo; only `apps/web` is needed to test the product.
- `apps/mobile` / `apps/mobile-eas` — native Capacitor/Expo shells (no dev server; not
  needed for local web development). `apps/mobile-eas` is excluded from the pnpm workspace.
- `packages/*` (`ai`, `database`, `marketing-agent`, `shared`) are libraries linked via
  `workspace:*` and built automatically.

### Database (required — must be started before running the app)
- The Prisma datasource provider is **PostgreSQL** (`packages/database/prisma/schema.prisma`).
  The SQLite fallback in `packages/database/src/index.ts` does NOT work with the generated
  Postgres client, so a real Postgres is required even in local dev.
- Postgres is installed in the VM image but is **not started automatically**. Start it each
  session before running the app:
  ```bash
  sudo service postgresql start
  ```
- A local role+database `forward` (password `forward`) is provisioned. Connection string used
  by the local env files: `postgresql://forward:forward@127.0.0.1:5432/forward`.
- Env files are gitignored and pre-created in the VM image: `apps/web/.env.local` and
  `packages/database/.env` (local Postgres URLs + a generated `AUTH_SECRET`,
  `ENABLE_OPENAI="false"`). If they go missing, recreate them from `.env.example` /
  `packages/database/.env.example` pointing at the local Postgres above, and set a random
  `AUTH_SECRET` (`openssl rand -base64 32`) — auth throws without it.
- After pulling schema changes, sync the DB: `pnpm db:push` (there are no Prisma migrations;
  schema is applied via `db push`). `pnpm db:generate` regenerates the client.

### Run / build / lint
- Dev: `pnpm dev` (web → http://localhost:3002, corp → http://localhost:3010).
- Build: `pnpm --filter @forward/web build`. **Caveat:** do NOT run a production build while
  `pnpm dev` is running against the same app — `next build` and `next dev` share `apps/web/.next`
  and the build corrupts the running dev server (ENOENT `_buildManifest.js.tmp...`). Stop dev
  first, or after building remove `apps/web/.next` (and `apps/motive-corp/.next`) and restart dev.
- Lint: **not configured.** `pnpm lint` / `next lint` has no ESLint config in `apps/web` and
  drops into an interactive setup prompt (which hangs in non-interactive shells). Lint is
  effectively unavailable until an ESLint config is added to the repo.

### AI / external services
- `ENABLE_OPENAI="false"` (and no `OPENAI_API_KEY`) → briefings/coach use rule-based fallbacks
  at $0. Stripe, Google/Apple OAuth, Resend, marketing/social integrations are all optional and
  degrade gracefully when their keys are absent; none are needed to run or test the core app.
