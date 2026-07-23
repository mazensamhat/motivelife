# MotiveLife ASC Click Helper (Windows)

Live “click here / click that” panel on **App Store Connect**, plus **Copy for Cursor** so the agent can see the page you’re on.

This does **not** log into Apple for you and does **not** send data to a server. It only reads the ASC page in your browser.

## Install on your PC (Chrome or Edge) — 2 minutes

1. Pull/open this repo on your PC (or download the `tools/asc-click-helper` folder).
2. Open Chrome or Edge.
3. Go to:
   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`
4. Turn on **Developer mode** (top right).
5. Click **Load unpacked**.
6. Select this folder:

```
…\motivelife\tools\asc-click-helper
```

7. Open https://appstoreconnect.apple.com and sign in.
8. You should see **MotiveLife ASC Helper** bottom-right.

## How to use with Cursor

1. Navigate ASC (subscriptions, 1.0.4 version page, etc.).
2. Read the live steps in the panel.
3. If you’re stuck or the panel looks wrong → click **Copy for Cursor**.
4. Paste into Cursor chat (starts with `MOTIVELIFE_ASC_HELPER_REPORT`).
5. Cursor will tell you the exact next click from that report.

## Current MotiveLife flow baked in

- Stay on **1.0.4** (no 1.0.5)
- Close IAP-only Draft Submission if it says “Unable to Submit”
- Attach `motivelife_pro_monthly` on the **version** page
- Build **14**, Terms/Privacy in metadata, Update Review

## Update the extension later

After `git pull`, go to `chrome://extensions` → MotiveLife ASC Helper → **Reload**.

## Uninstall

`chrome://extensions` → Remove.
