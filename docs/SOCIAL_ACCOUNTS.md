# MotiveLife social accounts — setup & link to the app

Create profiles on each platform, then add URLs to **Vercel** so the site footer and Admin analytics pick them up.

**Website (link in every bio):** https://www.mymotivelife.com  
**Play Store (add when live):** your Play listing URL

Use tracking links in bios so Admin → Traffic shows which platform sends signups:

| Platform | Bio link |
|----------|----------|
| Instagram | `https://www.mymotivelife.com/?utm_source=instagram&utm_medium=social&utm_campaign=mymotivelife` |
| Facebook | `https://www.mymotivelife.com/?utm_source=facebook&utm_medium=social&utm_campaign=mymotivelife` |
| TikTok | `https://www.mymotivelife.com/?utm_source=tiktok&utm_medium=social&utm_campaign=mymotivelife` |
| LinkedIn | `https://www.mymotivelife.com/?utm_source=linkedin&utm_medium=social&utm_campaign=mymotivelife` |

---

## 1. LinkedIn (company page)

1. Go to [linkedin.com/company/setup/new](https://www.linkedin.com/company/setup/new)
2. **Page name:** MotiveLife
3. **LinkedIn public URL:** `linkedin.com/company/motivelife` (or `mymotivelife` if taken)
4. **Website:** https://www.mymotivelife.com
5. **Industry:** Software Development or Technology, Information and Internet
6. **Company size:** 1–10
7. Upload logo: `apps/mobile/assets/icon.png`
8. **About:** Short pitch from `docs/PLAY_STORE_LAUNCH.md` (full description)
9. Add **Call to action** button → Visit website → mymotivelife.com

**Save URL for Vercel:** `https://www.linkedin.com/company/motivelife` (your actual URL)

---

## 2. Instagram

1. Install Instagram app or use [instagram.com](https://www.instagram.com)
2. Create account or use existing → **Switch to professional account** → **Business**
3. **Username:** `@mymotivelife` (or closest available)
4. **Name:** MotiveLife
5. **Bio (150 chars):**
   ```
   Just talk. AI turns your thoughts into plans, goals & daily actions.
   🇨🇦 Free 14-day trial ↓
   ```
6. **Link in bio:** tracking URL above (or Linktree with web + Play links)
7. **Profile photo:** `apps/mobile/assets/icon.png`
8. **Contact:** hello@mymotivelife.com (if you use it)

**Save URL:** `https://www.instagram.com/mymotivelife`

---

## 3. Facebook (Page)

1. [facebook.com/pages/create](https://www.facebook.com/pages/create)
2. **Business or Brand** → **Get Started**
3. **Page name:** MotiveLife
4. **Category:** Software or Product/service
5. **Website:** https://www.mymotivelife.com
6. Upload profile + cover (logo + simple banner in Canva)
7. **About** → paste store description; add same website link
8. **Action button:** Sign Up or Learn More → mymotivelife.com

**Save URL:** `https://www.facebook.com/mymotivelife` (Facebook assigns the slug)

---

## 4. TikTok

1. Install TikTok → **Profile** → sign up (phone or email)
2. **Switch to Business account** (Settings → Account → Switch to Business)
3. **Username:** `@mymotivelife`
4. **Name:** MotiveLife
5. **Bio:** Same as Instagram; add link when TikTok allows (1k followers) or put link in pinned comment / video captions until then
6. **Profile photo:** app icon

**Save URL:** `https://www.tiktok.com/@mymotivelife`

---

## 5. Link accounts to the app (Vercel)

After each profile is live, add env vars in **Vercel → motivelife-web → Settings → Environment Variables → Production**:

```
SOCIAL_LINKEDIN_URL=https://www.linkedin.com/company/YOUR-SLUG
SOCIAL_INSTAGRAM_URL=https://www.instagram.com/YOUR-HANDLE
SOCIAL_FACEBOOK_URL=https://www.facebook.com/YOUR-PAGE-SLUG
SOCIAL_TIKTOK_URL=https://www.tiktok.com/@YOUR-HANDLE
```

Redeploy (or push any commit). Then:

- **Site footer** shows Follow links
- **Admin → Dashboard** → Social media tracking shows profile + tracked signup links

---

## 6. Google Play store listing (optional)

Play Console → **Grow users** → **Store presence** → **Main store listing**

If offered, add website https://www.mymotivelife.com. Play does not always show Instagram/TikTok fields; social lives mainly in your bios and site footer.

---

## 7. First posts (copy/paste)

**Launch post (all platforms):**

> MotiveLife is live — your AI life operating system.
>
> Just talk. Get plans, goals, habits, and your next action — not another endless chat.
>
> 14-day free trial: https://www.mymotivelife.com
>
> Built in Canada. Privacy-first.

**TikTok / Reels idea:** 15s screen recording — voice organize → task appears on dashboard.

---

## Checklist

- [ ] LinkedIn company page created
- [ ] Instagram business profile
- [ ] Facebook Page (not personal profile)
- [ ] TikTok business account
- [ ] Same logo on all four
- [ ] Website link in bio / about on each
- [ ] Four `SOCIAL_*_URL` vars in Vercel
- [ ] Redeploy and check footer on www.mymotivelife.com
- [ ] Play Store URL added to bios when app is approved
