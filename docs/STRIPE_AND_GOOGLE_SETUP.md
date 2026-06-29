# Stripe + Google — step-by-step (production)

Do these in order. Use **Test mode** in Stripe until checkout works end-to-end.

Production URL: **https://www.mymotivelife.com**

---

## Part A — Stripe (payments)

### A1. Create your product (Stripe Dashboard)

1. Go to [dashboard.stripe.com](https://dashboard.stripe.com)
2. Top right: turn **Test mode ON** (orange toggle)
3. **Product catalog** → **+ Add product**
4. Fill in:
   - **Name:** `MotiveLife Pro`
   - **Description:** optional
   - **Pricing:** Recurring
   - **Price:** `14.99` **CAD** / **Monthly**
5. Click **Save product**
6. Open the product → click the price → copy **Price ID** (`price_...`) — save in Notepad

### A2. Get API keys

1. **Developers** → **API keys**
2. Copy **Secret key** → `sk_test_...` (NOT the publishable `pk_` key)

### A3. Enable Customer Portal (manage billing)

1. **Settings** (gear) → **Billing** → **Customer portal**
2. Click **Activate** / **Enable**
3. Save — users use this from Settings → Manage billing

### A4. Create webhook

1. **Developers** → **Webhooks** → **Add endpoint**
2. **Endpoint URL:**
   ```
   https://www.mymotivelife.com/api/webhooks/stripe
   ```
3. **Select events:**
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. **Add endpoint**
5. Open the new endpoint → **Signing secret** → Reveal → copy `whsec_...`

### A5. Add to Vercel

1. [vercel.com](https://vercel.com) → **motivelife-web** → **Settings** → **Environment Variables**
2. Add (Production):

| Key | Value |
|-----|--------|
| `STRIPE_SECRET_KEY` | `sk_test_...` |
| `STRIPE_PRICE_ID` | `price_...` from A1 |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` from A4 |

3. Confirm `NEXT_PUBLIC_APP_URL` = `https://www.mymotivelife.com`
4. **Deployments** → latest → **⋯** → **Redeploy**

### A6. Test checkout

1. Sign in at https://www.mymotivelife.com
2. **Settings** → **Upgrade to Pro** (or similar)
3. Stripe Checkout opens — use test card: `4242 4242 4242 4242`, any future expiry, any CVC
4. After payment → return to Settings → should show **MotiveLife Pro · active**
5. In Stripe → **Developers** → **Webhooks** → your endpoint → check **Recent deliveries** = succeeded

### A7. Go live (when ready for real money)

1. Stripe: turn **Test mode OFF**
2. Create **live** MotiveLife Pro price ($14.99 CAD/mo) if needed
3. Create **new live webhook** (same URL, same events) → new `whsec_...`
4. Vercel: replace with `sk_live_...`, live `price_...`, live `whsec_...`
5. Redeploy

---

## Part B — Google Calendar

### B1. Google Cloud project

1. [console.cloud.google.com](https://console.cloud.google.com)
2. Select your project (or create **MotiveLife**)

### B2. Enable Calendar API

1. **APIs & Services** → **Library**
2. Search **Google Calendar API** → **Enable**

### B3. OAuth consent screen

1. **APIs & Services** → **OAuth consent screen**
2. **External** → fill app name **MotiveLife**, support email
3. **Scopes** → add `https://www.googleapis.com/auth/calendar.readonly`
4. **Test users** → add `samhatmazen@gmail.com` (and any testers)
5. Save

*(Before public launch: submit for verification or keep test users only.)*

### B4. OAuth credentials

1. **APIs & Services** → **Credentials**
2. **+ Create credentials** → **OAuth client ID** → **Web application**
3. **Authorized redirect URIs** — add both:
   ```
   http://localhost:3002/api/integrations/google/callback
   https://www.mymotivelife.com/api/integrations/google/callback
   ```
4. Save → copy **Client ID** and **Client secret**

### B5. Add to Vercel

| Key | Value |
|-----|--------|
| `GOOGLE_CLIENT_ID` | `....apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | `GOCSPX-...` |

Redeploy.

### B6. Test

1. https://www.mymotivelife.com/integrations
2. **Connect Google Calendar**
3. Approve → should show connected

---

## Part C — Quick test checklist

- [ ] Stripe Checkout opens from Settings
- [ ] Test payment → Pro active in Settings
- [ ] Webhook delivery succeeded in Stripe
- [ ] Google Calendar connects on Integrations
- [ ] Morning briefing / calendar-aware features work (optional)

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| “Stripe is not configured” | `STRIPE_SECRET_KEY` + `STRIPE_PRICE_ID` in Vercel, redeploy |
| “Invalid API Key” | Use `sk_test_` secret key, not `pk_` |
| “No such price” | Price ID from same Stripe account + test/live mode match |
| Pro not active after pay | Webhook URL + `STRIPE_WEBHOOK_SECRET`, check Vercel logs |
| Google redirect error | Redirect URI must match exactly, including `https://www` |
| Google access blocked | Add email under OAuth test users |
