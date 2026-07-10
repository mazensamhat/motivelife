# App Store Connect graphics

Screenshots for **iPhone 6.7"** (1290×2796) and **iPad Pro 12.9"** (2048×2732). Upload in App Store Connect → your app → **App Store** → Screenshots.

## iPhone 6.7" (portrait)

| File | Size | Screen |
|------|------|--------|
| `iphone-01-today.png` | 1290×2796 | Today / morning briefing |
| `iphone-02-voice.png` | 1290×2796 | Voice Organize |
| `iphone-03-life-graph.png` | 1290×2796 | Life Graph / domains |
| `iphone-04-predictions.png` | 1290×2796 | Life Predictions |
| `iphone-05-money.png` | 1290×2796 | Money / cashflow |
| `iphone-06-life-feed.png` | 1290×2796 | Life Feed |

## iPad 12.9" (portrait)

| File | Size | Screen |
|------|------|--------|
| `ipad-01-today.png` | 2048×2732 | Today briefing (wide) |
| `ipad-02-voice.png` | 2048×2732 | Voice Organize (wide) |
| `ipad-03-life-graph.png` | 2048×2732 | Life Graph 2×2 domains |
| `ipad-04-predictions.png` | 2048×2732 | Predictions grid |
| `ipad-05-money.png` | 2048×2732 | Money dashboard |
| `ipad-06-life-feed.png` | 2048×2732 | Life Feed |
| `ipad-07-my-life.png` | 2048×2732 | My Life hub |
| `ipad-08-command-center.png` | 2048×2732 | Command Center / timeline |
| `ipad-09-goals.png` | 2048×2732 | Goals / Life GPS |
| `ipad-10-trust.png` | 2048×2732 | Trust / privacy + AI Life OS |

## Source & regenerate

- `screenshots.html` — all screen layouts (ids `phone-01`…`phone-06`, `ipad-01`…`ipad-10`)
- `generate-screenshots.mjs` — Playwright capture at exact viewport sizes
- App icon served from `../icon.png` as `/icon.png`

```powershell
cd apps\mobile\assets\app-store
npx playwright install chromium
node generate-screenshots.mjs
```

Brand: MotiveLife · AI Life Operating System · `#050d18` / `#00c6ff` / `#00ff87` / `#0072ff`
