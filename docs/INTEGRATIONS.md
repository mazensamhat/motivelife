# Calendar integrations

Connect calendars at `/integrations` (Settings → Integrations). Events feed the **AI Command Center** timeline, morning briefings, and schedule-aware suggestions.

## Google Calendar

1. [Google Cloud Console](https://console.cloud.google.com) → your project
2. **APIs & Services → Library** → enable **Google Calendar API**
3. **OAuth consent screen** → External → scope: `calendar.readonly`
4. **Test users** → add emails during testing
5. **Credentials → OAuth client ID** → Web application
6. **Authorized redirect URIs:**
   - `http://localhost:3002/api/integrations/google/callback`
   - `https://www.mymotivelife.com/api/integrations/google/callback`

```env
GOOGLE_CLIENT_ID="....apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-..."
GOOGLE_REDIRECT_URI="http://localhost:3002/api/integrations/google/callback"
```

## Apple Calendar (iCloud CalDAV)

No server env vars. Users connect in the app with:

1. Apple ID with **two-factor authentication** enabled
2. An **app-specific password** from [appleid.apple.com](https://appleid.apple.com/account/manage) → Sign-In and Security → App-Specific Passwords
3. Enter Apple ID email + app password on `/integrations`

MotiveLife stores credentials read-only and merges Apple + Google events (deduped) on the Command Center timeline.

## Mobile (Capacitor)

Google OAuth opens in the WebView. If redirect fails on iOS/Android, open `/integrations` in Safari/Chrome once to connect, or use Apple CalDAV (no OAuth redirect).

## Workload indicator

When either calendar is connected, Today shows **Today / Tomorrow workload %** (7am–10pm busy time vs. available hours).

Restart the dev server after updating `.env.local`.
