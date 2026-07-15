# Marketing Agent

Shared AI marketing system for **MotiveLife**, **MotiveFX**, and **MotiveIQ**.

## What it does

| Capability | Status |
|------------|--------|
| AI draft social posts (LinkedIn, IG, FB, TikTok) | ✅ Ops Console |
| SEO page briefs (title, meta, keywords, body) | ✅ Ops Console |
| SEO publish to live `/blog` pages | ✅ Ops Console |
| Google Ads copy drafts | ✅ Ops Console |
| Auto-publish via Buffer / Zernio / native APIs | ✅ when env keys set |
| YouTube Shorts (native Data API upload) | ✅ when YouTube OAuth refresh token set |
| Manual fallback (copy to clipboard) | ✅ always |
| Image generation (DALL·E, app-branded) | ✅ Ops Console |
| ~5s animation (MP4 via Replicate or Ken Burns GIF) | ✅ Ops Console |
| Schedule via Buffer / Zernio (datetime in Ops) | ✅ Ops Console |
| Google Search Console sync | Phase 2 |
| Google Ads campaign create | Phase 2 |

## Where to use it

**MotiveLife Ops Console** → `/admin` → **Marketing Agent** panel

Same `@forward/marketing-agent` package can be imported by MotiveFX and MotiveIQ apps later.

## Flow

1. Pick **brand** (MotiveLife / MotiveFX / MotiveIQ)
2. Pick **channels** (LinkedIn, Instagram, etc.)
3. Enter a **brief** (“Launch week post about voice organize”)
4. **Generate drafts** — AI creates platform-specific copy + SEO if selected
5. **Review** each draft in the list
6. **Generate image / GIF / short video** (optional) — Ops creatives
7. **Publish** (or set **Schedule** + Publish) — Buffer/Zernio/native API, else copy for manual paste

## Unified publish (Buffer + Zernio) — recommended

Cheapest path to post LinkedIn, Instagram, Facebook, X, Threads, TikTok, YouTube, Reddit from Ops without per-platform OAuth for every brand.

