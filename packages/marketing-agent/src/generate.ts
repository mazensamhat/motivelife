import { buildTrackingUrl, getBrandProfile } from "./brands";
import { getChannel } from "./channels";
import {
  formatHashtagsForPrompt,
  mergePostHashtags,
  researchHashtags,
} from "./hashtags";
import type {
  GenerateMarketingRequest,
  GenerateMarketingResult,
  GeneratedSeoContent,
  GeneratedSocialPost,
  MarketingBrandId,
  MarketingChannelId,
} from "./types";

const SOCIAL_CHANNELS: MarketingChannelId[] = [
  "linkedin",
  "instagram",
  "facebook",
  "tiktok",
  "reddit",
  "x",
  "threads",
  "youtube",
];

function truncate(text: string, max: number) {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trim()}…`;
}

function applyHashtagResearch(
  posts: GeneratedSocialPost[],
  research: Awaited<ReturnType<typeof researchHashtags>>,
  brandId: MarketingBrandId,
  brief: string
): GeneratedSocialPost[] {
  return posts.map((p) => ({
    ...p,
    hashtags: mergePostHashtags(p.channel, p.hashtags, research, brandId, brief),
  }));
}

function isSocialChannel(channel: string): channel is MarketingChannelId {
  return SOCIAL_CHANNELS.includes(channel as MarketingChannelId);
}

function safeParseMarketingResult(content: string): GenerateMarketingResult | null {
  try {
    return JSON.parse(content) as GenerateMarketingResult;
  } catch {
    return null;
  }
}

function normalizeSocialPosts(
  raw: GeneratedSocialPost[] | undefined,
  request: GenerateMarketingRequest,
  hashtagResearch: Awaited<ReturnType<typeof researchHashtags>>
): GeneratedSocialPost[] {
  const requested = new Set(
    request.channels.filter((c) => SOCIAL_CHANNELS.includes(c))
  );

  const posts = (raw ?? [])
    .filter((p) => isSocialChannel(p.channel) && requested.has(p.channel))
    .map((p) => ({
      ...p,
      body: truncate(p.body ?? "", getChannel(p.channel).maxLength),
      title: p.title ? truncate(p.title, 300) : undefined,
      ctaUrl: p.ctaUrl || buildTrackingUrl(request.brandId, p.channel),
      hashtags: p.channel === "reddit" ? [] : (p.hashtags ?? []),
      imagePrompt: p.imagePrompt ?? undefined,
    }));

  if (posts.length > 0) {
    return applyHashtagResearch(posts, hashtagResearch, request.brandId, request.brief);
  }

  return fallbackSocialPosts(request, hashtagResearch);
}

function brandCopyRules(
  brandId: MarketingBrandId,
  brand: ReturnType<typeof getBrandProfile>,
  hasScreenshot: boolean
): string {
  const ctaLine = brand.trialOffer
    ? `- CTA: ${brand.trialOffer}`
    : `- CTA: Learn more at ${brand.siteUrl}`;

  const motivelifeVisual = hasScreenshot
    ? `- USER ATTACHED A REAL APP SCREENSHOT (reference only — do not post it raw). Name the feature/screen (Today / DayO, Voice Organize / VYRA, Life Graph / LifeVue, Kashu Safe to Spend, KINZO map, etc.). Write posts that highlight what is visible.
