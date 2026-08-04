# Stripe + Google — step-by-step (production)

Do these in order. Use **Test mode** in Stripe until checkout works end-to-end.

Production URL: **https://www.mymotivelife.com**

---

## Part A — Stripe (payments)

### A1. Create three products (Stripe Dashboard)

1. Go to [dashboard.stripe.com](https://dashboard.stripe.com)
2. Top right: turn **Test mode ON** (orange toggle)
3. **Product catalog** → create these **three** recurring CAD monthly prices:

| Product name | Price | Env var |
|--------------|-------|---------|
| `MotiveLife Pro` | **14.99 CAD / month** | `STRIPE_PRICE_ID` |
| `MyMotiveFamily` | **19.99 CAD / month** | `STRIPE_FAMILY_PRICE_ID` |
| `MotiveLife Family Pro Upgrade` | **9.99 CAD / month** | `STRIPE_MEMBER_PRO_PRICE_ID` |

4. For each: open the product → price → copy **Price ID** (`price_...`) into Notepad

**Product notes (keep marketing + Stripe aligned):**
- **Pro:** Website offers a **14-day free trial on signup (no card)**. Stripe Checkout only attaches remaining trial days when someone converts during that window.
- **Family Map Free** (live map + speed) is **not** a Stripe product — freemium in the app.
- **MyMotiveFamily $19.99** unlocks Family Intelligence for the household and includes full Pro for the owner. Invited members get Family free.
- **Family Pro Upgrade $9.99** is for invited members of an **active** MyMotiveFamily household only (no trial — map access is already free). This is full personal Pro at a household discount vs $14.99 — **do not** sell full Pro for $5 (arbitrage hole).
- If an old **$5.00** Member Pro price exists, archive it and point `STRIPE_MEMBER_PRO_PRICE_ID` at the new **$9.99** price.

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
| `STRIPE_PRICE_ID` | Pro `price_...` ($14.99) |
| `STRIPE_FAMILY_PRICE_ID` | Family `price_...` ($19.99) |
| `STRIPE_MEMBER_PRO_PRICE_ID` | Family Pro Upgrade `price_...` ($9.99) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` from A4 |

3. Confirm `NEXT_PUBLIC_APP_URL` = `https://www.mymotivelife.com`
4. **Deployments** → latest → **⋯** → **Redeploy**

### A6. Test checkout (all three)

Use test card `4242 4242 4242 4242`, any future expiry, any CVC.

1. **Pro:** Sign up → Settings → Upgrade to Pro → pay → plan `plus` active  
2. **Family:** Settings → Unlock Family Intelligence → pay → plan `family` active; Family Map intelligence unlocks  
3. **Family Pro Upgrade $9.99:** Second account joins via invite while owner has Family → Settings → Family Pro Upgrade → plan `plus` for that member only  
4. Stripe → **Webhooks** → endpoint → **Recent deliveries** = succeeded for each

### A7. Go live (when ready for real money)

1. Stripe: turn **Test mode OFF**
2. Create **live** prices for Pro ($14.99), Family ($19.99), Family Pro Upgrade ($9.99)
3. Create **new live webhook** (same URL, same events) → new `whsec_...`
4. Vercel: replace with `sk_live_...`, all three live `price_...`, live `whsec_...`
5. Redeploy

---

## Part B — Google Calendar

### B1. Google Cloud project — **MotiveLife only**

**Do not use MotiveFX, MotivePulse IQ, or MotiveIQ projects for this.**

Production Sign-In / Calendar already use this Web client:

```
176555209052-mhpuogi8gcqecstegqfne26d4gbsj88d.apps.googleusercontent.com
```

**Project number to select:** `176555209052`

1. [console.cloud.google.com](https://console.cloud.google.com)
2. Project picker (top bar) → search `176555209052` → select that project
3. Confirm **Credentials** shows the client id ending in `mhpuogi8gcqecstegqfne26d4gbsj88d`

Full click-by-click guide (Google + Apple): **[AUTH_SIGNIN_SETUP.md](./AUTH_SIGNIN_SETUP.md)**

4. **APIs & Services** → **OAuth consent screen** — External, app name MotiveLife, support email set

**Critical for Sign in with Google (GIS):** under that same Web client → **Authorized JavaScript origins** add:

```
https://www.mymotivelife.com
http://localhost:3002
```

Without those origins the Google button on `/login` will not complete.

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
3. **Authorized redirect URIs** — add both (Calendar + shared Sign-In):
   ```
   http://localhost:3002/api/integrations/google/callback
   https://www.mymotivelife.com/api/integrations/google/callback
   ```
   Sign-In with Google uses **Google Identity Services** (ID token) on `/login` and `/register`.
That requires **Authorized JavaScript origins** (not a new redirect URI):

```
https://www.mymotivelife.com
http://localhost:3002
```

The redirect-based flow remains as a fallback and reuses the Calendar callback URI when configured.
4. Save → copy **Client ID** and **Client secret**

### B5. Add to Vercel

| Key | Value |
|-----|--------|
| `GOOGLE_CLIENT_ID` | `....apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | `GOCSPX-...` |
| `GOOGLE_AUTH_REDIRECT_URI` | Optional. Leave unset to reuse the Calendar callback URI. |

Redeploy.

### B6. Test

1. https://www.mymotivelife.com/integrations
2. **Connect Google Calendar**
3. Approve → should show connected
4. https://www.mymotivelife.com/login → **Google** → account picker → signed in

### B7. Sign in with Apple (optional)

In Apple Developer → Identifiers → Services ID for the web app:

1. Enable **Sign in with Apple**
2. Return URL: `https://www.mymotivelife.com/api/auth/apple/callback`
3. Create a Sign in with Apple key (`.p8`) and note Key ID + Team ID

| Key | Value |
|-----|--------|
| `APPLE_SIGNIN_CLIENT_ID` | Services ID (e.g. `com.mymotivelife.web`) |
| `APPLE_SIGNIN_TEAM_ID` | 10-char Team ID |
| `APPLE_SIGNIN_KEY_ID` | Key ID |
| `APPLE_SIGNIN_PRIVATE_KEY` | Full `.p8` PEM (use `\n` for newlines in Vercel) |
| `APPLE_SIGNIN_REDIRECT_URI` | Optional override for the Return URL |

Buttons appear on `/login` and `/register` only when the provider is configured.

**Ops note:** Google Sign-In works as soon as Calendar OAuth is configured. Apple requires the Services ID + key above — without those env vars, only Google shows.

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
