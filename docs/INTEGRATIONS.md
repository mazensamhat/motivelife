# Google Calendar integration

Connect Google Calendar at `/integrations` for morning briefings and schedule-aware suggestions.

## Setup

1. [Google Cloud Console](https://console.cloud.google.com) → your project
2. **APIs & Services → Library** → enable **Google Calendar API** (Gmail API not required)
3. **OAuth consent screen** → External → scope: `calendar.readonly`
4. **Test users** → add emails that will connect during testing
5. **Credentials → OAuth client ID** → Web application
6. **Authorized redirect URIs:**
   - `http://localhost:3002/api/integrations/google/callback`
   - `https://motivelife.ai/api/integrations/google/callback` (production)

```env
GOOGLE_CLIENT_ID="....apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-..."
GOOGLE_REDIRECT_URI="http://localhost:3002/api/integrations/google/callback"
```

Restart dev server after updating `.env.local`.

## Production

Add the same variables in Vercel and register the production redirect URI in Google Cloud.
