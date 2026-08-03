# MotiveLife — iOS (and Android) via Expo EAS

Same product as the Capacitor shell: a **native WebView** that loads **https://www.mymotivelife.com**.

| Shell | Path | Best for |
|-------|------|----------|
| **Capacitor** | `apps/mobile` | Android Play (already shipping) |
| **Expo + EAS** | `apps/mobile-eas` | **iOS App Store from Windows** (cloud Mac builds) |

Bundle ID: `com.mymotivelife.app` (same as Capacitor — one App Store listing).

**App icon / splash:** Official MotiveLife mark from the Capacitor iOS App Icon set (`AppIcon-512@2x.png`, 1024×1024) — cyan→green M with person figure on `#050d18`.

---

## Why EAS?

MotiveFX already builds on EAS. You do **not** need a physical Mac to produce an iOS `.ipa` — EAS builds on Expo’s Macs in the cloud. You still need:

1. An **Expo account** (same one as MotiveFX is fine)
2. An **Apple Developer** membership ($99/year)
3. App Store Connect app record for MotiveLife

---

## One-time setup

### 1. Install deps (use npm in this folder — not the monorepo pnpm root)

```powershell
cd C:\Users\Mazen\Documents\motivelife.ai\apps\mobile-eas
npm install
npm install -g eas-cli
```

### 2. Log in to Expo / EAS

```powershell
eas login
```

Use the same Expo account you use for MotiveFX.

### 3. Link this folder to a new EAS project

```powershell
cd C:\Users\Mazen\Documents\motivelife.ai\apps\mobile-eas
eas build:configure
```

This writes an EAS `projectId` into `app.json` → `extra.eas.projectId`. **Commit that change.**

When prompted, create a **new** project named something like `motivelife` (do not reuse the MotiveFX project).

### 4. Apple credentials (first iOS build)

EAS will ask to manage credentials. Recommended:

- Let EAS **create/manage** distribution certificates and provisioning profiles
- Sign in with your Apple Developer Apple ID when prompted
- Bundle ID must be **`com.mymotivelife.app`** (register it in Apple Developer → Identifiers if not already)

---

## Build iOS (preview / TestFlight-ready)

```powershell
cd C:\Users\Mazen\Documents\motivelife.ai\apps\mobile-eas
npm run build:ios
```

Or:

```powershell
eas build --platform ios --profile preview
```

Wait for the build on [expo.dev](https://expo.dev). Download the `.ipa` or install via the QR / internal link.

### Production App Store build

```powershell
npm run build:ios:production
```

---

## Submit to App Store Connect

1. Create the app in [App Store Connect](https://appstoreconnect.apple.com) if needed:
   - Name: **MotiveLife**
   - Bundle ID: **com.mymotivelife.app**
2. Copy the numeric **Apple ID** (App Store Connect → App → App Information → Apple ID)
3. Add it to `eas.json` under submit (only after you have the ID — do not leave it empty):

```json
"submit": {
  "production": {
    "ios": {
      "ascAppId": "YOUR_NUMERIC_APPLE_ID"
    }
  }
}
```

4. Submit:

```powershell
npm run submit:ios
```

Or:

```powershell
eas submit --platform ios --latest
```

Until then, leave `submit.production` empty and use **build** only — EAS rejects an empty `ascAppId`.
---

## Local smoke test (optional)

```powershell
cd apps\mobile-eas
npx expo start
```

Press `i` only works with a Mac simulator. On Windows, use Expo Go for limited testing, or rely on EAS cloud builds for real iOS devices.

---

## App Store listing checklist

Same content as `docs/APP_STORE_LAUNCH.md` (screenshots, privacy, description). The binary comes from EAS instead of Xcode on a Mac.

Privacy policy URL: `https://www.mymotivelife.com/privacy`

---

## Capacitor vs EAS — keep both for now

- **Android Play:** keep using Capacitor (`apps/mobile`) until you deliberately migrate.
- **iOS:** use EAS (`apps/mobile-eas`) so you can ship without a Mac.
- Both load the same website; store updates are only needed for splash/icon/native permission changes.

Do **not** submit two different Android packages with the same application id from both shells at once — pick one pipeline per store listing.

---

## MotiveFX must not install with MotiveLife

MotiveLife (`com.mymotivelife.app`, Expo project `motivelife`) and MotiveFX (`ai.motivefx.app`, Expo project `motivefx`) are **separate apps**. Installing one IPA/APK never bundles the other.

If MotiveFX also appears when you install MotiveLife on a registered device, it is almost always **Expo Orbit** (or the Expo website) auto-installing the latest build from **every** project on your Expo account for that UDID — not MotiveLife bundling MotiveFX.

**Install MotiveLife only:**

1. Uninstall **MotiveFX.AI** from the phone.
2. On the PC, quit **Expo Orbit** or turn off auto-install for the MotiveFX project.
3. Install only from the MotiveLife EAS build page / QR for project **motivelife** (`apps/mobile-eas`).
4. Confirm Settings → MotiveLife shows version **1.0.10** (build **20**+) — older builds do not ask for Always correctly.
5. Optional: pause or archive MotiveFX EAS builds until that product is ready.

---

## Android Location missing from App Settings

If Family Map says Location is off and **Settings → Apps → MotiveLife → Permissions** has no Location row:

1. Build from the fix branch (not stale `main`), install MotiveLife **1.0.14 (24)+** EAS APK.
2. Confirm the **bottom status bar** shows `v1.0.14 (24)`. If it doesn’t, you installed the wrong binary.
3. Tap **Enable location** — Android must show the Allow Location dialog (registers Location under App Permissions).
4. If phone GPS is off, MotiveLife opens **Settings → Location**.
5. Then: Permissions → Location → **Allow all the time**.

```powershell
cd apps\mobile-eas
git fetch origin
git checkout cursor/ios-always-location-motivefx-13b9
git pull
npx eas-cli@latest build --platform android --profile preview
```

**Play Store Capacitor note:** older Capacitor Android shells were missing the `@capacitor/geolocation` native plugin registration. Prefer the EAS Expo shell (`apps/mobile-eas`) for Family Map location testing.

## Family Map Always / background location (iOS)

1. Build from `apps/mobile-eas` with profile `preview` or `production` (version **1.0.10+**).
2. Open MotiveLife → Family Map → **Enable location**.
3. In the system dialog choose **Allow While Using App** (not “Ask Next Time Or When I Share”).
4. When the second dialog appears, choose **Change to Always Allow** / **Always**.
5. If Settings → MotiveLife → Location is stuck on **When I Share**: set it to **Never**, force-quit MotiveLife, reopen, tap Enable location again, then pick While Using → Always.
6. Background sharing needs Always. While Using only updates the pin while the app is open.
