# App Store Connect graphics

Screenshots sized for the slots App Store Connect accepts.

**Upload pack (ready now):** [`upload/`](./upload/)  
**Exact ASC steps:** [`UPLOAD_STEP_BY_STEP.md`](./UPLOAD_STEP_BY_STEP.md)

iOS-only status bars · no Android / Google Play copy (Guideline 2.3.10).

## iPhone (6.7" primary + 6.5")

| Slot | Size | Folder |
|------|------|--------|
| iPhone 6.7" Display | **1290×2796** | `upload/iphone-6.7/` |
| iPhone 6.5" Display | **1284×2778** | `upload/iphone-6.5/` |

| File | Screen |
|------|--------|
| `iphone-01-today.png` | Today / morning briefing |
| `iphone-02-voice.png` | Voice Organize |
| `iphone-03-life-graph.png` | Life Graph / domains |
| `iphone-04-predictions.png` | Life Predictions |
| `iphone-05-money.png` | Money / cashflow |
| `iphone-06-life-feed.png` | Life Feed |

Also generated (not for the listing by default):

| File | Use |
|------|-----|
| `iphone-07-pro.png` | Subscription **App Review** screenshot (`upload/iap-review/`) |
| `iphone-08-delete-account.png` | Visual aid for 5.1.1 Notes (`upload/iap-review/`) |

## iPad 12.9"

**2048×2732** → `upload/ipad-12.9/` (`ipad-01` … `ipad-10`).

## Regenerate

```bash
cd apps/mobile/assets/app-store
npx playwright install chromium
node generate-screenshots.mjs
```

Brand: MotiveLife · AI Life Operating System · `#050d18` / `#00c6ff` / `#00ff87` / `#0072ff`
