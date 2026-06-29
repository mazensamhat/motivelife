# Stripe live payments — final checklist

Do this **once** in Stripe, then paste **3 values** into Vercel, redeploy. The **Admin → User management** panel shows a green/red Stripe checklist after deploy.

---

## 1. Stripe (Live mode)

1. [dashboard.stripe.com](https://dashboard.stripe.com) → turn **Test mode OFF** (live).
2. **Product catalogue** → **MotiveLife Pro** → **$14.99 CAD/month** → copy live `price_...`
3. **Developers → API keys** → copy **Secret key** `sk_live_...`
4. **Developers → Webhooks** → endpoint:
   ```
   https://www.mymotivelife.com/api/webhooks/stripe
   ```
   Events: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`
5. Copy **Signing secret** `whsec_...`
6. **Settings → Billing → Customer portal** → enabled

---

## 2. Vercel (3 variables)

| Key | Value |
|-----|--------|
| `STRIPE_SECRET_KEY` | `sk_live_...` |
| `STRIPE_PRICE_ID` | live `price_...` |
| `STRIPE_WEBHOOK_SECRET` | live `whsec_...` |

**All three must be LIVE** — not test keys.

Also: `NEXT_PUBLIC_APP_URL=https://www.mymotivelife.com`

**Redeploy.**

---

## 3. Verify in Admin

1. https://www.mymotivelife.com/admin
2. **User management** section → Stripe checklist should be all green
3. Settings → Upgrade to Pro → real card (live) or switch back to test for testing

---

## Test mode first (optional)

Use `sk_test_`, test `price_`, test `whsec_` — all from **Test mode ON** in Stripe. Same steps.

Card: `4242 4242 4242 4242`

---

## If Pro does not activate after payment

1. Stripe → Webhooks → Recent deliveries → must be **200**
2. Admin → User management → Stripe checklist
3. Admin → **Grant Pro** on user manually while debugging
4. Settings return URL must include `session_id` — app calls `/api/subscription/confirm` automatically
