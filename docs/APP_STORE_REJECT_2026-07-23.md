# App Store rejection — July 23, 2026 (1.0.4 / build 12)

Submission ID: `e36c5f85-b243-4b67-bf56-01cdf2c7eb36`  
Review device: iPhone 17 Pro Max  
Version reviewed: **1.0.4 (12)**

Apple cited:

| Guideline | Issue |
|-----------|--------|
| **2.1(b)** | Subscription IAP product not submitted with the app / missing App Review screenshot |
| **3.1.2(c)** | Auto-renewable subscription disclosures missing in-app (title, length, price, Terms, Privacy) + Terms link in App Store metadata |

Stay on **1.0.4 Rejected** → **Update Review**. Do **not** create 1.0.5.

Next binary: **1.0.4 (14)** (`apps/mobile-eas/app.json`).

---

## Code fixes (this PR)

- In-app **3.1.2(c)** disclosures on Settings → MotiveLife Pro and every Upgrade CTA:
  - Title: **MotiveLife Pro**
  - Length: **1 month** (auto-renewable)
  - Price: **$14.99/mo**
  - Functional links: [Terms of Use](https://www.mymotivelife.com/terms) · [Privacy Policy](https://www.mymotivelife.com/privacy)
- Build number → **14**

Deploy **web to Vercel Production** before the new EAS binary so the shell loads the disclosure UI.

---

## A. Deploy web first

1. Merge this PR → wait for https://www.mymotivelife.com Production.
2. Spot-check Settings → MotiveLife Pro (or any Upgrade button): disclosure block with Terms + Privacy links.
3. In the iOS app after build 14: same disclosures visible before purchase.

---

## B. App Store Connect — submit IAP (2.1(b))

1. ASC → **MotiveLife** → **Monetization** → **Subscriptions**.
2. Open Pro monthly (e.g. `motivelife_pro_monthly`).
3. Complete localization (display name + description).
4. **App Review Screenshot** (required) — use one clear iPhone shot of Settings → MotiveLife Pro showing the subscription + legal disclosure, e.g.:
   - Prefer: capture from the device/simulator after Production has the new disclosure UI
   - Fallback files if you still have them under `apps/mobile/assets/app-store/` (IAP review size variants from earlier PRs)
5. Optional: subscription promo image.
6. Version **1.0.4** → **In-App Purchases and Subscriptions** → **+** → attach the Pro monthly product.
7. Confirm it appears on the version page **before** Submit.

---

## C. App Store metadata — Terms of Use (3.1.2(c))

1. Version **1.0.4** → **App Privacy** → Privacy Policy URL: `https://www.mymotivelife.com/privacy`
2. **Description** — include a Terms line (Apple accepts this for standard EULA), e.g. add:

```
Terms of Use (EULA): https://www.mymotivelife.com/terms
Privacy Policy: https://www.mymotivelife.com/privacy
```

3. Or attach a custom EULA in ASC **App Information → License Agreement** if you prefer custom over Apple’s standard.

---

## D. Build & submit binary 1.0.4 (14)

```bash
cd apps/mobile-eas
npm install
eas build --platform ios --profile production
eas submit --platform ios --profile production
```

Confirm ASC shows **1.0.4 (14)**. Attach IAP (section B). Then **Update Review**.

### Review Notes (paste)

```
2.1(b): MotiveLife Pro monthly auto-renewable IAP is attached to this version with an App Review screenshot of the subscription / purchase surface.

3.1.2(c): In-app purchase surfaces (Settings → MotiveLife Pro and Upgrade CTAs) show subscription title (MotiveLife Pro), length (1 month), price ($14.99/mo), and functional links to Terms of Use (https://www.mymotivelife.com/terms) and Privacy Policy (https://www.mymotivelife.com/privacy). App Description also includes the Terms of Use URL. Auto-renew / cancel copy is included in the disclosure.

Screen recording: Settings → MotiveLife Pro showing disclosures and tapping Terms / Privacy (optional reply attachment if requested).
```

---

## E. Reply to App Review (optional but recommended)

In Resolution Center, reply with a short screen recording (or screenshots) showing:
1. Settings → MotiveLife Pro with title / period / price / Terms / Privacy
2. Tapping Terms and Privacy opens the pages
3. Confirm IAP is attached to 1.0.4 (14)

---

## F. Checklist before Submit

- [ ] Vercel Production has subscription disclosure UI
- [ ] IAP product has review screenshot + attached to 1.0.4
- [ ] Description includes Terms of Use URL
- [ ] Privacy Policy URL set in ASC
- [ ] Build **14** selected on 1.0.4
- [ ] Review Notes pasted
- [ ] **Update Review** (not a new version number)
