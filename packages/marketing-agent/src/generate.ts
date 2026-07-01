import { buildTrackingUrl, getBrandProfile } from "./brands";
import { getChannel } from "./channels";
import type {
  GenerateMarketingRequest,
  GenerateMarketingResult,
  GeneratedSeoContent,
  GeneratedSocialPost,
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

function fallbackSocialPosts(
  request: GenerateMarketingRequest
): GeneratedSocialPost[] {
  const brand = getBrandProfile(request.brandId);
  const cta = buildTrackingUrl(request.brandId, "social");

  return request.channels
    .filter((c) => SOCIAL_CHANNELS.includes(c))
    .map((channel) => {
      const max = getChannel(channel).maxLength;
      const body = truncate(
        `${request.brief}\n\n${brand.tagline}\n\n${brand.trialOffer ?? "Learn more"} → ${cta}`,
        max
      );
      return {
        channel,
        body,
        hashtags: brand.hashtags.slice(0, 5),
        ctaUrl: cta,
        imagePrompt: `${brand.name} product screenshot, dark premium UI, minimal`,
      };
    });
}

function fallbackSeo(request: GenerateMarketingRequest): GeneratedSeoContent {
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
    socialSnippets: fallbackSocialPosts({
      ...request,
      channels: ["linkedin", "instagram"],
    }),
  };
}

export async function generateMarketingContent(
  request: GenerateMarketingRequest,
  apiKey?: string | null
): Promise<GenerateMarketingResult> {
  if (!apiKey?.trim()) {
    return {
      socialPosts: fallbackSocialPosts(request),
      seo: request.includeSeo ? fallbackSeo(request) : undefined,
      adCopy: request.includeAds
        ? [
            `${getBrandProfile(request.brandId).name} — ${request.brief.slice(0, 60)}`,
            getBrandProfile(request.brandId).tagline,
          ]
        : undefined,
    };
  }

  const brand = getBrandProfile(request.brandId);
  const socialChannelList = request.channels.filter((c) => SOCIAL_CHANNELS.includes(c));

  const schema = `{
  "socialPosts": [{ "channel": string, "body": string, "hashtags": string[], "ctaUrl": string, "imagePrompt": string }],
  "seo": { "title": string, "metaTitle": string, "metaDescription": string, "keywords": string[], "outline": string[], "body": string, "socialSnippets": [{ "channel": string, "body": string, "hashtags": string[], "ctaUrl": string }] } | null,
  "adCopy": string[] | null
}`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.6,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are the Marketing Agent for ${brand.name}. Voice: ${brand.voice}. Audience: ${brand.audience}. Website: ${brand.siteUrl}. Output JSON only.`,
        },
        {
          role: "user",
          content: `Brief: ${request.brief}

Channels: ${socialChannelList.join(", ") || "none"}
Include SEO: ${Boolean(request.includeSeo)}
Include Google Ads copy: ${Boolean(request.includeAds)}

Rules:
- Each social post must fit channel character limits (LinkedIn 3000, Instagram/TikTok 2200).
- Use tracking URLs like ${buildTrackingUrl(request.brandId, "CHANNEL")} with correct utm_source per channel.
- SEO metaTitle ≤60 chars, metaDescription ≤155 chars.
- Ad copy: 3 headlines ≤30 chars, 2 descriptions ≤90 chars each if includeAds.
- No emoji unless TikTok/Instagram and subtle.

Schema:
${schema}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    return {
      socialPosts: fallbackSocialPosts(request),
      seo: request.includeSeo ? fallbackSeo(request) : undefined,
    };
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    return {
      socialPosts: fallbackSocialPosts(request),
      seo: request.includeSeo ? fallbackSeo(request) : undefined,
    };
  }

  const parsed = JSON.parse(content) as GenerateMarketingResult;
  return {
    socialPosts: (parsed.socialPosts ?? []).map((p) => ({
      ...p,
      body: truncate(p.body, getChannel(p.channel).maxLength),
      ctaUrl: p.ctaUrl || buildTrackingUrl(request.brandId, p.channel),
    })),
    seo: parsed.seo ?? (request.includeSeo ? fallbackSeo(request) : undefined),
    adCopy: parsed.adCopy,
  };
}
