# Upload MotiveLife screenshots to App Store Connect (step by step)

Use **`apps/mobile/assets/app-store/upload/`**.

Match **folder → Media Manager slot**. Wrong slot = “dimensions are wrong”.

| ASC slot (exact label) | Folder | Exact pixels |
|------------------------|--------|--------------|
| **iPhone 6.9" Display** (top, red if wrong) | `iphone-6.9/` | **1320 × 2868** |
| **iPhone 6.5" Display** | `iphone-6.5/` | **1284 × 2778** |
| **iPad Pro 12.9"** (or your iPad size) | `ipad-12.9/` | **2048 × 2732** |

---

## 0. Get the files

Pull this branch, or unzip `motivelife-ios-screenshots.zip` from artifacts.

---

## 1. Open Media Manager

1. [App Store Connect](https://appstoreconnect.apple.com) → **My Apps** → **MotiveLife**
2. Open the version → **Previews and Screenshots**
3. Click **View All Sizes in Media Manager**

---

## 2. Delete old screenshots

In **every** size that has images → **Delete All** (especially anything Android / Play).

---

## 3. Fix the red “iPhone 6.9" Display” box

**Do not** upload `iphone-6.5` files here (1284×2778 is rejected in this slot).

1. Click the **iPhone 6.9" Display** drop zone (or Choose File).
2. Upload these **six** from `upload/iphone-6.9/` only:

| # | File | Must be |
|---|------|---------|
| 1 | `iphone-01-today.png` | 1320×2868 |
| 2 | `iphone-02-voice.png` | 1320×2868 |
| 3 | `iphone-03-life-graph.png` | 1320×2868 |
| 4 | `iphone-04-predictions.png` | 1320×2868 |
| 5 | `iphone-05-money.png` | 1320×2868 |
| 6 | `iphone-06-life-feed.png` | 1320×2868 |

3. Wait until the red banner disappears and counts show **6 of 10 Screenshots**.

Optional: `iphone-6.9/alt-1290/` is 1290×2796 (also accepted in 6.9") — only use if 1320 fails.

---

## 4. Upload iPhone 6.5" Display

1. Open **iPhone 6.5" Display**.
2. Upload the six files from `upload/iphone-6.5/` (1284×2778), same order as above.

---

## 5. Upload iPad (review was on iPad)

1. Open the iPad size in Media Manager.
2. Upload `ipad-01` … `ipad-10` from `upload/ipad-12.9/`.

---

## 6. Subscription IAP review screenshot

1. **Subscriptions** → MotiveLife Pro monthly → App Review screenshot.
2. Upload `upload/iap-review/iphone-07-pro.png` (1284×2778 is fine here).

---

## 7. Save

Click **Save**. Re-open Media Manager — no red dimension banner.

---

## Quick check on your Mac before upload

```bash
sips -g pixelWidth -g pixelHeight upload/iphone-6.9/iphone-01-today.png
# expect: 1320 x 2868

sips -g pixelWidth -g pixelHeight upload/iphone-6.5/iphone-01-today.png
# expect: 1284 x 2778
```
