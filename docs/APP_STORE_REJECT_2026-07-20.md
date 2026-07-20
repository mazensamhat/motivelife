# App Store rejection — July 20, 2026 (1.0.4 / build 8)

Submission ID: `e36c5f85-b243-4b67-bf56-01cdf2c7eb36`  
Device: iPad Air 11-inch (M3)

Apple cited three guidelines. Fix **all three** before the next submit.

---

## What we fixed in code (this PR)

| Guideline | Code change |
|-----------|-------------|
| **5.1.1** Account deletion | Settings → **Delete account** (type `DELETE` + password). API: `POST /api/account/delete`. `/data-deletion`, Privacy, Support point to in-app deletion. |
| **2.3.10** Android / Play in binary | iOS shell injects `__MOTIVELIFE_NATIVE_PLATFORM__ = "ios"`. Health Connect / phone-health UI hidden on iOS. Landing store banner hidden in native shell. Integrations + marketing copy no longer say “Health Connect (Android)” in iOS-visible paths. |
| **2.1(b)** IAP not submitted | **You** must submit IAP products in App Store Connect with the new binary (steps below). |

Ship binary: **1.0.4 (11)** via EAS after web is live on Vercel.
(Stay on the rejected **1.0.4** version in App Store Connect → use **Update Review**. Do not create a new version.)

---

## A. Deploy web first

1. Merge this branch to `main`.
2. Wait for Vercel production deploy of https://www.mymotivelife.com
3. Confirm while signed in:
   - Settings shows **Delete account**
   - `/data-deletion` describes Settings → Delete account

---

## B. App Store Connect — submit In-App Purchases (2.1(b))

Apple blocked review because subscriptions are referenced but **IAP products were not submitted for review**.

1. Open [App Store Connect](https://appstoreconnect.apple.com) → **MotiveLife** → **Subscriptions** (or **Monetization** → **Subscriptions**).
2. Ensure your auto-renewable group exists (e.g. MotiveLife Pro) with a monthly product (e.g. `motivelife_pro_monthly`, **$14.99 CAD** or your listed price).
3. For **each** subscription product:
   - Complete **localization** (display name + description).
   - Add a **Review screenshot** (required): capture the paywall / Upgrade screen on iPhone showing MotiveLife Pro and the price. Upload under the product’s App Review Information.
   - Set status so it can be submitted (Ready to Submit).
4. When you create the new app version (1.0.4 (build 11)), on the version page under **In-App Purchases and Subscriptions**, **add** the subscription product(s) to the version.
5. Submit the **app version + IAP together** in one review.

If products already exist but were never attached to a version, attaching them and resubmitting with a new binary is the fix.

---

## C. Replace screenshots (2.3.10)

**Ready-made iOS pack (this repo):** `apps/mobile/assets/app-store/upload/`  
**Click-by-click guide:** `apps/mobile/assets/app-store/UPLOAD_STEP_BY_STEP.md`

1. App Store Connect → your app → the version → **Previews and Screenshots**.
2. Click **View All Sizes in Media Manager** (some sizes only appear there).
3. Delete every screenshot that shows Android navigation / status bar, Google Play badges, or “Android” marketing.
4. Upload from `upload/iphone-6.7/` (then `iphone-6.5/`, then `ipad-12.9/`) in the order listed in `UPLOAD_STEP_BY_STEP.md`.
5. For the subscription product’s App Review screenshot, use `upload/iap-review/iphone-07-pro.png`.

---

## D. Build & submit iOS binary 1.0.4 (build 11) (10)

On your Mac (EAS):

```bash
cd apps/mobile-eas
npm install
eas build --platform ios --profile production
eas submit --platform ios --profile production
```

Confirm App Store Connect shows version **1.0.4 (build 11)**, build **10**.

Attach IAP products to this version (section B), then **Add for Review** → Submit.

---

## E. Screen recording for account deletion (5.1.1)

Apple requires a **physical-device** screen recording. Put it in **App Review Information → Notes** (and keep a copy for replies).

Record on iPhone/iPad:

1. Sign in with the **demo / reviewer account** (or create a throwaway account).
2. Open **Settings**.
3. Scroll to **Delete account** → **Delete my account**.
4. Type **DELETE**, enter password, confirm.
5. Show confirmation / return to signed-out home.

Upload the video (or a link Apple can open) in Notes. Example Notes text:

```
Account deletion (Guideline 5.1.1): Settings → Delete account → type DELETE + password.
Screen recording attached / linked: [URL]
Demo account: [email] / [password]
IAP: MotiveLife Pro monthly is attached to this version for review. Sandbox purchase from Upgrade.
Screenshots: replaced with iPhone-only captures; no Android/Play references.
```

---

## F. Reply to App Review (paste into ASC reply)

```
Hello App Review,

Thank you for the feedback on submission e36c5f85-b243-4b67-bf56-01cdf2c7eb36.

1) Guideline 2.3.10 — We removed Android / Google Play / non-iOS status bar content from the iOS app UI and replaced App Store screenshots with iPhone captures of the app in use. The iOS binary no longer surfaces Health Connect / Android marketing.

2) Guideline 2.1(b) — MotiveLife Pro subscription IAP products are completed (including App Review screenshot) and submitted with this new binary for review.

3) Guideline 5.1.1 — Account deletion is available in-app: Settings → Delete account (confirm by typing DELETE and entering the password). A screen recording of the full flow on a physical device is included in App Review Information Notes.

Please continue the review with version 1.0.4 (build 11).

Thank you,
MotiveLife Team
```

---

## Checklist before Submit for Review

- [ ] Web production has Settings → Delete account
- [ ] ASC screenshots are iPhone/iPad only (Media Manager → all sizes)
- [ ] Subscription product(s) have review screenshot + attached to version
- [ ] Binary 1.0.4 (build 11) (10) uploaded
- [ ] Deletion screen recording in Review Notes
- [ ] Demo account credentials still valid
- [ ] Reply text sent (or Notes cover all three issues)