- imagePrompt: 1–2 sentence SHOT SCRIPT for creatives. Format: [feature] + [composition] + [lighting/mood] + [aspect cue]. Example: "Kashu Safe to Spend hero on dark navy phone UI, emerald→teal gradient, 9:16 Reels product hero, soft depth, no collage."`
    : `- imagePrompt: 1–2 sentence SHOT SCRIPT matching real MotiveLife UI — dark navy #050d18, cyan→lime accents (or emerald for Kashu), one product moment (Today briefing / DayO, Voice Organize / VYRA, Life Graph / LifeVue, Kashu Safe to Spend, KINZO map), channel crop (9:16 Reels or 16:9 feed). Never "generic AI lifestyle". Name suite products when relevant.`;

  const motivefxVisual = hasScreenshot
    ? `- USER ATTACHED A REAL APP SCREENSHOT. Highlight visible trading UI: signals, portfolio, market feed, advisor panel.
- imagePrompt: SHOT SCRIPT — trading terminal creative; slate UI; cyan/blue accents; signal cards as hero; channel crop.`
    : `- imagePrompt: SHOT SCRIPT — dark trading terminal, ranked signals + portfolio metrics, cyan/blue on slate #0b1220, single focal panel.`;

  const motivepulseVisual = hasScreenshot
    ? `- USER ATTACHED A REAL APP SCREENSHOT. Highlight Motive Score, reply inbox, Fix It missions, competitor gap.
- imagePrompt: SHOT SCRIPT — gold-accent growth dashboard on navy; Motive Score ring hero; review cards readable but minimal text.`
    : `- imagePrompt: SHOT SCRIPT — Motive Score ring + Google review cards, gold #D4A853 on navy #060b14, premium operator dashboard.`;

  if (brandId === "motivefx") {
    return `Rules:
- ${brand.name} is a market intelligence terminal for stocks, crypto, sports betting, and Polymarket-style prediction markets.
- NEVER mention dealerships, automotive, inventory, car sales, dealer teams, or B2B dealer ops — wrong product entirely.
- NEVER use MotiveLife life-coaching language (habits, voice journal, life score, daily routine) unless the brief explicitly asks.
- Focus on: AI-ranked signals, portfolio context, market flow, faster decisions, trading edge.
${ctaLine}
- hashtags array: trading/market tags only (MotiveFX, Trading, Crypto, Stocks, MarketIntel). NEVER productivity/habits/life-hack tags.
- Instagram/TikTok: 8-12 tags in hashtags array. LinkedIn: 3-5. Facebook: 1-3.
- Reddit: include "title" (≤300 chars, curiosity/value, not spammy). Body is a helpful self-post; put CTA link at the end. hashtags: empty array (Reddit does not use hashtags).
- Use tracking URLs like ${buildTrackingUrl(brandId, "CHANNEL")} with correct utm_source per channel.
- LinkedIn: professional fintech tone. Instagram/TikTok: energetic trader energy, still credible.
${motivefxVisual}`;
  }

  if (brandId === "motivepulse") {
    return `Rules:
- ${brand.name} is a business growth platform: Google reviews, AI reply drafts, reputation score, competitor insights, and automation for local businesses.
- NEVER mention stock trading, crypto, sports betting, Polymarket, car buying, or MotiveLife life-coaching (habits, voice journal, daily routine).
- Focus on: Motive Score, review response speed, Google Business Profile, reputation, competitor gaps, SMS/email review requests, Insights → Automation → Growth.
${ctaLine}
- hashtags array: local business / reputation tags only (MotivePulseIQ, GoogleReviews, ReputationManagement, LocalBusiness). NEVER trading or life-hack tags.
- Instagram/TikTok: 8-12 tags. LinkedIn: 3-5. Facebook: 1-3.
- Reddit: include "title" (≤300 chars). Body: practical operator advice; CTA at end. hashtags: [].
- Use tracking URLs like ${buildTrackingUrl(brandId, "CHANNEL")} with correct utm_source per channel.
- LinkedIn: B2B operator tone for owners/GMs. Instagram/TikTok: practical growth tips for local businesses.
${motivepulseVisual}`;
  }

  if (brandId === "motiveiq") {
    return `Rules:
- ${brand.name} is a SECRET PROJECT. Do not invent or reveal product features, category, market, or customers.
- Public copy may only say: MotiveIQ is a secret Motive-Corp project; details coming soon.
- NEVER mention dealerships, automotive, inventory, F&I, pipelines, trading, crypto, or life-coaching.
${ctaLine}
- hashtags: MotiveIQ, MotiveCorp, ComingSoon only.
- Reddit: include "title" (≤300 chars). Teaser only; CTA at end. hashtags: [].
${hasScreenshot ? `- imagePrompt: SHOT SCRIPT — dark MotiveIQ teaser card; text "Secret project"; no product UI.` : `- imagePrompt: SHOT SCRIPT — dark brand teaser; MotiveIQ wordmark; "Secret project"; no dashboards.`}`;
  }

  return `Rules:
- Optimize for signups: hook → pain → concrete benefit → CTA (${brand.trialOffer ?? brand.siteUrl}).
- First line must earn the scroll (specific outcome or contrast, not "Excited to announce").
- Body: 2–4 short paragraphs or tight beats. Spoken, specific. No emoji spam. No vague AI hype.
${ctaLine}
- Each social post must fit channel limits (LinkedIn 3000, Instagram/TikTok 2200, Facebook 5000, Reddit 40000, X 280).
- hashtags array: real campaign tags only (e.g. MotiveLife, Productivity, GoalSetting). NEVER placeholder words like "hashtags", "keywords", "tags", or JSON field names.
- Instagram/TikTok: put hashtags in the hashtags array (not duplicated heavily in body). Use 8-12 IG tags, 3-5 LinkedIn, 1-3 Facebook, 2-3 for X.
- Facebook: use 1-3 broad, readable tags (brand + productivity/life theme). Avoid spammy tag blocks.
- Reddit: ALWAYS include "title" (≤300 chars, specific and useful — not "Check out my app"). Body reads like a helpful community post; soft CTA + tracking URL at the end. hashtags must be [].
- Use tracking URLs like ${buildTrackingUrl(brandId, "CHANNEL")} with correct utm_source per channel.
- SEO metaTitle ≤60 chars, metaDescription ≤155 chars, keywords tuned for Google search intent.
- Ad copy (if includeAds): return exactly 5 strings — [headline≤30, headline≤30, headline≤30, description≤90, description≤90]. RSA-ready, benefit-led, no fluff.
- LinkedIn: professional operator tone. Instagram/TikTok: energetic but credible. X: punchy ≤240 chars + CTA.
${motivelifeVisual}`;
}

