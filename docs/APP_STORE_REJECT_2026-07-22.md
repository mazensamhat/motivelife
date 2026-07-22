# App Store rejection — July 22, 2026 (1.0.4 / build 12)

Submission ID: `e36c5f85-b243-4b67-bf56-01cdf2c7eb36`  
Devices: iPhone 17 Pro Max, iPad Air 11-inch (M3)

Apple cited three guidelines again. Fix **all three**, then **Update Review** on the rejected **1.0.4** version (do **not** create 1.0.5).

Next binary: **1.0.4 (13)** (`apps/mobile-eas/app.json`).

---

## Code fixes in this PR

| Guideline | Change |
|-----------|--------|
| **5.1.2(i)** Cookies / tracking | Cookie notice + Vercel Analytics + pageview tracker **disabled in native shell**. Cookie copy on web clarifies essential cookies only (no advertising / cross-app tracking). iOS WebView: `thirdPartyCookiesEnabled={false}`. No ATT (we do not track). Overlay no longer says “Health Connect”. |
| **2.3.10** Screenshots | Regenerated App Store shots **without** fake `5G` / `Wi‑Fi ▮▮▮▮` status bars. |
| **2.1(b)** IAP | Still **App Store Connect** — attach + submit subscription with the new binary (steps below). |

Deploy **web to Vercel Production** before building the iOS binary so the shell loads the new cookie/analytics behavior.

---

## A. Deploy web first

1. Merge this PR → wait for https://www.mymotivelife.com Production.
2. Spot-check in a browser: cookie notice says essential-only / no tracking.
3. In the iOS app (after new build): cold launch → **no** cookie dialog.

---

## B. App Store Connect — submit IAP (2.1(b)) — do this carefully

Stay on **1.0.4 Rejected** → you will **Update Review** after attaching IAP + new build.

1. App Store Connect → **MotiveLife** → **Monetization** → **Subscriptions**.
2. Open your Pro monthly product (e.g. `motivelife_pro_monthly`).
3. Complete:
   - Localization (display name + description)
   - **App Review Screenshot** (required): upload `apps/mobile/assets/app-store/iphone-07-pro.png`
   - Optional: subscription image `subscription-image-1024.png`
4. Product status must be ready to submit with the app.
5. Open version **1.0.4** → section **In-App Purchases and Subscriptions** → **+** → select the Pro monthly product.
6. Confirm it appears on the version page **before** you click Submit.

If IAP is “Missing Metadata”, fix localization + review screenshot first — Apple will reject again without it.

---

## C. Replace screenshots (2.3.10)

1. Version **1.0.4** → **Previews and Screenshots** → **View All Sizes in Media Manager**.
2. Delete old shots that show any status bar with **5G**, **Wi‑Fi**, block bars, or Android chrome.
3. Upload from `apps/mobile/assets/app-store/`:
   - **6.9"** → `6.9-01` … `6.9-07`
   - **6.5"** → `6.5-01` … `6.5-07`
   - **iPad 13"** → `ipad-01` … `ipad-10`
4. These files have **no** drawn system status bar.

---

## D. Build & submit binary 1.0.4 (13)

On your Mac:

```bash
cd apps/mobile-eas
npm install
eas build --platform ios --profile production
eas submit --platform ios --profile production
```

Confirm ASC shows **1.0.4 (13)**. Attach IAP (section B). Then **Update Review** / Submit.

### Review Notes (paste)

```
IAP: Auto-renewable MotiveLife Pro monthly is attached to this version with App Review screenshot.

Privacy / cookies: The iOS app does not show a cookie prompt and does not use App Tracking Transparency because we do not track users for advertising or share data with data brokers. Essential session cookies only; third-party cookies disabled in the WebView. Vercel Analytics and pageview tracking are disabled inside the native shell.

Screenshots: Replaced listing screenshots; no Android / non-iOS status bars.
```

### App Privacy (ASC)

Account Holder/Admin: ensure **Tracking** is **No** if you do not track (matches this build). Do not claim ATT if we never show it.

---

## E. Checklist before Submit

- [ ] Vercel Production has cookie/analytics native-shell gates
- [ ] IAP product has review screenshot + attached to 1.0.4
- [ ] New screenshots uploaded (no 5G/Wi‑Fi bars)
- [ ] Build **13** selected on 1.0.4
- [ ] Review Notes pasted
- [ ] **Update Review** (not a new version number)
