# Deploy MotiveLife to Production

**Stack:** GitHub → Vercel → Supabase → Stripe (live) → OpenAI (optional)

Estimated time: ~45 minutes.

---

## 1. Supabase (database)

1. Create a project at [supabase.com](https://supabase.com)
2. **Settings → Database → Connection string**
3. Copy **URI** (Transaction pooler, port **6543**) → `DATABASE_URL`
4. Copy **Direct connection** (port **5432**) → `DIRECT_URL`

Create `packages/database/.env`:

```env
DATABASE_URL="postgresql://postgres.[ref]:[password]@...pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.[ref]:[password]@...pooler.supabase.com:5432/postgres"
```

Push schema (once):

```powershell
cd C:\Users\Mazen\Documents\motivelife.ai
npx pnpm@9.15.0 db:generate
npx pnpm@9.15.0 db:push
```

---

## 2. GitHub

1. Create repo `motivelife.ai` (private recommended)
2. Push this project:

```powershell
cd C:\Users\Mazen\Documents\motivelife.ai
git init
git add .
git commit -m "Launch MotiveLife Pro"
git branch -M main
git remote add origin https://github.com/YOUR_USER/motivelife.ai.git
git push -u origin main
```

---

## 3. Vercel

1. [vercel.com](https://vercel.com) → **Add New Project** → import GitHub repo
2. **Root Directory:** `apps/web`
3. **Framework:** Next.js (auto-detected)
4. **Environment variables** (Production):

| Variable | Value |
|----------|--------|
| `DATABASE_URL` | Supabase pooled URL (6543) |
| `DIRECT_URL` | Supabase direct URL (5432) |
| `AUTH_SECRET` | Random 32+ chars (`openssl rand -base64 32`) |
| `NEXT_PUBLIC_APP_URL` | `https://your-domain.vercel.app` or custom domain |
| `STRIPE_SECRET_KEY` | **Live** key `sk_live_...` |
| `STRIPE_PRICE_ID` | **Live** price `price_...` for MotiveLife Pro |
| `STRIPE_WEBHOOK_SECRET` | From step 4 below |
| `OPENAI_API_KEY` | Optional |
| `ENABLE_OPENAI` | `true` or `false` |
| `ADMIN_EMAILS` | `samhatmazen@gmail.com` (comma-separated admins → `/admin` on login) |
| `NEXT_PUBLIC_MOTIVEFX_OPS_URL` | `https://motivefx.ai/?view=admin` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google Cloud OAuth (Calendar at `/integrations`) |

Register OAuth redirect: `https://YOUR_DOMAIN/api/integrations/google/callback`

See **`docs/INTEGRATIONS.md`** for Google Calendar setup.

5. **Deploy**

After first deploy, set `NEXT_PUBLIC_APP_URL` to the final URL and redeploy if you used a placeholder.

---

## 4. Stripe (live)

1. Stripe Dashboard → turn **Test mode OFF**
2. **Product catalog** → create **MotiveLife Pro** → **$14.99 CAD/month** (or your price)
3. Copy **live** `price_...` → `STRIPE_PRICE_ID` in Vercel
4. **Developers → API keys** → copy **live** secret → `STRIPE_SECRET_KEY`
5. **Developers → Webhooks → Add endpoint**
   - URL: `https://YOUR_DOMAIN/api/webhooks/stripe`
   - Events:
     - `checkout.session.completed`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
   - Copy **Signing secret** → `STRIPE_WEBHOOK_SECRET` in Vercel
6. **Settings → Billing → Customer portal** → enable (for “Manage billing”)
7. Redeploy Vercel after adding webhook secret

---

## 5. Custom domain (optional)

1. Vercel project → **Domains** → add `motivelife.ai`
2. Update DNS at your registrar (Vercel shows records)
3. Update `NEXT_PUBLIC_APP_URL` to `https://motivelife.ai`
4. Update Stripe webhook URL if domain changed
5. Redeploy

---

## 6. Smoke test (production)

- [ ] Register new account
- [ ] **Legal:** all required signup checkboxes must be checked; account blocked without them
- [ ] **Legal:** Terms (`/terms`) and Privacy (`/privacy`) load from footer and signup
- [ ] **Legal:** cookie notice appears once, dismisses on accept
- [ ] Dashboard loads
- [ ] Settings → Upgrade to Pro → Stripe Checkout (live card or test in live mode if enabled)
- [ ] Return to Settings → **MotiveLife Pro · active**
- [ ] Voice organize / AI briefing works (if OpenAI key set)
- [ ] `/privacy` and `/terms` load

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Build fails on Vercel | Root Directory must be `apps/web`; check build logs |
| Database errors | Run `db:push` with Supabase `DIRECT_URL`; verify pooled URL on Vercel |
| Stripe checkout fails | Live keys + live price ID from same account |
| Pro not active after pay | Webhook secret + endpoint URL; check Vercel function logs for `/api/webhooks/stripe` |
| Local dev after deploy | Point `packages/database/.env` + `apps/web/.env.local` at Supabase (or a separate dev project) |

---

## Local dev after Postgres switch

SQLite is no longer used. Use Supabase for local too (free tier), or create a second Supabase project for development.

Copy connection strings to:

- `packages/database/.env`
- `apps/web/.env.local` (include `DATABASE_URL`, `DIRECT_URL`, Stripe **test** keys for local)

---

## 7. Legal & signup compliance (before launch)

**Not legal advice** — have a lawyer review before going live in Canada and the US.

### What is already built

On **signup**, users must check all required boxes (submit is blocked otherwise; server also rejects missing consents):

| Checkbox | Covers |
|----------|--------|
| Terms of Service | Contract acceptance |
| Privacy Policy | Canada (PIPEDA) + US privacy notice |
| Age 13+ | COPPA / minimum age |
| AI / voice processing | OpenAI (US) data processing consent |
| Subscription billing | 14-day trial → $14.99 CAD/mo via Stripe |
| Marketing email (optional, unchecked) | CASL — Canada anti-spam |

Each signup stores `termsAcceptedAt`, `privacyAcceptedAt`, `legalConsentVersion`, and optional marketing consent in the database.

Also live:

- `/terms` and `/privacy` — full policy pages (footer + signup links)
- Site-wide **cookie notice** (dismissible)
- Disclaimer: not medical / legal / financial advice

### Your checklist before launch

1. **Run database migration** (legal columns + Postgres):

   ```powershell
   npx pnpm@9.15.0 db:generate
   npx pnpm@9.15.0 db:push
   ```

2. **Set real contact emails** in `apps/web/src/lib/legal.ts` (`privacy@`, `hello@`) — must be monitored inboxes.

3. **Lawyer review** of `/terms` and `/privacy` — confirm governing law, business entity name, refund policy, and provincial/state add-ons if needed.

4. **Bump `LEGAL_VERSION`** in `legal.ts` whenever Terms or Privacy change materially; consider re-consent for existing users later.

5. **Smoke test signup** — try submitting without checkboxes (must fail); with all checked (must succeed); confirm Terms/Privacy open in new tab.

6. **Stripe checkout** — price and trial shown at checkout must match `SUBSCRIPTION_DISCLOSURE` in `legal.ts`.

7. **Production cookie notice** — verify it appears once and dismisses on accept.

---

## 8. Admin ops console (owner login)

Same **Sign in** page as customers. Your email in `ADMIN_EMAILS` redirects to **`/admin`** instead of `/dashboard`.

1. Set in Vercel (and `apps/web/.env.local` for local):

   ```env
   ADMIN_EMAILS="your@email.com"
   ```

   Multiple admins: comma-separated, no spaces required.

2. Sign in at `/login` with that email → **MotiveLife Ops Console** opens automatically.

3. Console tracks: users, Pro/trial counts, MRR estimate, signups, AI usage, voice captures, legal consent versions, recent user table.

4. **Client app** link in the console header lets you preview the customer experience.

5. Non-admin users who visit `/admin` are redirected to `/dashboard`.
