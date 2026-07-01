import { buildTrackingUrl, getBrandProfile } from "./brands";
import { getChannel, isChannelConfigured } from "./channels";
import type { PublishPayload, PublishResult } from "./types";

function formatManualPost(payload: PublishPayload): string {
  const tags = payload.hashtags?.length
    ? `\n\n${payload.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")}`
    : "";
  const link = payload.ctaUrl ? `\n\n${payload.ctaUrl}` : "";
  return `${payload.body.trim()}${tags}${link}`.trim();
}

async function publishLinkedIn(payload: PublishPayload, token: string): Promise<PublishResult> {
  const orgId = process.env.MARKETING_LINKEDIN_ORG_ID?.trim();
  if (!orgId) {
    return {
      ok: false,
      error: "MARKETING_LINKEDIN_ORG_ID not set",
      mode: "manual",
      manualText: formatManualPost(payload),
    };
  }

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
          shareCommentary: { text: formatManualPost(payload) },
          shareMediaCategory: "NONE",
        },
      },
      visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return { ok: false, error: err.slice(0, 500), mode: "manual", manualText: formatManualPost(payload) };
  }

  const data = (await res.json()) as { id?: string };
  return { ok: true, externalId: data.id ?? "linkedin-post", mode: "api" };
}

async function publishMeta(payload: PublishPayload, token: string): Promise<PublishResult> {
  const pageId = process.env.MARKETING_META_PAGE_ID?.trim();
  if (!pageId) {
    return {
      ok: false,
      error: "MARKETING_META_PAGE_ID not set",
      mode: "manual",
      manualText: formatManualPost(payload),
    };
  }

  const endpoint =
    payload.channel === "instagram"
      ? `https://graph.facebook.com/v21.0/${pageId}/media`
      : `https://graph.facebook.com/v21.0/${pageId}/feed`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      access_token: token,
      message: formatManualPost(payload),
      caption: formatManualPost(payload),
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return { ok: false, error: err.slice(0, 500), mode: "manual", manualText: formatManualPost(payload) };
  }

  const data = (await res.json()) as { id?: string };
  return { ok: true, externalId: data.id ?? "meta-post", mode: "api" };
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
    return {
      ok: false,
      error: `${ch.label} API not configured (${ch.envKey ?? "n/a"}). Copy and post manually.`,
      mode: "manual",
      manualText,
    };
  }

  try {
    if (payload.channel === "linkedin") {
      return publishLinkedIn(payload, process.env.MARKETING_LINKEDIN_ACCESS_TOKEN!.trim());
    }
    if (payload.channel === "facebook" || payload.channel === "instagram") {
      return publishMeta(payload, process.env.MARKETING_META_ACCESS_TOKEN!.trim());
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
  };
}

export { getBrandProfile, BRAND_PROFILES, buildTrackingUrl } from "./brands";
export { MARKETING_CHANNELS, getChannel, isChannelConfigured } from "./channels";
export { generateMarketingContent } from "./generate";
