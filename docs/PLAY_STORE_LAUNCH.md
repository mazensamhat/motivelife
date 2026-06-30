# Launch MotiveLife on Google Play

You’ve already verified the app on your **Z Fold 7**. This guide gets the **production AAB** into Google Play.

**Package ID:** `com.mymotivelife.app`  
**Version:** 1.0.0 (versionCode 1)

---

## Step 1 — Google Play Console

1. Go to [Google Play Console](https://play.google.com/console) ($25 one-time developer fee if new).
2. **Create app**
   - App name: **MotiveLife**
   - Default language: English (Canada)
   - App or game: **App**
   - Free or paid: **Free** (subscription is in-app via Stripe on web)

---

## Step 2 — Build signed release bundle

In **Android Studio** (project: `apps/mobile/android`):

1. **Build → Generate Signed App Bundle / APK**
2. **Android App Bundle** → Next
3. **Create new keystore** (first time only):
   - Path: `apps/mobile/android/keystore/motivelife-release.jks`
   - Password: **save in your password manager — you cannot recover this**
   - Alias: `motivelife`
   - Validity: 25 years
4. Select **release** → **Create**
5. Output: `app-release.aab` (note the folder path shown)

**Never lose the keystore.** You need the same file for every future update.

Optional CLI (after `keystore.properties` is configured from `keystore.properties.example`):

```powershell
cd apps\mobile\android
.\gradlew bundleRelease
```

AAB path: `app\build\outputs\bundle\release\app-release.aab`

---

## Step 3 — Store listing (copy/paste)

### App name
`MotiveLife`

### Short description (80 characters)
```
Just talk. AI turns your thoughts into plans, goals, habits & daily actions.
```

### Full description
```
MotiveLife is your AI life operating system — not another chatbot.

Just talk. MotiveLife turns your voice and thoughts into plans, goals, reminders, habits, and your next action. Wake up to a personalized morning briefing, build streaks with Life Engine, and track progress with your Life Score over time.

WHY MOTIVELIFE
• Voice Organize — brain dump out loud; AI structures tasks and goals
• Morning Briefing — your Chief of Staff tells you what matters today
• Life Engine — one small win every day; streaks that compound
• Life Graph — career, money, health, habits in one private map
• Life GPS — every goal links to your north-star destination

BUILT FOR REAL LIFE
One place instead of juggling notes, calendars, and generic AI chats. MotiveLife remembers your goals, learns your preferences, and pushes you toward the next right move.

TRY FREE
14-day full Pro trial. No credit card required to start.

Privacy-first. PIPEDA-ready. Built in Canada.

https://www.mymotivelife.com
```

### Graphics
| Asset | File |
|-------|------|
| App icon (512×512) | `apps/mobile/assets/icon.png` |
| Feature graphic (1024×500) | Create from logo + tagline in Canva |
| Phone screenshots | Capture from your Z Fold (Today, Voice, Settings) |

### URLs
| Field | URL |
|-------|-----|
| Website | https://www.mymotivelife.com |
| Privacy policy | https://www.mymotivelife.com/privacy |
| Terms | https://www.mymotivelife.com/terms |

### Category
**Productivity** (primary) or **Health & Fitness**

### Contact email
Your support email (e.g. hello@mymotivelife.com)

---

## Step 4 — Upload & release

1. Play Console → **Release → Production** (or **Internal testing** first)
2. **Create new release** → upload `app-release.aab`
3. Complete required sections:
   - **App content** → Privacy policy URL
   - **Data safety** → declare account, email, user content (voice), analytics
   - **Content rating** → questionnaire (typically Everyone / Teen)
   - **Target audience** → 18+ recommended (life/career coaching)
4. **Review and roll out**

Internal testing lets you install via link before public launch (recommended for first release).

---

## Step 5 — After launch

- Monitor **Android vitals** and crash reports in Play Console
- Each update: bump `versionCode` and `versionName` in `android/app/build.gradle`, rebuild AAB, upload
- Web app updates deploy instantly; store updates only needed for native shell / permission changes

---

## iOS (later)

Requires Mac + Apple Developer ($99/year). See `docs/MOBILE_APP.md` → open `apps/mobile/ios` in Xcode.

---

## Checklist

- [ ] Signed AAB built
- [ ] Play Console app created
- [ ] Store listing + screenshots uploaded
- [ ] Privacy policy & data safety completed
- [ ] Internal test on second device (optional)
- [ ] Production release submitted
