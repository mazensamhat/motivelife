# What each service does — MotiveLife stack

Plain-language guide to every external tool in this project: what it is, what it’s responsible for, and what happens if it’s missing.

---

## The big picture

```
You (browser)
    ↓
Vercel          → hosts the website & API
    ↓
Supabase        → stores users, goals, tasks, etc.
    ↓
(Optional) OpenAI, Stripe, Google, Resend — only when you use those features
```

**GitHub** holds your code. **Vercel** runs it. **Supabase** remembers your data. Everything else plugs in for specific features.

---

## 1. GitHub

| | |
|---|---|
| **What it is** | Where your source code lives (`github.com/mazensamhat/motivelife`) |
| **What it does** | Version control, backup, triggers Vercel deploys when you push to `main` |
| **You pay** | Free for private repos (within limits) |
| **If missing** | No automatic deploys; you’d upload code manually |
| **Your action** | Push code when we fix things; Vercel pulls from here |

---

## 2. Vercel

| | |
|---|---|
| **What it is** | Hosting for Next.js — runs `motivelife-web` in the cloud |
| **What it does** | Serves pages (`/`, `/dashboard`, `/login`), runs API routes (`/api/auth/login`, `/api/goals`, …), SSL for `www.mymotivelife.com`, env vars for secrets |
| **You pay** | Hobby (free) — fine for launch |
| **If missing** | Site is not on the internet |
| **Key settings** | Root directory `apps/web`, env vars, custom domain |

**Responsible for:** speed, HTTPS, deploying new code, keeping the app online 24/7.

**Not responsible for:** storing your database (that’s Supabase), charging cards (Stripe), sending email (Resend).

---

## 3. Supabase (PostgreSQL database)

| | |
|---|---|
| **What it is** | Managed PostgreSQL database in the cloud |
| **What it does** | Stores users, passwords (hashed), goals, tasks, habits, subscriptions status, legal consents, Google tokens, etc. |
| **You pay** | Free tier to start |
| **If missing** | Login, register, dashboard all fail — “database” errors |
| **Two URLs** | `DATABASE_URL` (pooled, port 6543) for the app; `DIRECT_URL` (port 5432) for schema migrations |

**Responsible for:** all persistent data — who signed up, what goals they have, Pro vs trial.

**Not responsible for:** running the website UI (Vercel does that).

**Important:** Local dev and production share the same data **only if** both use the same Supabase URLs. That’s why “email already registered” appeared — your account was already in Supabase from local signup.

---

## 4. Network Solutions (domain registrar)

| | |
|---|---|
| **What it is** | Where you bought `mymotivelife.com` |
| **What it does** | DNS only — tells the internet “`www` goes to Vercel”, “`@` goes to Vercel” |
| **You pay** | Annual domain renewal |
| **If misconfigured** | Domain doesn’t reach Vercel |
| **Ignore** | “Connect Website / Email / Hosting” buttons — those are for *their* products, not Vercel |

**Responsible for:** owning the name and DNS records.

**Not responsible for:** hosting the app (Vercel does).

---

## 5. Stripe

| | |
|---|---|
| **What it is** | Payment processor |
| **What it does** | MotiveLife Pro checkout ($14.99 CAD/mo), 14-day trial, customer billing portal, webhooks to mark users “Pro active” in Supabase |
| **You pay** | Per transaction (~2.9% + fee) when customers pay |
| **If missing** | App works; upgrade to Pro in Settings fails or stays in trial |
| **Keys** | `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET` |

**Responsible for:** money — cards, subscriptions, invoices, cancel/refund flows.

**Webhook:** Stripe calls `https://www.mymotivelife.com/api/webhooks/stripe` when someone pays so your database updates without you clicking anything.

**Test vs live:** `sk_test_` / test prices for testing; `sk_live_` for real money.

---

## 6. Google Cloud (OAuth)

