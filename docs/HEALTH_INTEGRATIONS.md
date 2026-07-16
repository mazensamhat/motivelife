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
3. Initial sync runs automatically; use **Sync now** anytime

### Metrics synced

- Steps (today)
- Sleep duration (last night)
- Active minutes (today)
- Resting heart rate (today)

---

## Health Connect (Android app)

Samsung Health, Google Fit, and other apps share data into **Health Connect** on Android. The production Android shell is **Expo + EAS** (`apps/mobile-eas`). The WebView posts `health_connect_sync`; native code reads Health Connect via `react-native-health-connect` and returns metrics; the web app POSTs them to `/api/health/sync`.

### User setup (Samsung)

1. Install **Health Connect** (or use system integration on Android 14+)
2. Samsung Health → Settings → **Health Connect** → allow steps, sleep, etc.
3. Open the **MotiveLife** Android app (not the browser) → Integrations / Health → **Sync Health Connect**
4. Grant MotiveLife read access when prompted

### Developer setup (Expo / EAS)

```bash
cd apps/mobile-eas
# deps: react-native-health-connect, expo-health-connect, expo-build-properties
# plugins + Android health permissions are in app.json
eas build --platform android --profile preview   # or production
```

Native entry points:

- `apps/mobile-eas/src/healthConnect.ts` — initialize, permissions, aggregate/read
- `apps/mobile-eas/src/AppShell.tsx` — WebView bridge (`motivelife-health` event)
- `apps/web/src/lib/capacitor-health-bridge.ts` — web → native message + upload

Until a build with `__MOTIVELIFE_NATIVE_HEALTH__` ships, **Sync Health Connect** shows an “update the app” message instead of a silent no-op.

---

## API

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/integrations/fitbit/connect` | GET | Start OAuth |
| `/api/integrations/fitbit/callback` | GET | OAuth callback |
| `/api/integrations/fitbit/disconnect` | POST | Remove tokens |
| `/api/integrations/fitbit/sync` | POST | Pull latest from Fitbit |
| `/api/health/sync` | GET | Integration status + today’s summary |
| `/api/health/sync` | POST | Upload metrics (mobile / future Apple Health) |

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

- **Apple Health** — HealthKit in iOS app, same `/api/health/sync` upload
- **Garmin / Oura** — OAuth APIs similar to Fitbit
