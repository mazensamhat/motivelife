# Health integrations — Fitbit & Health Connect

MotiveLife syncs wearable and phone health data into `HealthMetric` rows, then rolls values into your `HealthItem` targets (steps, sleep, etc.).

## Fitbit (web)

Works on **https://www.mymotivelife.com** and local dev — same OAuth pattern as Google Calendar.

### 1. Register a Fitbit app

1. Go to [dev.fitbit.com](https://dev.fitbit.com/apps/new).
2. **Application type:** Personal (or appropriate for your use).
3. **Callback URL:**  
   `https://www.mymotivelife.com/api/integrations/fitbit/callback`  
   For local dev, also add:  
   `http://localhost:3002/api/integrations/fitbit/callback`
4. **OAuth 2.0 Application Type:** Server
5. Scopes: activity, heartrate, sleep, profile

### 2. Vercel environment variables

| Variable | Example |
|----------|---------|
| `FITBIT_CLIENT_ID` | From Fitbit app settings |
| `FITBIT_CLIENT_SECRET` | From Fitbit app settings |
| `FITBIT_REDIRECT_URI` | `https://www.mymotivelife.com/api/integrations/fitbit/callback` |

Redeploy after adding env vars.

### 3. User flow

1. **Integrations** → **Connect Fitbit**
2. Authorize on Fitbit
3. Initial sync runs automatically; use **Sync now** anytime

### Metrics synced

- Steps (today)
- Sleep duration (last night)
- Active minutes (today)
- Resting heart rate (today)

---

## Health Connect (Android app)

Samsung Health, Google Fit, and other apps share data into **Health Connect** on Android. The MotiveLife native shell reads Health Connect and POSTs to `/api/health/sync`.

### User setup (Samsung)

1. Install **Health Connect** (or use system integration on Android 14+)
2. Samsung Health → Settings → **Health Connect** → allow steps, sleep, etc.
3. Open **MotiveLife** Android app → **Health** → **Sync Health Connect**

### Developer setup (native plugin)

The web bridge (`capacitor-health-bridge.ts`) expects a Capacitor plugin registered as `Health` in the Android app. Recommended package:

```bash
cd apps/mobile
npm install @capgo/capacitor-health
npx cap sync android
```

Configure Android permissions per the plugin README (Health Connect permissions in `AndroidManifest.xml`). Ship a new Play build so the plugin is available in the WebView.

Until the plugin is in the store build, the **Sync Health Connect** button shows a friendly “update the app” message.

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
