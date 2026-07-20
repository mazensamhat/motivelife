# Upload MotiveLife screenshots to App Store Connect (step by step)

Use the pack in **`apps/mobile/assets/app-store/upload/`** (also zipped at `/opt/cursor/artifacts/motivelife-ios-screenshots.zip`).

These are **iOS-only** images (iPhone status bar + App Store copy). Do **not** re-upload any older shots that mention Android, Google Play, or show Android chrome.

---

## 0. Get the files on your computer

**Option A — from the repo (after you pull this branch):**

```
apps/mobile/assets/app-store/upload/
  iphone-6.7/     ← use these first (1290×2796)
  iphone-6.5/     ← 1284×2778
  ipad-12.9/      ← 2048×2732
  iap-review/     ← Pro paywall + Delete account (not for listing)
```

**Option B — download the zip** from the cloud agent artifacts: `motivelife-ios-screenshots.zip`, then unzip.

---

## 1. Open Media Manager (required)

1. Go to [App Store Connect](https://appstoreconnect.apple.com) → **My Apps** → **MotiveLife**.
2. Open the version you are submitting (or create **1.0.7**).
3. Scroll to **Previews and Screenshots**.
4. Click **View All Sizes in Media Manager**.

You must use Media Manager so every size Apple stores (6.7", 6.5", iPad, etc.) gets updated — not only the size shown on the version page.

---

## 2. Delete every old screenshot

For **each** device size tab that has images:

1. Select all existing screenshots.
2. Delete them.
3. Especially remove anything with:
   - Android navigation / status bar
   - “Play Store”, “Android”, “Google Play”
   - Non-iOS frames or mockups

Do this for **iPhone 6.7"**, **iPhone 6.5"**, and **iPad Pro 12.9"** (and any other size that still has media).

---

## 3. Upload iPhone 6.7" (primary)

1. In Media Manager, open **iPhone 6.7" Display**.
2. Upload these **six** files from `upload/iphone-6.7/`, **in this order**:

| Order | File |
|------:|------|
| 1 | `iphone-01-today.png` |
| 2 | `iphone-02-voice.png` |
| 3 | `iphone-03-life-graph.png` |
| 4 | `iphone-04-predictions.png` |
| 5 | `iphone-05-money.png` |
| 6 | `iphone-06-life-feed.png` |

3. Wait until each thumbnail finishes processing (no red error).

---

## 4. Upload iPhone 6.5"

1. Open **iPhone 6.5" Display**.
2. Upload the same six names from `upload/iphone-6.5/` in the **same order**.

(If Connect offers to scale from 6.7" and the scaled set looks sharp, you can use scaling — but uploading the matching folder is safer.)

---

## 5. Upload iPad 12.9" (you support iPad)

Review was on **iPad Air**. Upload iPad shots:

1. Open **iPad Pro 12.9" Display** (or the iPad size Media Manager shows).
2. Upload from `upload/ipad-12.9/` in order:

| Order | File |
|------:|------|
| 1 | `ipad-01-today.png` |
| 2 | `ipad-02-voice.png` |
| 3 | `ipad-03-life-graph.png` |
| 4 | `ipad-04-predictions.png` |
| 5 | `ipad-05-money.png` |
| 6 | `ipad-06-life-feed.png` |
| 7 | `ipad-07-my-life.png` |
| 8 | `ipad-08-command-center.png` |
| 9 | `ipad-09-goals.png` |
| 10 | `ipad-10-trust.png` |

---

## 6. Subscription IAP review screenshot (Guideline 2.1)

1. App Store Connect → **Subscriptions** → your MotiveLife Pro monthly product.
2. Open **App Review Information** (or the product’s review screenshot field).
3. Upload **`upload/iap-review/iphone-07-pro.png`**.
4. Attach that subscription to the app version before Submit for Review.

Do **not** put this file in the main listing screenshots unless you want a paywall as screenshot #7.

---

## 7. Optional helper for deletion reply

`upload/iap-review/iphone-08-delete-account.png` shows Settings → Delete account.  
Apple still wants a **screen recording** of the live flow — this PNG is only a visual aid for Notes, not a replacement.

---

## 8. Save and double-check

1. Click **Save** on the version / Media Manager.
2. Re-open **View All Sizes** and confirm:
   - Every size you care about has the new MotiveLife shots
   - No Android / Play leftovers
3. Proceed with binary **1.0.7** + IAP submit (see `docs/APP_STORE_REJECT_2026-07-20.md`).

---

## Regenerate later

```bash
cd apps/mobile/assets/app-store
npx playwright install chromium
node generate-screenshots.mjs
```
