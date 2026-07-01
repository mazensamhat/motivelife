# Marketing Agent

Shared AI marketing system for **MotiveLife**, **MotiveFX**, and **MotiveIQ**.

## What it does

| Capability | Status |
|------------|--------|
| AI draft social posts (LinkedIn, IG, FB, TikTok) | ✅ Ops Console |
| SEO page briefs (title, meta, keywords, body) | ✅ Ops Console |
| Google Ads copy drafts | ✅ Ops Console |
| Auto-publish via APIs | ✅ when env keys set |
| Manual fallback (copy to clipboard) | ✅ always |
| Scheduled posts (cron) | Phase 2 |
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
6. **Publish** — posts via API if configured, otherwise copies text for manual paste

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

### Google SEO

- AI generates meta title, description, keywords, and page outline
- Apply manually to Next.js pages or blog posts
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

# Auto-publish (all optional)
MARKETING_LINKEDIN_ACCESS_TOKEN=
MARKETING_LINKEDIN_ORG_ID=
MARKETING_META_ACCESS_TOKEN=
MARKETING_META_PAGE_ID=
MARKETING_TIKTOK_ACCESS_TOKEN=
MARKETING_GOOGLE_ADS_DEVELOPER_TOKEN=
```

## Database

Run after pull:

```powershell
npx pnpm@9.15.0 db:push
```

Model: `MarketingPost` — stores drafts, scheduled, and published content per brand/channel.

## Package structure

```
packages/marketing-agent/
  src/brands.ts      # MotiveLife, MotiveFX, MotiveIQ voice & URLs
  src/channels.ts    # Platform limits & env keys
  src/generate.ts    # OpenAI content generation
  src/index.ts       # publishMarketingPost(), publisher status
```

## Roadmap

1. **Now** — Generate + approve + manual/API publish
2. **Next** — Vercel cron for `scheduled` posts
3. **Next** — Search Console API → SEO topic suggestions
4. **Later** — Image generation for post creatives
5. **Later** — MotiveFX / MotiveIQ admin panels import same package

## Security

- Admin-only (`ADMIN_EMAILS`)
- Never commit API tokens
- **Save all marketing API passwords in your password manager**
