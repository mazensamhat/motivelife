import { buildTrackingUrl, getBrandProfile } from "./brands";
import { getChannel, isChannelConfigured } from "./channels";
import type { MarketingBrandId, PublishPayload, PublishResult } from "./types";

function defaultPostImageUrl(brandId: MarketingBrandId): string {
  return (
    process.env.MARKETING_POST_IMAGE_URL?.trim() ||
    `${getBrandProfile(brandId).siteUrl.replace(/\/$/, "")}/icon.png`
  );
}

function formatManualPost(payload: PublishPayload): string {
  const tags = payload.hashtags?.length
    ? `\n\n${payload.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")}`
    : "";
  const link = payload.ctaUrl ? `\n\n${payload.ctaUrl}` : "";
  return `${payload.body.trim()}${tags}${link}`.trim();
}

async function publishLinkedIn(payload: PublishPayload, token: string): Promise<PublishResult> {
  const orgId = process.env.MARKETING_LINKEDIN_ORG_ID!.trim();
  const text = formatManualPost(payload);

  const res = await fetch("https://api.linkedin.com/v2/ugcPosts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify({
      author: `urn:li:organization:${orgId}`,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text },
          shareMediaCategory: "NONE",
        },
      },
      visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return { ok: false, error: err.slice(0, 500), mode: "manual", manualText: text };
  }

  const data = (await res.json()) as { id?: string };
  return { ok: true, externalId: data.id ?? "linkedin-post", mode: "api" };
}

async function publishFacebook(payload: PublishPayload, token: string): Promise<PublishResult> {
  const pageId = process.env.MARKETING_META_PAGE_ID!.trim();
  const message = formatManualPost(payload);

  const res = await fetch(`https://graph.facebook.com/v21.0/${pageId}/feed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      access_token: token,
      message,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return { ok: false, error: err.slice(0, 500), mode: "manual", manualText: message };
  }

  const data = (await res.json()) as { id?: string };
  return { ok: true, externalId: data.id ?? "facebook-post", mode: "api" };
}

function postMediaUrl(payload: PublishPayload): string {
  if (payload.mediaUrl?.trim()) return payload.mediaUrl.trim();
  return defaultPostImageUrl(payload.brandId);
}

async function publishInstagram(payload: PublishPayload, token: string): Promise<PublishResult> {
  const igUserId = process.env.MARKETING_INSTAGRAM_ACCOUNT_ID!.trim();
  const caption = formatManualPost(payload);
  const isVideo = payload.mediaType === "video";
  const isGif = payload.mediaType === "gif";
  const mediaUrl = postMediaUrl(payload);

  if (isGif) {
    return {
      ok: false,
      error:
        "Instagram API needs MP4 for Reels or PNG/JPG for feed — GIF animations: download from preview and upload manually to Reels/TikTok.",
      mode: "manual",
      manualText: `${caption}\n\nMedia: ${mediaUrl}`,
    };
  }

  const createBody: Record<string, string> = {
    access_token: token,
    caption,
  };

  if (isVideo) {
    createBody.media_type = "REELS";
    createBody.video_url = mediaUrl;
  } else {
    createBody.image_url = mediaUrl;
  }

  const createRes = await fetch(`https://graph.facebook.com/v21.0/${igUserId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(createBody),
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    return { ok: false, error: err.slice(0, 500), mode: "manual", manualText: caption };
  }

  const created = (await createRes.json()) as { id?: string };
  if (!created.id) {
    return {
      ok: false,
      error: "Instagram media container missing id",
      mode: "manual",
      manualText: caption,
    };
  }

  const publishRes = await fetch(
    `https://graph.facebook.com/v21.0/${igUserId}/media_publish`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        access_token: token,
        creation_id: created.id,
      }),
    }
  );

  if (!publishRes.ok) {
    const err = await publishRes.text();
    return { ok: false, error: err.slice(0, 500), mode: "manual", manualText: caption };
  }

  const published = (await publishRes.json()) as { id?: string };
  return { ok: true, externalId: published.id ?? created.id, mode: "api" };
}

