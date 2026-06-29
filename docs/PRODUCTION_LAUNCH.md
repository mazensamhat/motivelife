# Production launch — www.mymotivelife.com

**Live preview:** https://motivelife-web.vercel.app  
**Target domain:** https://www.mymotivelife.com  
**Vercel project:** `motivelife-web` (root: `apps/web`)

Work through these steps in order. Check each box before going live on the custom domain.

---

## Step 1 — Custom domain (Vercel)

1. Open [Vercel → motivelife-web → Settings → Domains](https://vercel.com/dashboard)
2. Add **`www.mymotivelife.com`** → set as **primary** (redirect apex to www)
3. Add **`mymotivelife.com`** → Vercel will redirect to www
4. At your domain registrar (where you bought mymotivelife.com), add DNS:

| Type | Name | Value |
|------|------|--------|
| `CNAME` | `www` | `cname.vercel-dns.com` |
| `A` | `@` | `76.76.21.21` |

   *(Vercel may show slightly different records — use what the Domains UI displays.)*

5. Wait for DNS (often 5–30 min). Vercel shows **Valid Configuration** when ready.

---

## Step 2 — Environment variables (Vercel)

**Settings → Environment Variables → Production** (apply to Production only unless noted).

Copy values from your local `packages/database/.env` and `apps/web/.env.local` where marked.

| Variable | Value |
|----------|--------|
| `DATABASE_URL` | Supabase **pooled** URL (port **6543**, `?pgbouncer=true`) |
| `DIRECT_URL` | Supabase **direct** URL (port **5432**) |
| `AUTH_SECRET` | Random 32+ chars — generate: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `NEXT_PUBLIC_APP_URL` | **`https://www.mymotivelife.com`** |
| `ADMIN_EMAILS` | `samhatmazen@gmail.com` |
| `GOOGLE_CLIENT_ID` | From Google Cloud OAuth client |
| `GOOGLE_CLIENT_SECRET` | From Google Cloud OAuth client |
| `STRIPE_SECRET_KEY` | Start with **test** `sk_test_...` for smoke test, then switch to **live** `sk_live_...` |
| `STRIPE_PRICE_ID` | Your MotiveLife Pro price `price_...` (test or live, matching the key) |
| `STRIPE_WEBHOOK_SECRET` | From Step 4 below |
| `OPENAI_API_KEY` | Optional |
| `ENABLE_OPENAI` | `true` or `false` |
| `NEXT_PUBLIC_MOTIVEFX_OPS_URL` | `https://motivefx.ai/?view=admin` |
| `RESEND_API_KEY` | From [resend.com](https://resend.com) — required for password reset emails |
| `EMAIL_FROM` | `MotiveLife <hello@mymotivelife.com>` (after verifying domain in Resend) |

**Password reset:** Users use **Forgot your password?** on `/login`. Requires `RESEND_API_KEY` + verified sender domain.

**Important:** No square brackets around passwords in connection strings.

After saving env vars → **Deployments → Redeploy** (use latest commit, clear cache optional).

---

## Step 3 — Google OAuth (production)

1. [Google Cloud Console](https://console.cloud.google.com) → your project
2. **APIs & Services → Credentials** → your Web OAuth client
3. **Authorized redirect URIs** — add **both** (keep localhost for dev):

```
http://localhost:3002/api/integrations/google/callback
https://www.mymotivelife.com/api/integrations/google/callback
```

4. **OAuth consent screen** → if still in **Testing**, add production test users OR publish the app
5. Confirm **Google Calendar API** is enabled

No code change needed — redirect uses `NEXT_PUBLIC_APP_URL`.

---

## Step 4 — Stripe webhook

### Test mode first (recommended)

1. Stripe Dashboard → **Test mode ON**
2. **Developers → Webhooks → Add endpoint**
3. URL:

```
https://www.mymotivelife.com/api/webhooks/stripe
```

   *(Use `https://motivelife-web.vercel.app/api/webhooks/stripe` until custom domain is live.)*

4. Events to send:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `customer.subscription.trial_will_end` *(optional)*

5. Copy **Signing secret** → Vercel `STRIPE_WEBHOOK_SECRET`
6. **Settings → Billing → Customer portal** → enable (for “Manage billing” in Settings)
7. Redeploy Vercel

### Go live

1. Turn **Test mode OFF**
2. Create **live** MotiveLife Pro price ($14.99 CAD/mo) if not already
3. Update Vercel: `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, new **live** webhook + `STRIPE_WEBHOOK_SECRET`
4. Redeploy

---

## Step 5 — Smoke test

Run on **https://www.mymotivelife.com** (or `motivelife-web.vercel.app` before DNS).

| Test | Expected |
|------|----------|
| Landing `/` | Hero, pricing, cookie banner |
| `/terms`, `/privacy` | Load from footer and signup |
| Register | All required checkboxes enforced |
| Login → `/dashboard` | Dashboard loads |
| Login as admin | Redirects to `/admin` |
| Settings → Upgrade | Stripe Checkout opens |
| After checkout | Settings shows **MotiveLife Pro · active** |
| `/integrations` | Connect Google Calendar succeeds |
| Cookie notice | Shows once, dismisses on “Got it” |

---

## Quick links

| Service | URL |
|---------|-----|
| Vercel project | https://vercel.com/dashboard |
| GitHub repo | https://github.com/mazensamhat/motivelife |
| Supabase | https://supabase.com/dashboard |
| Google Cloud | https://console.cloud.google.com |
| Stripe | https://dashboard.stripe.com |

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Domain not resolving | Wait for DNS; confirm CNAME/A at registrar |
| OAuth redirect mismatch | Redirect URI must match `NEXT_PUBLIC_APP_URL` + `/api/integrations/google/callback` exactly |
| Pro not active after pay | Check webhook secret, endpoint URL, Vercel function logs for `/api/webhooks/stripe` |
| Database errors | Verify `DATABASE_URL` / `DIRECT_URL` on Vercel; run `db:push` locally with `DIRECT_URL` |
| Google “access blocked” | Add user as test user or publish OAuth consent screen |
