# Google Play Store graphics

## Screenshots (phone + tablet)

| File | Size | Screen |
|------|------|--------|
| `phone-01-today.png` | 1080×1920 | Morning briefing / Today |
| `phone-02-voice.png` | 1080×1920 | Voice Organize |
| `phone-03-life-graph.png` | 1080×1920 | Life Graph |
| `tablet-01-today.png` | 1600×2560 | Today (tablet) |
| `tablet-02-life-graph.png` | 1600×2560 | Life Graph (tablet) |

### Regenerate

```powershell
cd apps\mobile\assets\play-store
npx playwright install chromium
node generate-screenshots.mjs
```

Upload in Play Console → **Store listing** → phone screenshots (3) and tablet screenshots (2).

## Feature graphic

Create a **1024×500** banner in Canva using `../icon.png` and tagline: *Just talk. Your AI life operating system.*