export async function publishMarketingPost(payload: PublishPayload): Promise<PublishResult> {
  const manualText = formatManualPost({
    ...payload,
    ctaUrl: payload.ctaUrl ?? buildTrackingUrl(payload.brandId, payload.channel),
  });

  if (payload.channel === "google_search") {
    return {
      ok: false,
      error: "SEO content is applied to the site manually or via CMS — not auto-posted.",
      mode: "manual",
      manualText: `${payload.metaTitle ?? ""}\n${payload.metaDescription ?? ""}\n\n${payload.body}`,
    };
  }

  const ch = getChannel(payload.channel);

  if (!ch.supportsAutoPublish || !isChannelConfigured(payload.channel)) {
    const missing =
      payload.channel === "linkedin"
        ? "MARKETING_LINKEDIN_ACCESS_TOKEN + MARKETING_LINKEDIN_ORG_ID"
        : payload.channel === "facebook"
          ? "MARKETING_META_ACCESS_TOKEN + MARKETING_META_PAGE_ID"
          : payload.channel === "instagram"
            ? "MARKETING_META_ACCESS_TOKEN + MARKETING_INSTAGRAM_ACCOUNT_ID"
            : (ch.envKey ?? "n/a");
    return {
      ok: false,
      error: `${ch.label} API not configured (${missing}). Copy and post manually.`,
      mode: "manual",
      manualText,
    };
  }

  const token = process.env.MARKETING_META_ACCESS_TOKEN?.trim();

  try {
    if (payload.channel === "linkedin") {
      return publishLinkedIn(payload, process.env.MARKETING_LINKEDIN_ACCESS_TOKEN!.trim());
    }
    if (payload.channel === "facebook" && token) {
      return publishFacebook(payload, token);
    }
    if (payload.channel === "instagram" && token) {
      return publishInstagram(payload, token);
    }
    if (payload.channel === "tiktok") {
      return {
        ok: false,
        error: "TikTok Content Posting API requires app review — use manual copy for now.",
        mode: "manual",
        manualText,
      };
    }
    if (payload.channel === "google_ads") {
      return {
        ok: false,
        error: "Google Ads API integration coming in phase 2 — export ad copy manually.",
        mode: "manual",
        manualText: payload.body,
      };
    }

    return { ok: false, error: "Unsupported channel", mode: "manual", manualText };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Publish failed",
      mode: "manual",
      manualText,
    };
  }
}

export function getPublisherStatus() {
  return {
    linkedin: isChannelConfigured("linkedin"),
    instagram: isChannelConfigured("instagram"),
    facebook: isChannelConfigured("facebook"),
    tiktok: isChannelConfigured("tiktok"),
    google_ads: isChannelConfigured("google_ads"),
    google_search: true,
    hashtagResearch: Boolean(process.env.SERPER_API_KEY?.trim()),
    imageGeneration: Boolean(process.env.OPENAI_API_KEY?.trim() && process.env.ENABLE_OPENAI !== "false"),
    videoGeneration: Boolean(process.env.REPLICATE_API_TOKEN?.trim()),
  };
}

export { getBrandProfile, BRAND_PROFILES, buildTrackingUrl } from "./brands";
export { MARKETING_CHANNELS, getChannel, isChannelConfigured } from "./channels";
export { generateMarketingContent } from "./generate";
export { researchHashtags, mergePostHashtags } from "./hashtags";
export {
  buildCreativePrompt,
  getAppVisualKit,
  generateMarketingImage,
  generateMarketingVideo,
} from "./creatives";
export type { GeneratedMedia, MarketingMediaKind } from "./creatives";
export type { AppVisualKit } from "./app-visuals";
export type {
  GenerateMarketingRequest,
  GenerateMarketingResult,
  GeneratedSeoContent,
  GeneratedSocialPost,
  MarketingBrandId,
  MarketingChannelId,
  MarketingContentKind,
  MarketingPostStatus,
  PublishPayload,
  PublishResult,
  BrandProfile,
} from "./types";
export type { HashtagResearchMap } from "./hashtags";
