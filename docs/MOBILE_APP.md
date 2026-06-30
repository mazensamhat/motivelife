# MotiveLife — iOS & Android apps

MotiveLife ships as a **native shell** (Capacitor) that loads **https://www.mymotivelife.com**. Your web app is the product; the store apps are installable icons with native splash, status bar, and microphone permissions for Voice Organize.

**Benefits:** One codebase, instant web deploys without waiting on App Store review for most changes.

---

## Prerequisites

| Platform | What you need |
|----------|----------------|
| **Android** | [Android Studio](https://developer.android.com/studio) (Windows OK) |
| **iOS** | Mac with [Xcode](https://developer.apple.com/xcode/) + **Apple Developer** ($99/year) |
| **Both** | Node.js 20+ |

---

## Setup (first time)

```powershell
cd apps\mobile
npm install
npx cap add android
npx cap add ios
npm run cap:sync
```

`cap add ios` scaffolds on Windows; **building/submitting iOS requires a Mac**.

---

## Run on a device

### Android (emulator or USB)

```powershell
cd apps\mobile
npm run android:open
```

Android Studio → Run ▶ on emulator or connected phone.

### iOS (Mac only)

```powershell
cd apps\mobile
npm run ios:open
```

Xcode → select team → Run on simulator or device.

---

## Local dev against your machine

Point the shell at your Next.js dev server:

```powershell
$env:CAPACITOR_DEV="1"
$env:CAPACITOR_SERVER_URL="http://192.168.2.114:3002"   # your PC LAN IP
cd apps\mobile
npm run cap:sync
npm run android:open
```

Use your machine's LAN IP (not `localhost`) so the phone/emulator can reach it.

---

## Store submission checklist

### Google Play

1. [Google Play Console](https://play.google.com/console) — $25 one-time
2. **Create app** → MotiveLife
3. Build signed bundle in Android Studio: **Build → Generate Signed Bundle / APK**
4. Required URLs:
   - Privacy: https://www.mymotivelife.com/privacy
   - Terms: https://www.mymotivelife.com/terms
5. Content rating questionnaire, screenshots (phone + tablet)

### Apple App Store

1. [Apple Developer Program](https://developer.apple.com/programs/)
2. Xcode → **Product → Archive** → **Distribute App**
3. App Store Connect → new app, bundle ID `com.mymotivelife.app`
4. Same privacy/terms URLs
5. Microphone usage reason is pre-configured in `Info.plist` (Voice Organize)

---

## App identity

| Field | Value |
|-------|--------|
| App name | MotiveLife |
| Bundle / package ID | `com.mymotivelife.app` |
| Production URL | `https://www.mymotivelife.com` |
| Start experience | `/dashboard` (after login) |

---

## Icons & splash

Replace placeholder assets before store submit:

1. Export **1024×1024** PNG app icon from your brand logo
2. Run `@capacitor/assets` or place files in:
   - `android/app/src/main/res/`
   - `ios/App/App/Assets.xcassets/AppIcon.appiconset/`

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| White screen | Confirm `www.mymotivelife.com` loads in device browser |
| Voice mic denied | Reinstall after `npm run cap:sync` (mic permissions) |
| Google OAuth in app | May need in-app browser / system browser — test Integrations |
| iOS build on Windows | Use a Mac, or CI (Codemagic, EAS) |

---

## Monorepo scripts (from repo root)

```powershell
npm run mobile:sync
npm run mobile:android
```
