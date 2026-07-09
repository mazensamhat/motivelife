# MotiveLife — iOS (and Android) via Expo EAS

Same product as the Capacitor shell: a **native WebView** that loads **https://www.mymotivelife.com**.

| Shell | Path | Best for |
|-------|------|----------|
| **Capacitor** | `apps/mobile` | Android Play (already shipping) |
| **Expo + EAS** | `apps/mobile-eas` | **iOS App Store from Windows** (cloud Mac builds) |

Bundle ID: `com.mymotivelife.app` (same as Capacitor — one App Store listing).

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
