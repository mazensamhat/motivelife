# Firebase + Google Play closed testing (step by step)

Google requires **closed testing on the Play Store** before production (typically **12 testers** opted in for **14 days** on personal accounts created after Nov 2023). Firebase helps you **distribute builds** and **link** your app to Google — but the 14-day clock starts when testers install from **Play Console closed testing**, not Firebase alone.

> **Note:** Google reduced the minimum from 20 to **12 testers** in December 2024.

Use **both**:
| Tool | Purpose |
|------|---------|
| **Firebase** | Project, `google-services.json`, App Distribution to early testers |
| **Play Console → Closed testing** | Required gate before public launch |

**Package ID (must match everywhere):** `com.mymotivelife.app`

---

## Part 1 — Create Firebase project (15 min)

### 1.1 Create project

1. Open [Firebase Console](https://console.firebase.google.com/)
2. **Add project** (or use existing Google account)
3. Project name: **MotiveLife**
4. **Google Analytics** → Enable (recommended) → choose or create Analytics account
5. **Create project** → wait for finish

### 1.2 Add Android app

1. Firebase project home → **Android** icon (Add app)
2. **Android package name:** `com.mymotivelife.app`  
   *(Must match exactly — no typos)*
3. **App nickname:** `MotiveLife Android`
4. **Debug signing certificate SHA-1:** optional for now (skip → **Register app**)
5. **Download `google-services.json`**
6. Copy file to:

   ```
   apps/mobile/android/app/google-services.json
   ```

7. Click **Next** through remaining steps (SDK steps already done in this repo) → **Continue to console**

### 1.3 Enable App Distribution

1. Firebase Console → **Release & Monitor** → **App Distribution**
2. **Get started**
3. **Testers & Groups** → **Add group**
   - Name: `founding-testers`
   - Add emails (yours, family, friends — people who will actually open the app)

### 1.4 Link Google Play (recommended)

1. Firebase → **Project settings** (gear) → **Integrations**
2. **Google Play** → **Link**
3. Select your Play Console app **MotiveLife** (`com.mymotivelife.app`)

This connects crash/analytics and Play pre-launch reports later.

---

## Part 2 — Sync Android project (5 min)

After `google-services.json` is in place:

```powershell
cd C:\Users\Mazen\Documents\motivelife.ai\apps\mobile
npm run cap:sync
```

Open Android Studio → **Sync Project with Gradle Files** (elephant icon).

The app already applies the Google Services plugin when `google-services.json` exists.

**Do not commit** `google-services.json` if the repo is public — keep it local (gitignored). Your machine only needs the file.

---

## Part 3 — Firebase CLI + distribute a build (optional, for early testers)

### 3.1 Install CLI

```powershell
npm install -g firebase-tools
firebase login
```

### 3.2 Get your Firebase Android App ID

Firebase Console → **Project settings** → **Your apps** → Android app  
Copy **App ID** (looks like `1:123456789:android:abc123def456`)

### 3.3 Upload AAB to Firebase App Distribution

After you build `app-release.aab` in Android Studio:

```powershell
firebase appdistribution:distribute "C:\path\to\app-release.aab" `
  --app YOUR_FIREBASE_ANDROID_APP_ID `
  --groups "founding-testers" `
  --release-notes "MotiveLife v1.0.0 — first closed beta"
```

Testers get an email → install the Firebase App Tester app → install MotiveLife.

> This is great for friends **before** Play testing is ready. It does **not** replace Play closed testing for the 14-day rule.

---

## Part 4 — Play Console closed testing (required for launch)

### 4.1 Create the app in Play Console

1. [Google Play Console](https://play.google.com/console)
2. **Create app** → MotiveLife, free app, etc.
3. Complete **Dashboard** setup tasks (privacy policy URL, content rating, etc.)

### 4.2 Closed testing track

1. **Testing → Closed testing** → **Create track** (or use default "Closed testing")
2. **Create new release**
3. **Upload** your `app-release.aab`
4. Release name: `1.0.0 (1)` → **Save** → **Review release** → **Start rollout to Closed testing**

### 4.3 Add testers (need **12** for production access)

**Option A — Email list (easiest)**

1. **Testing → Testers** → **Create email list**
2. Name: `Founding testers`
3. Add **at least 12 emails** (real people who will install and keep the app)
4. **Closed testing** track → **Testers** tab → add the list

**Don't have 12 people?** See `docs/GETTING_12_TESTERS.md`.

**Option B — Share link**

1. Closed testing → **Testers** → **Copy link**
2. Share link; testers must opt in with Google account

### 4.4 Testers install from Play Store

1. Testers open the **opt-in link** on their Android phone
2. Accept invitation
3. Install **MotiveLife** from Play Store (shows as beta)
4. They must **open the app** at least once

### 4.5 Wait 14 days

1. Play Console → **Dashboard** → look for **Production access** / testing requirements
2. Requirement: **12 testers** opted in for **14 continuous days** (Google may adjust — follow what Console shows)
3. After met → **Apply for production** → submit for review

---

## Part 5 — Checklist

### Firebase
- [ ] Firebase project **MotiveLife** created
- [ ] Android app `com.mymotivelife.app` registered
- [ ] `google-services.json` in `apps/mobile/android/app/`
- [ ] `npm run cap:sync` + Gradle sync in Android Studio
- [ ] App Distribution group `founding-testers` with emails
- [ ] (Optional) Firebase CLI distribute first AAB

### Play Console
- [ ] App created, package `com.mymotivelife.app`
- [ ] Store listing + privacy policy + data safety
- [ ] AAB uploaded to **Closed testing**
- [ ] 20+ testers on email list or link shared
- [ ] Testers installed from Play (not sideload only)
- [ ] 14 days elapsed → apply for **Production**

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `google-services.json` missing | Re-download from Firebase → correct path under `android/app/` |
| Package name mismatch | Firebase, Play, and `applicationId` must all be `com.mymotivelife.app` |
| Testers don't see app | They must accept invite link while signed into same Google account on phone |
| Firebase distribute fails | Run `firebase login` again; verify App ID |
| Production still locked | Need **12** opted-in testers for **14 days** on **closed testing** — see `docs/GETTING_12_TESTERS.md` |
| **Test Lab Robo crash (WebView)** | **Normal for Capacitor/WebView apps.** Robo can't crawl web content and may crash Chrome WebView. **Not required for launch.** Re-run with `apps/mobile/robo_script.json` (WAIT 45s) or skip Test Lab entirely. Your Z Fold working is what matters. |

---

## File locations

| File | Path |
|------|------|
| Firebase config | `apps/mobile/android/app/google-services.json` (you add) |
| Example | `apps/mobile/android/app/google-services.json.example` |
| Signed AAB | `apps/mobile/android/app/release/` (after Android Studio build) |
| Store copy | `docs/PLAY_STORE_LAUNCH.md` |
