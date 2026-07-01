# Auto-post setup — MotiveLife (your accounts)

Your profiles:
- Instagram: https://www.instagram.com/motivelife.ai/
- LinkedIn: https://www.linkedin.com/company/motivelife-ai
- Facebook: https://www.facebook.com/profile.php?id=61591637157893

After setup, **Marketing Agent → Publish** posts directly. Hashtags are researched via web search (Serper) + AI for signup-focused copy.

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

## Part D — Verify in Ops Console

1. https://www.mymotivelife.com/admin → **Marketing Agent**
2. Status pills should show:
   - `linkedin: ready`
   - `facebook: ready`
   - `instagram: ready`
   - `hashtagResearch: ready` (if Serper key set)
3. **Generate drafts** → **Publish** on a test post
4. Confirm post appears on each platform

---

## Vercel checklist (copy/paste names)

| Variable | Your value |
|----------|------------|
| `SERPER_API_KEY` | From serper.dev |
| `MARKETING_META_ACCESS_TOKEN` | Meta Page token |
| `MARKETING_META_PAGE_ID` | `61591637157893` |
| `MARKETING_INSTAGRAM_ACCOUNT_ID` | From Graph API |
| `MARKETING_POST_IMAGE_URL` | `https://www.mymotivelife.com/icon.png` |
| `MARKETING_LINKEDIN_ACCESS_TOKEN` | LinkedIn OAuth token |
| `MARKETING_LINKEDIN_ORG_ID` | Numeric org id |
| `REPLICATE_API_TOKEN` | Optional — ~5s MP4 animations (replicate.com) |
| `BLOB_READ_WRITE_TOKEN` | Optional — Vercel Blob for large MP4 files |
| `MARKETING_APP_SCREENSHOT_URLS` | Optional JSON array of public app screenshot URLs |

Per-post creatives from **Marketing Agent → Image / 5s animation** override `MARKETING_POST_IMAGE_URL` for Instagram when set.

**Save every token in your password manager.**

---

## Troubleshooting

| Error | Fix |
|-------|-----|
| Instagram publish fails | IG must be Business + linked to Page; image URL must be public HTTPS |
| Facebook token invalid | Regenerate Page token with `pages_manage_posts` |
| LinkedIn 403 | Token needs `w_organization_social`; use org id not vanity name |
| Still says "manual" | Redeploy after adding ALL vars for that platform |

---

## TikTok (later)

TikTok Content Posting API requires separate app review. Use **Copy** for TikTok until approved.
