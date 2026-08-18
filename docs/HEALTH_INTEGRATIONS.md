# Health integrations — Fitbit & Health Connect

MotiveLife syncs wearable and phone health data into `HealthMetric` rows, then rolls values into your `HealthItem` targets (steps, sleep, etc.).

## Fitbit (web) — Google Health API

New Fitbit integrations use the **Google Health API** and **Google OAuth** (not dev.fitbit.com — that form is closed for new apps).

### 1. Google Cloud setup

1. Open [Google Health API setup](https://developers.google.com/health/setup) or use your existing MotiveLife Google Cloud project.
2. **Enable** the Google Health API.
3. **Credentials** → Create **OAuth client ID** → **Web application**.
4. **Authorized redirect URIs** (required):  
   `https://www.mymotivelife.com/api/integrations/fitbit/callback`  
   Local dev: `http://localhost:3002/api/integrations/fitbit/callback`
5. **OAuth consent screen → Data access** → add Google Health API scopes (activity, sleep, health metrics, profile).
6. **Test users** → add your Google account while in Testing mode.

### 2. Vercel environment variables

| Variable | Example |
|----------|---------|
| `FITBIT_CLIENT_ID` | Google OAuth Client ID (`*.apps.googleusercontent.com`) |
| `FITBIT_CLIENT_SECRET` | Google OAuth Client secret |
| `FITBIT_REDIRECT_URI` | `https://www.mymotivelife.com/api/integrations/fitbit/callback` |

Redeploy after adding env vars.

### 3. User flow

1. **Integrations** → **Connect Fitbit**
2. Sign in with **Google** and approve health data access
3. Initial sync runs automatically; MotiveLife keeps pulling in the background (app open + hourly cron). Use **Sync now** anytime.

### Metrics synced

- Steps (today)
- Sleep duration (last night)
- Active minutes (today)
- Resting heart rate (today)

---

## Health Connect (Android app)

Samsung Health, Google Fit, and other apps share data into **Health Connect** on Android. **Samsung Galaxy Watch** data typically flows: watch → Samsung Health → Health Connect → MotiveLife.

| Shell | Path | Health Connect |
|-------|------|----------------|
| **Capacitor (Play Store)** | `apps/mobile` | `@capgo/capacitor-health` — steps, heart rate (+ calories available) |
| **Expo + EAS** | `apps/mobile-eas` | `react-native-health-connect` — steps, sleep, resting HR, exercise |

The web bridge (`apps/web/src/lib/capacitor-health-bridge.ts`) tries Capacitor `Plugins.Health` first, then the Expo WebView `health_connect_sync` bridge.

### User setup (Samsung)

1. Install **Health Connect** (or use system integration on Android 14+)
2. Samsung Health → Settings → **Health Connect** → allow steps, heart rate, sleep, etc.
3. Open the **MotiveLife** Android app (not the browser) → Vitalu or Health. The first visit prompts for Health Connect access; after that it syncs automatically.
4. Grant MotiveLife read access when prompted. Tap **Sync phone health now** only if you need an immediate refresh.

### Developer setup — Capacitor (Play)

```powershell
cd apps\mobile
npm install
npx cap sync android
npm run build:android:release   # needs android/keystore.properties + upload .jks
```

Upload `android/app/build/outputs/bundle/release/app-release.aab` to Play Console (versionCode must increase).

### Developer setup — Expo / EAS

```bash
cd apps/mobile-eas
# requires: eas login  (or EXPO_TOKEN)
eas build --platform android --profile production
```

Native entry points:

- Capacitor: `@capgo/capacitor-health` + `scripts/configure-native.mjs` (manifest / privacy URL / minSdk 26)
- Expo: `apps/mobile-eas/src/healthConnect.ts` + `AppShell.tsx`
- Web: `apps/web/src/lib/capacitor-health-bridge.ts`

---

## Apple Health (iOS app)

**Apple Watch** data flows: watch → Apple Health → MotiveLife iOS app → Vitalu.

| Shell | Path | Apple Health |
|-------|------|----------------|
| **Expo + EAS** | `apps/mobile-eas` | `@kingstinct/react-native-healthkit` — steps, sleep, resting HR, exercise minutes |

The web bridge uses the same `health_connect_sync` WebView message; native code routes to `appleHealth.ts` on iOS.

### User setup (Apple Watch)

1. Pair Apple Watch and confirm the Health app shows steps/sleep/workouts
2. Open the **MotiveLife** iOS app (App Store build) → Vitalu. The first visit prompts for Apple Health access; after that it syncs automatically when you open the app.
3. Grant read access for steps, sleep, heart rate, and exercise when prompted. Tap **Sync Apple Health now** only if you need an immediate refresh.

### Developer setup — Expo / EAS (iOS)

```bash
cd apps/mobile-eas
eas build --platform ios --profile production
```

Native entry points:

- `apps/mobile-eas/src/appleHealth.ts` + `AppShell.tsx`
- Config plugin: `@kingstinct/react-native-healthkit` in `app.json` (HealthKit entitlement)

Requires a **new native build** — Apple Health does not work in Expo Go or older App Store builds without HealthKit.

---

## Automatic sync

Vitalu correlates whatever is already stored, then refreshes sources without a tap:

| Source | When it syncs |
|--------|----------------|
| **Fitbit / Google Health** | When you open Vitalu or Integrations (if last pull is older than 15 minutes), plus an hourly cron (`/api/cron/health-sync`) |
| **Apple Health / Health Connect** | When you open Vitalu, Health, Integrations, or Dashboard in the MotiveLife app; again when the app returns to the foreground; every 15 minutes while it stays open |

The first native read still needs a one-time OS permission. After that, MotiveLife remembers and keeps pulling. Manual **Sync now** remains available.

---

## API

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/integrations/fitbit/connect` | GET | Start OAuth |
| `/api/integrations/fitbit/callback` | GET | OAuth callback |
| `/api/integrations/fitbit/disconnect` | POST | Remove tokens |
| `/api/integrations/fitbit/sync` | POST | Pull latest from Fitbit |
| `/api/cron/health-sync` | GET | Hourly stale Fitbit pull (cron secret) |
| `/api/health/sync` | GET | Integration status + today’s summary (also auto-pulls stale Fitbit) |
| `/api/health/sync` | POST | Upload metrics (Health Connect / Apple Health / Fitbit) |

### POST body (health sync)

```json
{
  "metrics": [
    {
      "source": "health_connect",
      "metricType": "steps",
      "value": 8420,
      "unit": "steps",
      "periodStart": "2026-07-06T00:00:00.000Z",
      "periodEnd": "2026-07-06T23:59:59.000Z",
      "externalId": "steps-2026-07-06"
    }
  ]
}
```

`metricType`: `steps` | `sleep_minutes` | `resting_hr` | `active_minutes`  
`source`: `fitbit` | `health_connect` | `apple_health`

---

## Database

After pulling schema changes:

```bash
npx pnpm@9.15.0 db:push
```

New models/enums: `HealthMetric`, `IntegrationProvider.FITBIT`, `IntegrationProvider.HEALTH_CONNECT`.

---

## Planned

- **Garmin / Oura** — OAuth APIs similar to Fitbit