function brandSystemPrompt(brandId: MarketingBrandId, brand: ReturnType<typeof getBrandProfile>): string {
  const forbidden =
    brandId === "motivefx"
      ? " FORBIDDEN TOPICS: dealerships, automotive retail, inventory management, car dealer leads, B2B dealer ops, life-coaching habits."
      : brandId === "motivepulse"
        ? " FORBIDDEN TOPICS: stock trading, crypto, sports betting, Polymarket, car buying, life-coaching habits/voice journal."
        : brandId === "motiveiq"
          ? " FORBIDDEN TOPICS: any product features, category, customers, dealerships, automotive, trading, crypto, life-coaching. Teaser only — secret project."
          : " FORBIDDEN TOPICS: trading, crypto, dealership B2B ops, Motivelife competitors copy-paste.";

  const goal =
    brandId === "motivefx"
      ? "Goal: maximize trader signups to the MotiveFX terminal."
      : brandId === "motivepulse"
        ? "Goal: maximize free Motive Score scans and business signups for MotivePulse IQ."
        : brandId === "motiveiq"
          ? "Goal: teaser awareness only — never describe the product; drive curiosity to Motive-Corp platforms."
          : "Goal: maximize free-trial Pro signups for MotiveLife.";

  return `You are the senior Marketing Agent for ${brand.name} inside the MotiveLife Ops Console. Voice: ${brand.voice}. Audience: ${brand.audience}. Website: ${brand.siteUrl}. Product: ${brand.tagline}.${forbidden} ${goal}

Quality bar: every post should feel like a skilled growth marketer wrote it — specific, channel-native, conversion-minded. Prefer concrete product moments over generic "AI changes everything" lines. Prefer researched hashtags from the user list over inventing new ones. Output JSON only.`;
}

function fallbackSocialPosts(
  request: GenerateMarketingRequest,
  research: Awaited<ReturnType<typeof researchHashtags>>
): GeneratedSocialPost[] {
  const brand = getBrandProfile(request.brandId);
  const cta = buildTrackingUrl(request.brandId, "social");

  return request.channels
    .filter((c) => SOCIAL_CHANNELS.includes(c))
    .map((channel) => {
      const max = getChannel(channel).maxLength;
      const hashtags = mergePostHashtags(channel, brand.hashtags, research, request.brandId, request.brief);
      const tagLine = hashtags.map((h) => `#${h}`).join(" ");
      const body = truncate(
        `${request.brief}\n\n${brand.tagline}\n\n${brand.trialOffer ?? "Learn more"} → ${cta}\n\n${tagLine}`,
        max
      );
      return {
        channel,
        body,
        title:
          channel === "reddit"
            ? truncate(`${brand.name}: ${request.brief}`.replace(/\s+/g, " "), 300)
            : undefined,
        hashtags: channel === "reddit" ? [] : hashtags,
        ctaUrl: cta,
        imagePrompt:
          request.brandId === "motivefx"
            ? `SHOT SCRIPT: ${brand.name} trading terminal, ranked signal cards hero, dark slate, cyan accents, 16:9 feed`
            : request.brandId === "motivepulse"
              ? `SHOT SCRIPT: ${brand.name} Motive Score ring + review cards, gold accents on dark navy, premium dashboard`
              : request.brandId === "motiveiq"
                ? `SHOT SCRIPT: ${brand.name} secret-project teaser card, dark navy, no product UI, text Secret project`
                : `SHOT SCRIPT: MotiveLife ${/voice|talk|organiz/i.test(request.brief) ? "Voice Organize mic waveform" : /graph|score/i.test(request.brief) ? "Life Graph domains" : "Today briefing"} on dark navy phone UI, cyan→lime rim light, ${channel === "instagram" || channel === "tiktok" ? "9:16 Reels" : "feed"} product hero`,
      };
    });
}

function fallbackSeo(
  request: GenerateMarketingRequest,
  research: Awaited<ReturnType<typeof researchHashtags>>
): GeneratedSeoContent {
  const brand = getBrandProfile(request.brandId);
  const topic = request.brief.trim() || brand.tagline;
  const title = `${topic} | ${brand.name}`;
  const metaDescription = truncate(
    `${brand.tagline} ${brand.audience.split("—")[0]?.trim() ?? ""}. Built for real life.`,
    155
  );

  return {
    title,
    metaTitle: truncate(title, 60),
    metaDescription,
    keywords: [brand.name, ...brand.hashtags.map((h) => h.toLowerCase())],
    outline: [
      "Problem: fragmented tools and generic AI",
      `Solution: ${brand.name}`,
      "Key benefits",
      "How it works",
      "Get started",
    ],
    body: `# ${title}\n\n${brand.tagline}\n\n${request.brief}\n\nVisit ${brand.siteUrl}`,
    socialSnippets: fallbackSocialPosts(
      { ...request, channels: ["linkedin", "instagram"] },
      research
    ),
  };
}

