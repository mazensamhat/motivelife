# App Store Connect graphics

Screenshots sized for the slots App Store Connect accepts.

## iPhone (6.5" / 6.7" slot)

Connect accepts: **1242×2688**, **1284×2778** (and landscape swaps).

We generate **1284×2778** (portrait).

| File | Size | Screen |
|------|------|--------|
| `iphone-01-today.png` | 1284×2778 | Today / morning briefing |
| `iphone-02-voice.png` | 1284×2778 | Voice Organize |
| `iphone-03-life-graph.png` | 1284×2778 | Life Graph / domains |
| `iphone-04-predictions.png` | 1284×2778 | Life Predictions |
| `iphone-05-money.png` | 1284×2778 | Money / cashflow |
| `iphone-06-life-feed.png` | 1284×2778 | Life Feed |

Upload up to **10** screenshots (and up to 3 app previews) in that phone size group.

## iPad 12.9"

**2048×2732** (portrait).

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

## Regenerate

```powershell
cd apps\mobile\assets\app-store
npx playwright install chromium
node generate-screenshots.mjs
```

Brand: MotiveLife · AI Life Operating System · `#050d18` / `#00c6ff` / `#00ff87` / `#0072ff`