| | |
|---|---|
| **What it is** | Google’s developer console for OAuth |
| **What it does** | Lets users connect **Google Calendar** at `/integrations` — read-only calendar for briefings |
| **You pay** | Free for Calendar API at your scale |
| **If missing** | Everything works except “Connect Google Calendar” |
| **Keys** | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| **Redirect URI** | Must exactly match: `https://www.mymotivelife.com/api/integrations/google/callback` |

**Responsible for:** user consent + access tokens to read their calendar.

**Not responsible for:** Gmail, login with Google (we use email/password + our own auth).

---

## 7. OpenAI (optional)

| | |
|---|---|
| **What it is** | AI API (GPT) |
| **What it does** | Morning briefing, voice organize, coaching suggestions when `ENABLE_OPENAI=true` |
| **You pay** | Per API usage |
| **If missing** | Rule-based features still work; AI features fall back or disable |
| **Keys** | `OPENAI_API_KEY`, `ENABLE_OPENAI` |

**Responsible for:** smart text generation from user’s goals/tasks/voice.

**Not responsible for:** login, payments, hosting.

---

## 8. Resend (optional — for password reset email)

| | |
|---|---|
| **What it is** | Transactional email API |
| **What it does** | Sends “reset your password” links from `/forgot-password` |
| **You pay** | Free tier (3k emails/mo) |
| **If missing** | Forgot-password emails don’t send (we use a local admin script instead for now) |
| **Keys** | `RESEND_API_KEY`, `EMAIL_FROM` |

**Responsible for:** delivering password-reset and future emails (receipts, etc.).

**Not responsible for:** user inbox hosting (that’s Google Workspace / Network Solutions email if you add it later).

---

## 9. MotiveFX Ops URL (optional)

| | |
|---|---|
| **What it is** | Link from `/admin` to external ops tool |
| **Env** | `NEXT_PUBLIC_MOTIVEFX_OPS_URL` |
| **If missing** | Admin console still works; external link may be wrong |

---

## Environment variables — cheat sheet

| Variable | Service | Required at launch? |
|----------|---------|---------------------|
| `DATABASE_URL` | Supabase | **Yes** |
| `DIRECT_URL` | Supabase | **Yes** (migrations) |
| `AUTH_SECRET` | Your app (sessions) | **Yes** |
| `NEXT_PUBLIC_APP_URL` | Your app (links) | **Yes** |
| `ADMIN_EMAILS` | Your app | **Yes** (for you) |
| `STRIPE_*` | Stripe | For paid Pro |
| `GOOGLE_*` | Google | For Calendar only |
| `OPENAI_API_KEY` | OpenAI | Optional |
| `RESEND_API_KEY` | Resend | Optional (password email) |

`AUTH_SECRET` is not a third-party signup — it’s a random string **you** generate so login cookies are secure. Set once in Vercel and keep it secret.

---

## What happens when a user signs up

1. **Browser** → `POST /api/auth/register` on **Vercel**
2. **Vercel** hashes password, writes user to **Supabase**
3. **Vercel** sets session cookie (signed with `AUTH_SECRET`)
4. User sees **dashboard** — data loads from **Supabase** on each request

No Stripe until they click Upgrade. No Google until Integrations. No OpenAI until they use AI features (if enabled).

---

## What you need to supervise vs set-and-forget

| Service | Ongoing attention |
|---------|-------------------|
| **Vercel** | Redeploy after env changes; check deploy logs if site breaks |
| **Supabase** | Backups on paid plan; watch free-tier limits; `db:push` when schema changes |
| **Stripe** | Switch test→live; watch failed payments; webhook must stay valid |
| **Google Cloud** | Publish OAuth app before public launch; verify redirect URIs |
| **Domain** | Renew yearly; don’t delete DNS records |
| **OpenAI** | Watch spend if enabled |
| **Resend** | Verify domain for production email |

---

## Admin password reset (without email)

Run locally (uses `packages/database/.env` → same Supabase as production):

```powershell
cd C:\Users\Mazen\Documents\motivelife.ai
npx pnpm@9.15.0 db:reset-password samhatmazen@gmail.com
```

Prints a temporary password. Sign in at https://www.mymotivelife.com/login
