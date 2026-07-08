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
      ctaUrl: p.ctaUrl || buildTrackingUrl(request.brandId, p.channel),
      hashtags: p.hashtags ?? [],
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
    ? `- USER ATTACHED A REAL APP SCREENSHOT (reference only — do not post it raw). Study the image: name the feature/screen shown (e.g. Memories, Life Score, briefing). Write posts that highlight what is visible. The creative pipeline will AI-reimagine the screenshot into polished marketing art.
- imagePrompt: describe how to reimagine the screenshot for social — same feature, premium MotiveLife look, channel crop.`
    : `- imagePrompt: describe a social creative matching the real ${brand.name} app — dark premium UI (#050d18 navy), gradient accents (purple→blue→cyan→green), voice/AI life OS theme, channel-appropriate aspect ratio.`;

  const motivefxVisual = hasScreenshot
    ? `- USER ATTACHED A REAL APP SCREENSHOT. Highlight visible trading UI: signals, portfolio, market feed, advisor panel.
- imagePrompt: reimagine screenshot as premium trading terminal creative — dark slate UI, cyan/blue accents, signal cards.`
    : `- imagePrompt: dark trading terminal UI — signal cards, portfolio metrics, market heatmap, AI advisor panel, cyan/blue accents on slate (#0b1220).`;

  if (brandId === "motivefx") {
    return `Rules:
- ${brand.name} is a market intelligence terminal for stocks, crypto, sports betting, and Polymarket-style prediction markets.
- NEVER mention dealerships, automotive, inventory, car sales, dealer teams, or B2B dealer ops — wrong product entirely.
- NEVER use MotiveLife life-coaching language (habits, voice journal, life score, daily routine) unless the brief explicitly asks.
- Focus on: AI-ranked signals, portfolio context, market flow, faster decisions, trading edge.
${ctaLine}
- hashtags array: trading/market tags only (MotiveFX, Trading, Crypto, Stocks, MarketIntel). NEVER productivity/habits/life-hack tags.
- Instagram/TikTok: 8-12 tags in hashtags array. LinkedIn: 3-5. Facebook: 1-3.
- Use tracking URLs like ${buildTrackingUrl(brandId, "CHANNEL")} with correct utm_source per channel.
- LinkedIn: professional fintech tone. Instagram/TikTok: energetic trader energy, still credible.
${motivefxVisual}`;
  }

  if (brandId === "motiveiq") {
    return `Rules:
- ${brand.name} helps car buyers and owners — fair deals, maintenance clarity, less dealer anxiety.
- NEVER mention stock trading, crypto, or sports betting.
${ctaLine}
- hashtags: automotive consumer tags (CarBuying, AutoAdvice, MotiveIQ).
${hasScreenshot ? `- imagePrompt: consumer automotive app UI, trust-focused.` : `- imagePrompt: vehicle cards, fair-price indicators, maintenance timeline.`}`;
  }

  return `Rules:
- Optimize for signups: clear CTA, pain → solution.
${ctaLine}
- Each social post must fit channel limits (LinkedIn 3000, Instagram/TikTok 2200, Facebook 5000).
- hashtags array: real campaign tags only (e.g. MotiveLife, Productivity, GoalSetting). NEVER placeholder words like "hashtags", "keywords", "tags", or JSON field names.
- Instagram/TikTok: put hashtags in the hashtags array (not duplicated heavily in body). Use 8-12 IG tags, 3-5 LinkedIn, 1-3 Facebook.
- Facebook: use 1-3 broad, readable tags (brand + productivity/life theme). Avoid spammy tag blocks.
- Use tracking URLs like ${buildTrackingUrl(brandId, "CHANNEL")} with correct utm_source per channel.
- SEO metaTitle ≤60 chars, metaDescription ≤155 chars, keywords tuned for Google search intent.
- Ad copy: 3 headlines ≤30 chars, 2 descriptions ≤90 chars each if includeAds.
- LinkedIn: professional tone. Instagram/TikTok: slightly more energetic, still on-brand.
${motivelifeVisual}`;
}

function brandSystemPrompt(brandId: MarketingBrandId, brand: ReturnType<typeof getBrandProfile>): string {
  const forbidden =
    brandId === "motivefx"
      ? " FORBIDDEN TOPICS: dealerships, automotive retail, inventory management, car dealer leads, B2B dealer ops."
      : brandId === "motiveiq"
        ? " FORBIDDEN TOPICS: stock trading, crypto, sports betting, Polymarket."
        : "";

  const goal =
    brandId === "motivefx"
      ? "Goal: maximize trader signups to the MotiveFX terminal."
      : brandId === "motiveiq"
        ? "Goal: maximize consumer signups for automotive intelligence."
        : "Goal: maximize free-trial signups.";

  return `You are the Marketing Agent for ${brand.name}. Voice: ${brand.voice}. Audience: ${brand.audience}. Website: ${brand.siteUrl}. Product: ${brand.tagline}.${forbidden} ${goal} Output JSON only.`;
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
        hashtags,
        ctaUrl: cta,
        imagePrompt:
          request.brandId === "motivefx"
            ? `${brand.name} trading terminal UI, signal cards, portfolio metrics, dark slate, cyan accents`
            : `${brand.name} product screenshot, dark premium UI, minimal`,
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
  "socialPosts": [{ "channel": string, "body": string, "hashtags": string[], "ctaUrl": string, "imagePrompt": string }],
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

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: hasScreenshot ? "gpt-4o-mini" : "gpt-4o-mini",
      temperature: 0.6,
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
