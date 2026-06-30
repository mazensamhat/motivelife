# Production ops checklist

Work through in order. Green boxes in **Admin → User management** confirm Stripe and email.

---

## 1. Change password (signed in)

**Where:** https://www.mymotivelife.com/settings → **Password**

1. Enter current password
2. New password (8+ characters) + confirm
3. Click **Update password**

Works today — no extra setup.

---

## 2. Forgot password (signed out)

**Where:** https://www.mymotivelife.com/login → **Forgot your password?**

Requires **Resend** (steps below). Until then, admins can set passwords in **Admin → User management → Password**.

### Resend setup (~10 min)

1. Sign up at [resend.com](https://resend.com)
2. **Domains → Add domain** → `mymotivelife.com`
3. Add the DNS records Resend shows (at Network Solutions, same place as Vercel DNS)
4. Wait until domain shows **Verified**
5. **API Keys → Create** → copy key (`re_...`)
6. **Vercel → motivelife-web → Environment Variables → Production:**

| Key | Value |
|-----|--------|
| `RESEND_API_KEY` | `re_...` |
| `EMAIL_FROM` | `MotiveLife <hello@mymotivelife.com>` |

7. **Redeploy**
8. **Admin → User management** → **Password reset email** box should be green
9. Click **Send test email** → check inbox
10. Test **Forgot your password?** on `/login`

---

## 3. Manage billing (Stripe portal)

**Where:** Settings → **Manage billing**

- Update card, view invoices, cancel
- Requires live Stripe (already done)
- Creates/links Stripe customer on first open if missing

---

## 4. Admin user management

**Where:** https://www.mymotivelife.com/admin → **User management**

| Action | Use when |
|--------|----------|
| **Password** | Set a user’s password manually |
| **Grant Pro** | Comp access or fix webhook miss |
| **Revoke Pro** | Remove Pro without Stripe |
| **Disable** | Block login (not for admin accounts) |

**Cleanup:** Test accounts (`*@motivelife.test`) — run `pnpm db:delete-test-users` or disable in Admin.

---

## Vercel Analytics

1. Code includes `@vercel/analytics` (auto after deploy).
2. [Vercel → motivelife-web → Analytics](https://vercel.com) → **Enable**.
3. View traffic: **Admin → Website traffic** or Vercel Analytics tab.

---

## Resend — Enable Receiving (optional inbound mail)

For `hello@mymotivelife.com` to receive replies:

1. **Resend → Domains → mymotivelife.com** → turn **Enable Receiving** ON.
2. Copy the **MX** record (Name `@`, points to `inbound-smtp...amazonses.com`, Priority `10`).
3. **Network Solutions → Advanced DNS Records → Add:**
   - Type: **MX**
   - Host: `@`
   - Mail server: value from Resend
   - Priority: **10**
4. Wait for **Verified** in Resend (does not affect website A/CNAME records).

Password **sending** already works; receiving is only for inbound email.

---

## 5. Stripe live (done)

Admin checklist should show **Stripe live mode — ready for payments**.

If a paying customer doesn’t get Pro automatically:

1. Stripe → Webhooks → recent deliveries → **200**
2. Admin → **Grant Pro** as fallback

---

## 6. Database backup

**Supabase (automatic):** Dashboard → **Database** → **Backups**. Free tier keeps limited history; Pro adds daily backups and point-in-time recovery.

**Manual dump (recommended before big schema changes):**

```powershell
cd packages\database
npm run db:backup
```

Requires `pg_dump` (install [PostgreSQL command-line tools](https://www.postgresql.org/download/windows/) or Docker + `npx supabase db dump`). Dumps land in `packages/database/backups/` (gitignored).

**After deploying schema changes** (e.g. new `Notification` table):

```powershell
cd packages\database
npm run db:push:prod
```

---

## Vercel Production env (full list)

| Variable | Required for |
|----------|----------------|
| `DATABASE_URL` / `DIRECT_URL` | Login, all data |
| `AUTH_SECRET` | Sessions |
| `ADMIN_EMAILS` | Admin access |
| `NEXT_PUBLIC_APP_URL` | OAuth, emails, Stripe return URLs |
| `STRIPE_SECRET_KEY` / `STRIPE_PRICE_ID` / `STRIPE_WEBHOOK_SECRET` | Billing |
| `RESEND_API_KEY` / `EMAIL_FROM` | Forgot password |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Calendar |
