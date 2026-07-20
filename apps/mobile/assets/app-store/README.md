# App Store Connect graphics

**Upload pack:** [`upload/`](./upload/)  
**Exact ASC steps:** [`UPLOAD_STEP_BY_STEP.md`](./UPLOAD_STEP_BY_STEP.md)

| ASC slot | Folder | Pixels |
|----------|--------|--------|
| iPhone **6.9"** Display | `upload/iphone-6.9/` | **1320×2868** |
| iPhone **6.5"** Display | `upload/iphone-6.5/` | **1284×2778** |
| iPad 12.9" | `upload/ipad-12.9/` | **2048×2732** |
| IAP App Review screenshot | `upload/iap-review/iphone-07-pro.png` | 1284×2778 |

## Regenerate

```bash
cd apps/mobile/assets/app-store
npx playwright install chromium
node generate-screenshots.mjs
```
