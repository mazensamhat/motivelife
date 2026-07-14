# Auto-post setup — MotiveLife (your accounts)

Your profiles:
- Instagram: https://www.instagram.com/motivelife.ai/
- LinkedIn: https://www.linkedin.com/company/motivelife-ai
- Facebook: https://www.facebook.com/profile.php?id=61591637157893

After setup, **Marketing Agent → Publish** posts directly (or **Schedule** + Publish via Buffer/Zernio). Hashtags are researched via web search (Serper) + AI for signup-focused copy.

**Recommended path (cheapest):** Ops creatives (OpenAI/Gemini/Pollinations/Replicate) + Buffer and/or Zernio for multi-channel publish. Native Meta/LinkedIn below are optional fallbacks.

---

## Part 0 — Buffer + Zernio (recommended, ~15–30 min)

### 0A. Buffer

1. Sign up at [buffer.com](https://buffer.com) and connect LinkedIn / IG / FB / X / etc.
2. Create an API key in Buffer developer settings
3. Copy each connected **channel id**
4. Vercel Production:

```
MARKETING_PUBLISH_PROVIDER=auto
MARKETING_BUFFER_API_KEY=your_buffer_key
MARKETING_BUFFER_CHANNEL_LINKEDIN=channel_id
MARKETING_BUFFER_CHANNEL_INSTAGRAM=channel_id
MARKETING_BUFFER_CHANNEL_FACEBOOK=channel_id
MARKETING_BUFFER_CHANNEL_X=channel_id
# optional: THREADS, TIKTOK, YOUTUBE, REDDIT
```

### 0B. Zernio (~$19/mo Ayrshare-style alternative)

1. Sign up at [zernio.com](https://zernio.com) and connect social accounts
2. Copy API key + account IDs
3. Vercel:

```
MARKETING_ZERNIO_API_KEY=your_zernio_key
MARKETING_ZERNIO_TIMEZONE=America/New_York
MARKETING_ZERNIO_ACCOUNT_LINKEDIN=account_id
MARKETING_ZERNIO_ACCOUNT_INSTAGRAM=account_id
MARKETING_ZERNIO_ACCOUNT_FACEBOOK=account_id
# optional: X, THREADS, TIKTOK, YOUTUBE, REDDIT
```

With `MARKETING_PUBLISH_PROVIDER=auto`, Ops uses Buffer when ready, otherwise Zernio.

### 0C. Verify

1. `/admin` → Marketing Agent
2. Pills: `buffer: API`, `zernio: API` when keys are set
3. Generate → optional Image / GIF / video creative → optional Schedule → **Publish**

---

## Part A — Hashtag web research (5 min)

1. Go to [serper.dev](https://serper.dev) → sign up (free tier: 2,500 searches)
2. **API Key** → copy key
3. **Vercel → motivelife-web → Environment Variables → Production:**

```
SERPER_API_KEY=your_serper_key
```

4. Redeploy

Without this key, hashtags still work from AI + brand defaults — web research makes them stronger.

---

## Part B — Meta (Facebook + Instagram) (30–45 min)

### B1. Create Meta app

1. [developers.facebook.com](https://developers.facebook.com/) → **My Apps → Create App**
2. Type: **Business**
3. Name: `MotiveLife Marketing`
4. Connect to your **Facebook Business** (or create one)

### B2. Connect your Page + Instagram

1. Meta app → **Add products** → **Facebook Login for Business** (or use Graph API Explorer)
2. Ensure your **Facebook Page** (id `61591637157893`) is linked to app
3. Instagram **motivelife.ai** must be a **Business/Creator** account linked to that Facebook Page:
   - Instagram app → **Settings → Account → Sharing to other apps**
   - Or Meta Business Suite → link Instagram to Page

### B3. Get Page Access Token (long-lived)

1. [Graph API Explorer](https://developers.facebook.com/tools/explorer/)
2. Select your app
3. **User or Page** → select your **MotiveLife Facebook Page**
4. Permissions: `pages_manage_posts`, `pages_read_engagement`, `instagram_basic`, `instagram_content_publish`
5. **Generate Access Token**
6. Extend to long-lived token (Meta docs: exchange short-lived for long-lived, ~60 days; Page tokens can be non-expiring)

### B4. Get Instagram Business Account ID

In Graph API Explorer, run:

```
GET /61591637157893?fields=instagram_business_account
```

Response includes `"instagram_business_account": { "id": "1784..." }` — copy that **id**.

### B5. Add to Vercel

```
MARKETING_META_ACCESS_TOKEN=your_page_access_token
MARKETING_META_PAGE_ID=61591637157893
MARKETING_INSTAGRAM_ACCOUNT_ID=1784xxxxxxxxxxxx
MARKETING_POST_IMAGE_URL=https://www.mymotivelife.com/icon.png
```

Redeploy.

---

## Part C — LinkedIn (20–30 min)

### C1. Create LinkedIn app

1. [linkedin.com/developers](https://www.linkedin.com/developers/) → **Create app**
2. App name: `MotiveLife Marketing`
3. LinkedIn Page: select **motivelife-ai** company page
4. Verify app (URL / email)

### C2. Products

Enable **Share on LinkedIn** and **Marketing Developer Platform** (for company posts).

### C3. Get Organization ID

1. LinkedIn company admin → **motivelife-ai** page URL is `company/motivelife-ai`
2. Or API: `GET https://api.linkedin.com/v2/organizations?q=vanityName&vanityName=motivelife-ai`
3. Copy numeric **id** (not vanity name)

### C4. Access token

1. OAuth 2.0 → request scopes: `w_organization_social`, `r_organization_social`
2. Complete auth as page admin
3. Copy **access token**

### C5. Add to Vercel

```
MARKETING_LINKEDIN_ACCESS_TOKEN=your_token
MARKETING_LINKEDIN_ORG_ID=12345678
```

Redeploy.

---

## Part C6 — Reddit (optional)

1. [reddit.com/prefs/apps](https://www.reddit.com/prefs/apps) → create a **script** or **web** app
2. Add Vercel env: `MARKETING_REDDIT_CLIENT_ID`, `MARKETING_REDDIT_CLIENT_SECRET`, `MARKETING_REDDIT_USERNAME`, `MARKETING_REDDIT_SUBREDDIT`, and either `MARKETING_REDDIT_REFRESH_TOKEN` or `MARKETING_REDDIT_PASSWORD`
3. Start with `MARKETING_REDDIT_SUBREDDIT=test` to verify
4. Redeploy → Marketing Agent should show `reddit: API`
5. See `docs/MARKETING_AGENT.md` for full notes (subreddit rules, profile posts)

---

## Part D — Verify MotiveLife in Ops Console

1. https://www.mymotivelife.com/admin → **Marketing Agent**
2. Status pills should show (as configured):
   - `buffer` / `zernio`
   - and/or native `linkedin` / `facebook` / `instagram`
3. **Generate drafts** → optional Image / GIF / video → optional Schedule → **Publish**
4. Confirm post appears (or is scheduled) on each platform

---

## Vercel checklist (copy/paste names)

| Variable | Your value |
|----------|------------|
| `SERPER_API_KEY` | From serper.dev |
| `MARKETING_PUBLISH_PROVIDER` | `auto` / `buffer` / `zernio` |
| `MARKETING_BUFFER_API_KEY` | Buffer API key |
| `MARKETING_BUFFER_CHANNEL_*` | Per-channel Buffer IDs |
| `MARKETING_ZERNIO_API_KEY` | Zernio API key |
| `MARKETING_ZERNIO_ACCOUNT_*` | Per-channel Zernio account IDs |
| `MARKETING_ZERNIO_TIMEZONE` | e.g. `America/New_York` |
| `MARKETING_META_ACCESS_TOKEN` | Meta Page token (native fallback) |
| `MARKETING_META_PAGE_ID` | `61591637157893` |
| `MARKETING_INSTAGRAM_ACCOUNT_ID` | From Graph API |
| `MARKETING_POST_IMAGE_URL` | `https://www.mymotivelife.com/icon.png` |
| `MARKETING_LINKEDIN_ACCESS_TOKEN` | LinkedIn OAuth token (native fallback) |
| `MARKETING_LINKEDIN_ORG_ID` | Numeric org id |
| `MARKETING_REDDIT_CLIENT_ID` | Reddit app client id (native fallback) |
| `MARKETING_REDDIT_CLIENT_SECRET` | Reddit app secret |
| `MARKETING_REDDIT_USERNAME` | Reddit username |
| `MARKETING_REDDIT_REFRESH_TOKEN` | Preferred (or use PASSWORD for script apps) |
| `MARKETING_REDDIT_SUBREDDIT` | e.g. `test` or `u_yourusername` |
| `REPLICATE_API_TOKEN` | Optional — ~5s MP4 animations (replicate.com) |
| `BLOB_READ_WRITE_TOKEN` | Optional — Vercel Blob for large MP4 files |
| `MARKETING_APP_SCREENSHOT_URLS` | Optional JSON array of public app screenshot URLs |

Per-post creatives from **Marketing Agent → Image / 5s animation** override `MARKETING_POST_IMAGE_URL` for Instagram when set.

---

## Part E — MotiveFX (separate Meta + LinkedIn)

MotiveFX posts from the Marketing Agent use **per-brand** env vars so they publish to MotiveFX social accounts, not MotiveLife.

**MotiveFX profiles (fill in your actual URLs):**
- Website: https://www.motivefxai.com
- YouTube: https://www.youtube.com/channel/UCIXSsWKLSitr8mtlRZ20TfA  
  - Channel ID: `UCIXSsWKLSitr8mtlRZ20TfA`  
  - Studio: https://studio.youtube.com/channel/UCIXSsWKLSitr8mtlRZ20TfA  
- LinkedIn: `https://www.linkedin.com/company/YOUR-MOTIVEFX-SLUG` (vanity slug from company admin)
- Facebook / Instagram: your MotiveFX Page + IG Business account

### E0. YouTube Shorts (native Data API — no Buffer/Zernio)

Ops generates 9:16 Shorts MP4s and uploads via **YouTube Data API v3** (resumable `videos.insert`). Quota ≈ **1,600 units/upload** (~6 Shorts/day on default GCP quota).

1. [Google Cloud Console](https://console.cloud.google.com/) → enable **YouTube Data API v3**
2. Create OAuth **Web** client (or reuse Calendar’s `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`)
3. Authorized redirect URI for local script: `http://127.0.0.1:8765/callback`
4. Run one-time OAuth as the Google account that **owns** the MotiveFX channel:

```powershell
cd packages/marketing-agent
$env:MARKETING_YOUTUBE_CLIENT_ID="..."   # or GOOGLE_CLIENT_ID
$env:MARKETING_YOUTUBE_CLIENT_SECRET="..."
node ./scripts/youtube-oauth.mjs
```

5. Paste the printed **refresh_token** into Vercel Production:

```
MARKETING_YOUTUBE_CLIENT_ID=...          # or rely on GOOGLE_CLIENT_ID
MARKETING_YOUTUBE_CLIENT_SECRET=...
MARKETING_MOTIVEFX_YOUTUBE_CHANNEL_ID=UCIXSsWKLSitr8mtlRZ20TfA
MARKETING_MOTIVEFX_YOUTUBE_REFRESH_TOKEN=1//...
# optional: MARKETING_YOUTUBE_PRIVACY=public|unlisted|private
```

6. Redeploy → Marketing Agent → brand **MotiveFX** → channel **YouTube** → Generate → **5s video** → **Publish**

Studio: https://studio.youtube.com/channel/UCIXSsWKLSitr8mtlRZ20TfA

### E1. Meta (Facebook + Instagram)

1. In Meta Business Suite, link your **MotiveFX Facebook Page** and **MotiveFX Instagram Business** account.
2. Assign your System User to both assets (same token as MotiveLife is fine).
3. Get the MotiveFX Page ID and IG Business Account ID via Graph API Explorer:

```
GET /{MOTIVEFX_PAGE_ID}?fields=instagram_business_account
```

4. Add to **Vercel → motivelife-web → Production:**

```
MARKETING_MOTIVEFX_META_PAGE_ID=your_motivefx_page_id
MARKETING_MOTIVEFX_INSTAGRAM_ACCOUNT_ID=1784xxxxxxxxxxxx
MARKETING_MOTIVEFX_POST_IMAGE_URL=https://www.motivefxai.com/brand/motivefx-icon.png
```

`MARKETING_META_ACCESS_TOKEN` is shared unless you set `MARKETING_MOTIVEFX_META_ACCESS_TOKEN`.

5. Redeploy. In **Marketing Agent**, select brand **MotiveFX** — status badges should show `MotiveFX · instagram: API`.

### E2. LinkedIn (separate Developer app)

LinkedIn ties each Developer app to **one** company page at creation. MotiveLife already uses an app on **motivelife-ai** — MotiveFX needs its **own** app on the MotiveFX company page (same products and scopes, separate verification).

1. [linkedin.com/developers](https://www.linkedin.com/developers/) → **Create app**
2. App name: `MotiveFX Marketing`
3. LinkedIn Page: select your **MotiveFX** company page (not MotiveLife)
4. Verify app (URL / email on the page you admin)
5. **Products** → enable **Share on LinkedIn** and **Marketing Developer Platform**
6. Submit **Marketing Developer Platform** verification (see checklist below)
7. **Auth** → OAuth 2.0 scopes: `w_organization_social`, `r_organization_social`
8. Complete OAuth as a MotiveFX page **super admin** → copy **access token**

**Organization ID** (numeric — not the vanity slug):

- Company admin URL: `linkedin.com/company/{vanity}` → use API or admin tools for numeric id
- Or: `GET https://api.linkedin.com/v2/organizations?q=vanityName&vanityName={YOUR-MOTIVEFX-SLUG}`

**Composer URL** (manual Share button — opens company post admin):

```
https://www.linkedin.com/company/{YOUR-MOTIVEFX-SLUG}/admin/page-posts/published/
```

9. Add to **Vercel → motivelife-web → Production:**

```
MARKETING_MOTIVEFX_LINKEDIN_ACCESS_TOKEN=your_motivefx_app_token
MARKETING_MOTIVEFX_LINKEDIN_ORG_ID=12345678
```

Use a **dedicated** `MARKETING_MOTIVEFX_LINKEDIN_ACCESS_TOKEN` from the MotiveFX app. The shared `MARKETING_LINKEDIN_ACCESS_TOKEN` is the MotiveLife app token and posts to `MARKETING_LINKEDIN_ORG_ID` only.

Optional — point manual Share at MotiveFX (global composer URL today; MotiveLife default is `motivelife-ai`):

```
NEXT_PUBLIC_MARKETING_LINKEDIN_COMPOSER_URL=https://www.linkedin.com/company/YOUR-MOTIVEFX-SLUG/admin/page-posts/published/
```

10. Redeploy. **Marketing Agent** → brand **MotiveFX** → `linkedin: ready` when both vars are set.

### MotiveFX — LinkedIn verification submission (copy for the form)

| Field | What to enter |
|-------|----------------|
| **LinkedIn Page** | MotiveFX company page (super-admin on this page) |
| **App name** | MotiveFX Marketing |
| **Privacy policy URL** | `https://www.motivefxai.com/privacy` (must be live before submit — publish if 404) |
| **App use case** | Internal marketing tool: our team drafts posts in MotiveLife Ops Console and publishes to the **MotiveFX** LinkedIn company page. No third-party access. |
| **Products requested** | **Share on LinkedIn**, **Marketing Developer Platform** |
| **OAuth scopes** | `w_organization_social`, `r_organization_social` |
| **Website / redirect** | `https://www.motivefxai.com` (and OAuth redirect URLs configured in the MotiveFX app) |
| **Demo** | Short screen recording: Marketing Agent → MotiveFX brand → Generate → Publish → post on MotiveFX page |

---

## Part F — MotivePulse IQ (separate Meta + LinkedIn)

MotivePulse IQ posts use **per-brand** env vars (`MARKETING_MOTIVEPULSE_*`) so they publish to MotivePulse social accounts, not MotiveLife or MotiveFX.

**You can generate drafts immediately** by selecting brand **MotivePulse IQ** in Marketing Agent — social API credentials are only required to auto-publish.

**MotivePulse profiles (fill in when ready):**
- Website: https://www.mymotivepulse.com
- LinkedIn / Facebook / Instagram: your MotivePulse company page + IG Business account

### F1. Meta (Facebook + Instagram)

1. Link your **MotivePulse Facebook Page** and **Instagram Business** account in Meta Business Suite.
2. Assign your System User (shared token with MotiveLife is fine if same Business Manager).
3. Add to **Vercel → motivelife-web → Production:**

```
MARKETING_MOTIVEPULSE_META_PAGE_ID=your_motivepulse_page_id
MARKETING_MOTIVEPULSE_INSTAGRAM_ACCOUNT_ID=1784xxxxxxxxxxxx
MARKETING_MOTIVEPULSE_POST_IMAGE_URL=https://www.mymotivepulse.com/brand/motivepulse-iq-logo.png
```

`MARKETING_META_ACCESS_TOKEN` is shared unless you set `MARKETING_MOTIVEPULSE_META_ACCESS_TOKEN`.

4. Redeploy. **Marketing Agent** → brand **MotivePulse IQ** — status should show API-ready when Page IDs are set.

### F2. LinkedIn

Same pattern as MotiveFX: create a **MotivePulse Marketing** LinkedIn Developer app tied to the MotivePulse company page, then set:

```
MARKETING_MOTIVEPULSE_LINKEDIN_ACCESS_TOKEN=your_motivepulse_app_token
MARKETING_MOTIVEPULSE_LINKEDIN_ORG_ID=12345678
```

**Save every token in your password manager.**

---

## Troubleshooting

| Error | Fix |
|-------|-----|
| Instagram "Media ID is not available" | Wait 30–60s and Publish again (app polls Meta until ready). If it persists, open **Public URL** — Meta must fetch the image from `mymotivelife.com/api/marketing/media/...` |
| MotiveFX posts go to MotiveLife IG | Set `MARKETING_MOTIVEFX_META_PAGE_ID` + `MARKETING_MOTIVEFX_INSTAGRAM_ACCOUNT_ID` and select MotiveFX brand |
| MotiveFX LinkedIn posts go to MotiveLife | Set `MARKETING_MOTIVEFX_LINKEDIN_ORG_ID` + `MARKETING_MOTIVEFX_LINKEDIN_ACCESS_TOKEN` (MotiveFX app token); select MotiveFX brand |
| MotivePulse posts go to MotiveLife IG | Set `MARKETING_MOTIVEPULSE_META_PAGE_ID` + `MARKETING_MOTIVEPULSE_INSTAGRAM_ACCOUNT_ID` and select MotivePulse IQ brand |
| Facebook token invalid | Regenerate Page token with `pages_manage_posts` |
| LinkedIn 403 | Token needs `w_organization_social`; use numeric org id not vanity name; app must be verified for that page |
| Still says "manual" | Redeploy after adding ALL vars for that platform |

---

## TikTok (later)

TikTok Content Posting API requires separate app review. Use **Copy** for TikTok until approved.
