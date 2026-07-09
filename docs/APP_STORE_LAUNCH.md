# Launch MotiveLife on the Apple App Store

Same app as Android: a **native shell** that loads **https://www.mymotivelife.com**.

**Preferred build path:** Expo EAS (`apps/mobile-eas`) — see [EAS_IOS_LAUNCH.md](./EAS_IOS_LAUNCH.md).  
**Alternative:** Capacitor + Xcode (`apps/mobile/ios`).

**Bundle ID:** `com.mymotivelife.app`  
**Version:** 1.0.2 (build 3)

---

## Preferred: build iOS with EAS (no Mac)

Same approach as MotiveFX. From Windows:

→ Full guide: **[EAS_IOS_LAUNCH.md](./EAS_IOS_LAUNCH.md)** (`apps/mobile-eas`)

```powershell
cd apps\mobile-eas
npm install
eas login
eas build:configure
eas build --platform ios --profile production
eas submit --platform ios --latest
```

---

## Alternative: build on a Mac with Xcode

If you prefer Capacitor + Xcode instead of EAS:

| Requirement | Notes |
|-------------|--------|
| **Mac** | MacBook, Mac mini, iMac, or cloud Mac |
| **Xcode** | Free from Mac App Store |
| **Apple Developer** | [developer.apple.com/programs](https://developer.apple.com/programs/) — **$99/year** |

The Capacitor iOS project is at `apps/mobile/ios`.

---

## Part 1 — On your Windows PC (done / optional refresh)

From the repo root:

```powershell
cd apps\mobile
npm run assets:generate
npm run build:ios
```

Commit and push so your Mac has the latest icons and version.

---

## Part 2 — Apple Developer account

1. Enroll at [developer.apple.com/programs](https://developer.apple.com/programs/)
2. Wait for approval (usually 24–48 hours)
3. Sign in to [App Store Connect](https://appstoreconnect.apple.com)

---

## Part 3 — Register the app ID

1. [Apple Developer](https://developer.apple.com/account) → **Certificates, Identifiers & Profiles**
2. **Identifiers** → **+** → **App IDs** → **App**
3. Description: `MotiveLife`
4. Bundle ID: **Explicit** → `com.mymotivelife.app`
5. Capabilities: none required for v1 (mic is Info.plist only)
6. **Register**

---

## Part 4 — Open the project on Mac

1. Clone or pull the repo on your Mac
2. Install deps:

```bash
cd apps/mobile
npm install
npx cap sync ios
```

3. Install CocoaPods (first time only):

```bash
sudo gem install cocoapods
cd ios/App
pod install
```

4. Open the **workspace** (not the `.xcodeproj`):

```bash
open ios/App/App.xcworkspace
```

Or from repo root: `npm run ios:open` (on Mac).

---

## Part 5 — Signing in Xcode

1. Select the **App** project (blue icon) → target **App**
2. **Signing & Capabilities**
3. Check **Automatically manage signing**
4. **Team:** your Apple Developer team
5. **Bundle Identifier:** `com.mymotivelife.app`

Fix any red errors before continuing.

---

## Part 6 — Test on simulator or iPhone

1. Top bar: choose **iPhone 16** (simulator) or your plugged-in iPhone
2. Click **Run** ▶
3. App should load MotiveLife from the web — log in, try Voice Organize (mic permission)

---

## Part 7 — Archive & upload

1. Top device menu: **Any iOS Device (arm64)** (not a simulator)
2. **Product → Archive**
3. When Organizer opens: **Distribute App**
4. **App Store Connect** → **Upload**
5. Follow prompts (defaults are fine)
6. Wait for processing in App Store Connect (10–30 min)

---

## Part 8 — App Store Connect listing

1. [App Store Connect](https://appstoreconnect.apple.com) → **Apps** → **+** → **New App**
2. Platform: **iOS**
3. Name: **MotiveLife**
4. Bundle ID: `com.mymotivelife.app`
5. SKU: `motivelife-ios` (any unique string)

### Copy (same as Play Store)

**Subtitle (30 chars):**  
`AI life coach — talk, plan, act`

**Description:** use the long description from `docs/PLAY_STORE_LAUNCH.md`.

**URLs:**

| Field | URL |
|-------|-----|
| Privacy | https://www.mymotivelife.com/privacy |
| Support | https://www.mymotivelife.com |
| Marketing | https://www.mymotivelife.com |

**Category:** Productivity  
**Age rating:** complete questionnaire (likely 4+)

**Screenshots:** iPhone 6.7" and 6.5" required — capture from simulator or device.

**App icon:** 1024×1024 — already in `apps/mobile/assets/icon.png` (Xcode uses generated assets).

---

## Part 9 — Submit for review

1. Attach the uploaded build to the version
2. **App Review Information:** demo login if reviewers need an account
3. **Submit for Review**

Review often takes 1–3 days.

---

## Checklist

- [ ] Apple Developer enrolled ($99)
- [ ] Bundle ID `com.mymotivelife.app` registered
- [ ] `pod install` succeeded on Mac
- [ ] Opens `App.xcworkspace` in Xcode
- [ ] Runs on simulator or device
- [ ] Archive uploaded to App Store Connect
- [ ] Screenshots + privacy URL + description filled
- [ ] Submitted for review

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| White screen | Open Safari on device → confirm mymotivelife.com loads |
| Signing errors | Xcode → Settings → Accounts → add Apple ID |
| `pod install` fails | `sudo gem install cocoapods` then retry in `ios/App` |
| No Mac | Use a friend's Mac, borrow Mac mini, or CI (Codemagic) |
| Mic denied | Delete app, reinstall after archive build |

---

## No Mac?

Options:

- **Borrow / buy** a used Mac mini for builds
- **Codemagic** or **GitHub Actions + Mac runner** — more setup, builds in the cloud

Web + Android already ship; iOS can wait until you have Mac access.
