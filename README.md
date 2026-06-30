# motivelife.ai — Life Intelligence Platform

**Your AI partner for a better life** — a consumer web app to help people make better life decisions every day.

This repository is a **greenfield project**. Forward is not related to MotiveIQ, motivefx.ai, or any other existing product.

## Stack

**Launch target — four services, nothing else:**

```
GitHub  →  Vercel  →  Supabase  →  OpenAI (optional)
```

| Layer | Technology | Cost at launch |
|-------|------------|----------------|
| Code | GitHub | Free |
| Hosting | **Vercel** (one Next.js app) | Free tier |
| Database | **Supabase** Postgres via Prisma | Free tier |
| AI | **OpenAI** `gpt-4o-mini` — optional | ~$0 without key; ~1 call/user/day when enabled |
| Monorepo | pnpm + Turborepo (build only — not separate services) | Free |

### What we are NOT building

| Not building | Why |
|--------------|-----|
| AWS | Vercel + Supabase cover hosting + DB |
| Microservices | One Next.js app; “API routes” are folders, not separate servers |
| Kubernetes | Vercel handles scaling |
| Redis / RabbitMQ / queues | Postgres + daily briefing cache is enough |
| ElasticSearch | Postgres queries + rule-based agents |
| 20+ separate APIs | ~30 `/api/*` routes live inside **one** deployable app |

### OpenAI cost control

- **No `OPENAI_API_KEY`** → rule-based briefing, hero, coach ($0)
- **`ENABLE_OPENAI=false`** → forces AI off even if a key exists
- **When enabled:** one cached `gpt-4o-mini` call per user per day (stored in `DailyBriefing`)
- Goal decomposition, streaks, Life Graph, scores → **no LLM** (rule-based)

| Layer (dev) | Technology |
|-------|------------|
| Web app | Next.js 15, React 19, Tailwind CSS 4 |
| Database | Prisma + **Supabase Postgres** (SQLite was dev-only; use Supabase free tier locally too) |
| AI | Rule-based agents + optional OpenAI enhancement |
| Monorepo | pnpm workspaces + Turborepo |

## Project Structure

```
forward/
├── apps/
│   ├── web/              # Next.js web app + API
│   └── mobile/           # Capacitor shell (iOS + Android → loads mymotivelife.com)
├── packages/
│   ├── database/         # Prisma schema (Progress Graph v1)
│   ├── ai/               # Briefing & suggestion agents
│   └── shared/           # Shared types & constants
└── docs/
    └── FORWARD-FOUNDERS-BLUEPRINT.md
```

## Isolation from MotiveFX / MotiveIQ

Forward is **fully separate** from your other projects. Nothing is shared unless you manually connect them.

| | Forward | MotiveFX / MotiveIQ |
|---|---------|---------------------|
| **Folder** | `motivelife.ai/` | Their own folders |
| **Database** | Supabase Postgres (via Prisma) | Their own DB |
| **Env file** | `apps/web/.env.local` | Their own `.env` |
| **Dependencies** | Own `node_modules` | Own `node_modules` |
| **Dev port** | **3002** (by design) | Often 3000 or other |
| **Code / git** | No imports or links | Independent |

You can run all projects at the same time. The only thing that would conflict is **two apps trying to use the same port** — Forward avoids that by using 3002.

---

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+

### Setup (Windows)

Open PowerShell in the Forward project folder:

```powershell
cd C:\Users\Mazen\Documents\motivelife.ai

# Install dependencies (pnpm not required globally)
npx pnpm@9.15.0 install

# First-time only: create tables in Supabase (needs DATABASE_URL + DIRECT_URL in packages/database/.env)
npx pnpm@9.15.0 db:generate
npx pnpm@9.15.0 db:push

# Start Forward (port 3002)
npx pnpm@9.15.0 dev
```

If `apps/web/.env.local` does not exist yet, copy from the example:

```powershell
Copy-Item .env.example apps\web\.env.local
```

Then edit `apps/web/.env.local` and set a unique `AUTH_SECRET`.

> **Important:** After pulling new features, run `npx pnpm@9.15.0 db:push` once so new tables (e.g. Career) are created in the same database the app uses.

Open [http://localhost:3002](http://localhost:3002)

> Forward runs on **port 3002** by default so it does not conflict with MotiveFX, MotiveIQ, or other apps on port 3000.

### Environment Variables

Copy `.env.example` → `apps/web/.env.local` and set Supabase URLs from your project dashboard.

```env
DATABASE_URL="postgresql://...6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://...5432/postgres"
AUTH_SECRET="your-random-32-char-secret"
OPENAI_API_KEY=""          # optional — leave empty for $0 AI at launch
ENABLE_OPENAI="true"       # set "false" to freeze AI spend
NEXT_PUBLIC_APP_URL="http://localhost:3002"
```

Generate a secret: `openssl rand -base64 32`

### Deploy to Vercel

Full step-by-step: **[docs/DEPLOY.md](docs/DEPLOY.md)**

Quick summary:

1. Create **Supabase** project → run `pnpm db:push` once with `DATABASE_URL` + `DIRECT_URL`
2. Push repo to **GitHub**
3. Import in **Vercel** — Root Directory: **`apps/web`**
4. Add env vars (see `docs/DEPLOY.md`)
5. **Stripe live** webhook → `https://your-domain/api/webhooks/stripe`
6. Deploy and smoke-test register → upgrade → Pro active

## MVP Features (v0.1)

- User registration & authentication
- **Morning Briefing** — daily priorities, mission, suggested action
- **Evening Review** — completed tasks, highlight, tomorrow's priority
- **Progress snapshot** — Lives Moved Forward metric
- **Progress Graph v1** — goals across life domains
- **Tasks** — linked to goals, priorities, Today's Mission
- **Memory** — user-controlled facts Forward remembers
- **Career Agent** — job application pipeline, interview prep checklist + proactive suggestions
- **Money Agent** — savings goals, debt, bills + proactive suggestions
- **Weekly Review** — Sunday tab on Today; wins and focus areas for the week ahead
- **Google Calendar** — optional OAuth at Connect; Calendar Agent in briefings
- **Habits** — daily/weekly check-ins with streak tracking
- **Health Agent** — sleep, fitness, nutrition, wellness targets
- **Learning Agent** — courses, books, skills with progress tracking
- **Monthly Review** — goal check-ins on the 1st of each month
- **Gmail** — important unread messages in suggestions (via Google OAuth)
- **Task Agent** — break goals into actionable tasks from the Goals page
- First-run onboarding for new users
- Calm, action-focused UI aligned with brand guidelines

## Documentation

- [Founder's Blueprint](docs/FORWARD-FOUNDERS-BLUEPRINT.md) — strategy, product philosophy, roadmap

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start web dev server |
| `pnpm build` | Build all packages |
| `pnpm db:generate` | Generate Prisma client |
| `pnpm db:push` | Push schema to database |
| `pnpm db:studio` | Open Prisma Studio |

## Status

**v0.1 — Foundation.** Web app MVP in active development. Mobile app coming in a future release.
