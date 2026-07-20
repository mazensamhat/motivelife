# App Store resubmit checklist (MotiveLife)

> **July 20, 2026 rejection (1.0.4):** see **[APP_STORE_REJECT_2026-07-20.md](./APP_STORE_REJECT_2026-07-20.md)** for IAP submit, iOS-only screenshots, account-deletion recording, and reply text.

Use this after the App Review rejection (privacy, IAP, camera, mic, support, demo account).

## 1. Deploy web

Push `main` so Vercel deploys:

- Optional signup fields (no required generation / location / phone)
- `/support` page
- Life Coach text fallback when speech is unavailable
- Safer avatar resize + native shell Stripe → App Store IAP bridge
- Apple sync API + RevenueCat webhook

Then open https://www.mymotivelife.com/support and confirm it loads.

## 2. Database

```bash
npx pnpm@9.15.0 --filter @forward/database exec prisma db push
```

Adds `appleOriginalTransactionId`, `appleProductId`, `revenueCatAppUserId` on `User`.

## 3. App Store Connect (metadata)

1. **Age Ratings** → Age Assurance / In-App Controls → **None**
2. **Support URL** → `https://www.mymotivelife.com/support`
3. **App Review Information** → demo email + password for an account with **expired/cancelled** Pro
4. Create an **auto-renewable subscription** product (e.g. `motivelife_pro_monthly`, $14.99/mo) and submit it with the app

## 4. RevenueCat + IAP

1. Create a RevenueCat project → add iOS app `com.mymotivelife.app`
2. Link App Store Connect API key / shared secret
3. Create entitlement **`pro`**
4. Create a product linked to your ASC subscription + a default offering with a monthly package
5. Copy the **iOS public API key** (`appl_…`)
6. Set EAS secret: `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`
7. Set Vercel env: `REVENUECAT_WEBHOOK_SECRET` (random string)
8. RevenueCat → Webhooks → `https://www.mymotivelife.com/api/webhooks/revenuecat` with Bearer secret

## 5. Demo account for reviewers

1. Register `reviewer@…` on production
2. Expire trial / cancel Pro so the account shows expired state
3. Put credentials in App Review Information
4. Note: “Upgrade uses App Store In-App Purchase (Sandbox). Tap Upgrade to MotiveLife Pro.”

## 6. Build & submit iOS

```bash
cd apps/mobile-eas
npm install
eas secret:create --name EXPO_PUBLIC_REVENUECAT_IOS_API_KEY --value appl_… --scope project
eas build --platform ios --profile production
eas submit --platform ios --profile production
```

Binary should be **1.0.3+** (camera usage strings + RevenueCat).

## 7. Reply to App Review

- Age rating corrected (no in-app parental controls)
- Support URL updated
- Demo account in Review Information
- Camera crash fixed (usage descriptions + JPEG avatar path)
- Mic: type-to-coach fallback when Web Speech is unavailable in WKWebView
- Signup no longer requires generation / location / phone
- MotiveLife Pro is purchased via **In-App Purchase** in the iOS app
