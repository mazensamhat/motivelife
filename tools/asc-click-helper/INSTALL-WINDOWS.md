# MotiveLife ASC Click Helper (Windows)

Live panel on App Store Connect that:
- **Floating yellow mouse** points at the next button / field to click or fill
- Yellow box shows text to paste (click the box to copy)
- **Auto-reports** when stuck (screenshot + page data) to MotiveLife
- Lets Cursor fetch the latest report and coach you

## 1) Vercel (once)

Production env:

```
ASC_HELPER_SECRET=<long random string>
```

Redeploy. (`BLOB_READ_WRITE_TOKEN` already used — stores screenshot + latest JSON.)

Generate a secret:

```powershell
-join ((48..57 + 65..90 + 97..122) | Get-Random -Count 40 | ForEach-Object {[char]$_})
```

## 2) Install / refresh extension on PC

Easiest — PowerShell:

```powershell
irm https://raw.githubusercontent.com/mazensamhat/motivelife/cursor/asc-helper-coach-cursor-13b9/tools/asc-click-helper/put-on-desktop.ps1 | iex
```

(Until PR #29 merges to `main`, use that branch URL — `main` is still the old helper without the mouse.)

Or run `put-on-desktop.ps1` from this folder.

Then Chrome/Edge:
1. `chrome://extensions` → Developer mode ON
2. **Load unpacked** → `Desktop\asc-click-helper`
3. If already loaded → **Reload** the extension

## 3) Set the secret in the extension

1. Extension card → **Details** → **Extension options**
2. API base: `https://www.mymotivelife.com`
3. Paste the same `ASC_HELPER_SECRET`
4. Leave **Auto-report when stuck** ON
5. Save

## 4) Use it

1. Open App Store Connect
2. Helper panel bottom-right
3. When stuck → it auto-reports (or click **Report now**)
4. In Cursor chat say: **check ASC helper**
5. Agent fetches `/api/asc-helper/latest` and gives the next click

## Privacy

- Only runs on `appstoreconnect.apple.com`
- Sends page text signals + JPEG screenshot to **your** MotiveLife API
- Does not send Apple passwords