export async function generateMarketingContent(
  request: GenerateMarketingRequest,
  apiKey?: string | null
): Promise<GenerateMarketingResult> {
  const socialChannelList = request.channels.filter((c) => SOCIAL_CHANNELS.includes(c));
  const hashtagResearch = await researchHashtags(
    request.brandId,
    request.brief,
    socialChannelList
  );

  if (!apiKey?.trim()) {
    return {
      socialPosts: fallbackSocialPosts(request, hashtagResearch),
      seo: request.includeSeo ? fallbackSeo(request, hashtagResearch) : undefined,
      adCopy: request.includeAds
        ? [
            `${getBrandProfile(request.brandId).name} — ${request.brief.slice(0, 60)}`,
            getBrandProfile(request.brandId).tagline,
          ]
        : undefined,
    };
  }

  const brand = getBrandProfile(request.brandId);
  const hashtagContext = formatHashtagsForPrompt(hashtagResearch);
  const hasScreenshot = Boolean(request.referenceImage?.base64?.trim());

  const schema = `{
  "socialPosts": [{ "channel": string, "body": string, "title": string | null, "hashtags": string[], "ctaUrl": string, "imagePrompt": string }],
  "seo": { "title": string, "metaTitle": string, "metaDescription": string, "keywords": string[], "outline": string[], "body": string, "socialSnippets": [{ "channel": string, "body": string, "hashtags": string[], "ctaUrl": string }] } | null,
  "adCopy": string[] | null
}`;

  const copyRules = `${brandCopyRules(request.brandId, brand, hasScreenshot)}

Schema:
${schema}`;

  const userText = `Brief: ${request.brief}

Channels: ${socialChannelList.join(", ") || "none"}
Include SEO: ${Boolean(request.includeSeo)}
Include Google Ads copy: ${Boolean(request.includeAds)}

Researched hashtags (use these exact tags in the hashtags array — copy from this list, do not invent meta labels):
${hashtagContext}

${copyRules}`;

  const userMessage = hasScreenshot
    ? {
        role: "user" as const,
        content: [
          { type: "text" as const, text: userText },
          {
            type: "image_url" as const,
            image_url: {
              url: `data:${request.referenceImage!.mimeType};base64,${request.referenceImage!.base64}`,
              detail: "high" as const,
            },
          },
        ],
      }
    : { role: "user" as const, content: userText };

  const copyModel =
    process.env.MARKETING_COPY_MODEL?.trim() ||
    (hasScreenshot ? "gpt-4o" : "gpt-4o");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: copyModel,
      temperature: 0.72,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: brandSystemPrompt(request.brandId, brand),
        },
        userMessage,
      ],
    }),
  }).catch(() => null);

  if (!response?.ok) {
    return {
      socialPosts: fallbackSocialPosts(request, hashtagResearch),
      seo: request.includeSeo ? fallbackSeo(request, hashtagResearch) : undefined,
      adCopy: request.includeAds
        ? [
            `${getBrandProfile(request.brandId).name} — ${request.brief.slice(0, 60)}`,
            getBrandProfile(request.brandId).tagline,
          ]
        : undefined,
    };
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    return {
      socialPosts: fallbackSocialPosts(request, hashtagResearch),
      seo: request.includeSeo ? fallbackSeo(request, hashtagResearch) : undefined,
      adCopy: request.includeAds
        ? [
            `${getBrandProfile(request.brandId).name} — ${request.brief.slice(0, 60)}`,
            getBrandProfile(request.brandId).tagline,
          ]
        : undefined,
    };
  }

  const parsed = safeParseMarketingResult(content);
  if (!parsed) {
    return {
      socialPosts: fallbackSocialPosts(request, hashtagResearch),
      seo: request.includeSeo ? fallbackSeo(request, hashtagResearch) : undefined,
      adCopy: request.includeAds
        ? [
            `${getBrandProfile(request.brandId).name} — ${request.brief.slice(0, 60)}`,
            getBrandProfile(request.brandId).tagline,
          ]
        : undefined,
    };
  }

  const socialPosts = normalizeSocialPosts(
    parsed.socialPosts,
    request,
    hashtagResearch
  );

  return {
    socialPosts,
    seo: parsed.seo ?? (request.includeSeo ? fallbackSeo(request, hashtagResearch) : undefined),
    adCopy: parsed.adCopy,
  };
}