1. Connect accounts in [Buffer](https://buffer.com) and/or [Zernio](https://zernio.com)
2. Copy channel/account IDs into Vercel env (below)
3. Set `MARKETING_PUBLISH_PROVIDER=auto` (prefer Buffer, else Zernio) or pin `buffer` / `zernio`
4. Ops pills show `buffer` / `zernio` when keys are present
5. Optional **Schedule** datetime → Buffer/Zernio schedules the post

Native Meta / LinkedIn / Reddit still work as fallback when Buffer/Zernio are not mapped for that channel. **YouTube Shorts** use the native Data API when `MARKETING_*_YOUTUBE_REFRESH_TOKEN` is set (preferred over Buffer/Zernio) — see `docs/AUTO_POST_SETUP.md` Part E0.

## Creatives (images & narrated video)

The agent builds prompts from the **real MotiveLife app** visual kit and conditions every Image / GIF / video still on **product UI screenshots** (Today, Voice Organize, Life Graph) — not logos.

| Action | How |
|--------|-----|
| Static image | Reimagines a real UI frame via OpenAI/Gemini (ops paste overrides) |
| 5s narrated MP4 | Still → Replicate I2V → script + TTS → mux (silent MP4 + voice player if mux fails) |
| 15s narrated MP4 | Still → I2V motion base → Ken Burns extend to 15s → script + TTS → mux |
| 30s narrated MP4 | Still → Ken Burns to 30s → script + TTS → mux |
| ~5s GIF | Ken Burns when you only need a lightweight animation |

### Publish format & privacy (per draft)

On every social draft in Ops, pick **Publish as** before Publish:

| Channel | Options (default) |
|---------|-------------------|
| YouTube | Shorts (default) / Video + Privacy: Public / Unlisted / Private |
| Instagram | Reels (default for video) / Feed |
| Facebook | Reels / Feed |
| TikTok | Short |
| LinkedIn / X / Threads / Reddit | Feed |

Per-post `publishPrivacy` overrides `MARKETING_YOUTUBE_PRIVACY` when set.

## Post performance (Ops table)

Below **Marketing Agent** on `/admin`, the **Post performance** table shows per-post:

| Column | Source |
|--------|--------|
| Site landings | Clicks through MotiveLife hop `https://www.mymotivelife.com/r/m/<postId>` (works for all brands) |
| Signups | Users who registered with `ml_acq_post` cookie from that hop |
| Platform views / engagement | **Refresh platform stats** — YouTube Data API + Meta insights (best-effort) |

New drafts store `ctaUrl` as the hop URL and `destinationUrl` as the brand site with `utm_content=<postId>`. Older posts get a hop CTA on next successful Publish if missing.

Meta insights may need `pages_read_engagement` / Instagram insights permissions; if sync skips a post, landings still work.

**Shipped MotiveLife references (live after deploy):**

- `https://www.mymotivelife.com/marketing/screenshots/phone-01-today.png`
- `https://www.mymotivelife.com/marketing/screenshots/phone-02-voice.png`
- `https://www.mymotivelife.com/marketing/screenshots/phone-03-life-graph.png`

Brief keywords pick the frame (`voice` → Voice screen, `score`/`graph` → Life Graph, default Today).

**Optional env (Vercel Production):**

```env
# MP4 animation (Replicate — get token at replicate.com)
REPLICATE_API_TOKEN=
MARKETING_VIDEO_MODEL=minimax/video-01
MARKETING_MUX_MODEL=lucataco/video-audio-merge

# Copy / image / voice quality knobs
MARKETING_COPY_MODEL=gpt-4o
MARKETING_IMAGE_QUALITY=high
MARKETING_TTS_MODEL=tts-1-hd
MARKETING_TTS_VOICE=nova
# Default YouTube privacy when a draft has no per-post privacy set
# MARKETING_YOUTUBE_PRIVACY=public

# Override / extend product UI references (JSON array — real UI, not logos)
# MARKETING_APP_SCREENSHOT_URLS=["https://www.mymotivelife.com/marketing/screenshots/phone-01-today.png"]
# MARKETING_MOTIVEFX_APP_SCREENSHOT_URLS=[...]
# MARKETING_MOTIVEPULSE_APP_SCREENSHOT_URLS=[...]
# MARKETING_MOTIVEIQ_APP_SCREENSHOT_URLS=[...]

# Large video storage (recommended for MP4 auto-post to Instagram Reels)
BLOB_READ_WRITE_TOKEN=
```

Without `BLOB_READ_WRITE_TOKEN`, images/GIFs are served from `/api/marketing/media/{postId}` on your domain (works for Meta/Instagram if the URL is public).

**Instagram:** feed posts use PNG/JPG; Reels use MP4. GIF animations are copied with a download link for manual Reels/TikTok upload.

## Auto-publish setup (per platform)

### LinkedIn (company page)

1. [LinkedIn Developer](https://www.linkedin.com/developers/) → create app
2. Products: **Share on LinkedIn**, **Marketing Developer Platform**
3. OAuth → get access token with `w_organization_social`
4. Vercel env:
   - `MARKETING_LINKEDIN_ACCESS_TOKEN`
   - `MARKETING_LINKEDIN_ORG_ID` (numeric org ID from company page URL)

### Instagram + Facebook (Meta)

1. [Meta for Developers](https://developers.facebook.com/) → app
2. Connect Instagram Business account to Facebook Page
3. Permissions: `pages_manage_posts`, `instagram_content_publish`
4. Vercel env:
   - `MARKETING_META_ACCESS_TOKEN` (long-lived page token)
   - `MARKETING_META_PAGE_ID`

### TikTok

1. [TikTok for Developers](https://developers.tiktok.com/) → Content Posting API
2. App review required for auto-post
3. Until approved: use **Publish** → copies to clipboard

### Reddit

1. Go to [reddit.com/prefs/apps](https://www.reddit.com/prefs/apps) → **create another app…**
2. Choose **script** (personal bot) or **web app** (refresh token)
3. Note **client id** (under the app name) and **secret**
4. Vercel env (MotiveLife defaults):

```env
MARKETING_REDDIT_CLIENT_ID=
MARKETING_REDDIT_CLIENT_SECRET=
MARKETING_REDDIT_USERNAME=your_reddit_username
# Prefer refresh token (web app + duration=permanent). Password works for script apps only.
MARKETING_REDDIT_REFRESH_TOKEN=
# MARKETING_REDDIT_PASSWORD=
MARKETING_REDDIT_SUBREDDIT=test
# Optional — defaults to web:motivelife-marketing:1.0.0 (by /u/USERNAME)
# MARKETING_REDDIT_USER_AGENT=
```

5. `MARKETING_REDDIT_SUBREDDIT` = destination without `r/` (e.g. `test`, or `u_yourusername` for profile posts)
6. Redeploy → Ops Console should show `reddit: API`
7. Generate a Reddit draft → **Publish** submits a self (text) post via Reddit API

**Notes:** Respect subreddit rules — many ban self-promo. Prefer your own subreddit or profile. Video/GIF auto-upload is not wired yet (text posts work; image URL may post as a link).

Per-brand overrides: `MARKETING_MOTIVEFX_REDDIT_*`, etc.

### Google SEO

- AI generates meta title, description, keywords, and page outline
- **Publish to site** in Ops Console → live page at `/blog/your-slug` + sitemap entry
- Re-publish updates the same slug (or keeps the existing slug on updates)
- **Search Console**: already verified for mymotivelife.com
- Phase 2: auto-suggest pages from Search Console queries

### Google Ads (SEM)

- AI generates headlines + descriptions
- Phase 2: Google Ads API for campaign upload
- Env: `MARKETING_GOOGLE_ADS_DEVELOPER_TOKEN` + OAuth (complex — manual export first)

## Environment variables

```env
# Required for AI generation (optional — rule-based fallback if off)
OPENAI_API_KEY=
ENABLE_OPENAI=true

# --- Unified publish (preferred) ---
MARKETING_PUBLISH_PROVIDER=auto
MARKETING_BUFFER_API_KEY=
MARKETING_BUFFER_CHANNEL_LINKEDIN=
MARKETING_BUFFER_CHANNEL_INSTAGRAM=
MARKETING_BUFFER_CHANNEL_FACEBOOK=
MARKETING_BUFFER_CHANNEL_X=
MARKETING_BUFFER_CHANNEL_THREADS=
MARKETING_BUFFER_CHANNEL_TIKTOK=
MARKETING_BUFFER_CHANNEL_YOUTUBE=
MARKETING_BUFFER_CHANNEL_REDDIT=
MARKETING_ZERNIO_API_KEY=
MARKETING_ZERNIO_TIMEZONE=America/New_York
MARKETING_ZERNIO_ACCOUNT_LINKEDIN=
MARKETING_ZERNIO_ACCOUNT_INSTAGRAM=
MARKETING_ZERNIO_ACCOUNT_FACEBOOK=
MARKETING_ZERNIO_ACCOUNT_X=
MARKETING_ZERNIO_ACCOUNT_THREADS=
MARKETING_ZERNIO_ACCOUNT_TIKTOK=
MARKETING_ZERNIO_ACCOUNT_YOUTUBE=
MARKETING_ZERNIO_ACCOUNT_REDDIT=

# --- Native auto-publish fallback (optional) ---
MARKETING_LINKEDIN_ACCESS_TOKEN=
MARKETING_LINKEDIN_ORG_ID=
MARKETING_META_ACCESS_TOKEN=
MARKETING_META_PAGE_ID=
MARKETING_TIKTOK_ACCESS_TOKEN=
MARKETING_REDDIT_CLIENT_ID=
MARKETING_REDDIT_CLIENT_SECRET=
MARKETING_REDDIT_USERNAME=
MARKETING_REDDIT_REFRESH_TOKEN=
MARKETING_REDDIT_SUBREDDIT=
MARKETING_GOOGLE_ADS_DEVELOPER_TOKEN=

# --- Native YouTube Shorts ---
MARKETING_YOUTUBE_CLIENT_ID=
MARKETING_YOUTUBE_CLIENT_SECRET=
MARKETING_MOTIVELIFE_YOUTUBE_CHANNEL_ID=UCzjdFghiI1akeuVeSERu21A
MARKETING_MOTIVELIFE_YOUTUBE_REFRESH_TOKEN=
MARKETING_MOTIVEFX_YOUTUBE_CHANNEL_ID=UCIXSsWKLSitr8mtlRZ20TfA
MARKETING_MOTIVEFX_YOUTUBE_REFRESH_TOKEN=
```

Per-brand overrides: `MARKETING_MOTIVEFX_BUFFER_API_KEY`, `MARKETING_MOTIVEFX_YOUTUBE_REFRESH_TOKEN`, etc.

## Database

Run after pull:

```powershell
npx pnpm@9.15.0 db:push
```

Model: `MarketingPost` — stores drafts, scheduled, and published content per brand/channel.

## Package structure

```
packages/marketing-agent/
  src/brands.ts           # MotiveLife, MotiveFX, MotiveIQ voice & URLs
  src/channels.ts         # Platform limits & env keys
  src/generate.ts         # OpenAI content generation
  src/app-visuals.ts      # Brand colors, UI style, screenshot refs from the app
  src/creatives.ts        # DALL·E images + Replicate MP4
  src/unified-publish.ts  # Buffer GraphQL + Zernio REST
  src/youtube.ts          # Native YouTube Shorts (Data API v3)
  src/index.ts            # publishMarketingPost(), publisher status
```

## Roadmap

1. **Now** — Generate + Ops creatives + native YouTube Shorts + Buffer/Zernio publish/schedule
2. **Next** — Search Console API → SEO topic suggestions
3. **Later** — MotiveFX / MotiveIQ admin panels import same package

## Security

- Admin-only (`ADMIN_EMAILS`)
- Never commit API tokens
- **Save all marketing API passwords in your password manager**
