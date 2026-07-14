import { buildTrackingUrl, getBrandProfile } from "./brands";
import {
  getBrandPublisherConfig,
  isBrandChannelConfigured,
  missingBrandChannelEnv,
  getAllBrandPublisherStatus,
} from "./brand-publishers";
import { getChannel, isChannelConfigured } from "./channels";
import { publishLinkedIn } from "./linkedin";
import { publishReddit } from "./reddit";
import { isNativeYouTubeConfigured, missingYouTubeEnv, publishYouTube } from "./youtube";
import {
  isBufferConfigured,
  isUnifiedSocialChannel,
  isZernioConfigured,
  publishViaUnified,
} from "./unified-publish";
import {
  resolveMetaPageAccessToken,
  resolveInstagramBusinessAccount,
  waitForInstagramMediaContainer,
} from "./meta-token";
import type { MarketingBrandId, PublishPayload, PublishResult } from "./types";
import type { BrandSocialChannel } from "./brand-publishers";

function defaultPostImageUrl(brandId: MarketingBrandId): string {
  const brandDefault = getBrandPublisherConfig(brandId).defaultPostImageUrl;
  if (brandDefault) return brandDefault;
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

async function metaGraphPost(
  path: string,
  token: string,
  body: Record<string, string>
): Promise<{ ok: true; externalId: string } | { ok: false; error: string }> {
  const res = await fetch(`https://graph.facebook.com/v21.0/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ access_token: token, ...body }),
  });

  if (!res.ok) {
    const err = await res.text();
    return { ok: false, error: err.slice(0, 500) };
  }

  const data = (await res.json()) as { id?: string; post_id?: string };
  const externalId = data.post_id ?? data.id ?? "meta-post";
  return { ok: true, externalId };
}

async function publishFacebook(
  payload: PublishPayload,
  pageToken: string,
  pageId: string
): Promise<PublishResult> {
  const message = formatManualPost(payload);
  const mediaUrl = payload.mediaUrl?.trim();

  if (payload.mediaType === "video" && mediaUrl) {
    const result = await metaGraphPost(`${pageId}/videos`, pageToken, {
      file_url: mediaUrl,
      description: message,
      published: "true",
    });
    if (!result.ok) {
      return { ok: false, error: result.error, mode: "manual", manualText: message };
    }
    return { ok: true, externalId: result.externalId, mode: "api" };
  }

  if (mediaUrl && (payload.mediaType === "image" || payload.mediaType === "gif")) {
    const result = await metaGraphPost(`${pageId}/photos`, pageToken, {
      url: mediaUrl,
      caption: message,
      published: "true",
    });
    if (!result.ok) {
      return { ok: false, error: result.error, mode: "manual", manualText: message };
    }
    return { ok: true, externalId: result.externalId, mode: "api" };
  }

  const feedBody: Record<string, string> = { message };
  const link = payload.ctaUrl?.trim();
  if (link) feedBody.link = link;

  const result = await metaGraphPost(`${pageId}/feed`, pageToken, feedBody);
  if (!result.ok) {
    return { ok: false, error: result.error, mode: "manual", manualText: message };
  }
  return { ok: true, externalId: result.externalId, mode: "api" };
}

function postMediaUrl(payload: PublishPayload): string {
  if (payload.mediaUrl?.trim()) return payload.mediaUrl.trim();
  return defaultPostImageUrl(payload.brandId);
}

async function publishInstagram(
  payload: PublishPayload,
  pageToken: string,
  igUserId: string
): Promise<PublishResult> {
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
    access_token: pageToken,
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

  const ready = await waitForInstagramMediaContainer(created.id, pageToken);
  if (!ready.ok) {
    return { ok: false, error: ready.error, mode: "manual", manualText: caption };
  }

  const publishRes = await fetch(
    `https://graph.facebook.com/v21.0/${igUserId}/media_publish`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        access_token: pageToken,
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
      error: "SEO posts are published to /blog via the Ops Console Publish to site action.",
      mode: "manual",
      manualText: `${payload.metaTitle ?? ""}\n${payload.metaDescription ?? ""}\n\n${payload.body}`,
    };
  }

  const brandPub = getBrandPublisherConfig(payload.brandId);

  // Native YouTube Shorts (no Buffer/Zernio) when refresh token is set.
  if (payload.channel === "youtube" && isNativeYouTubeConfigured(payload.brandId)) {
    return publishYouTube(payload, manualText);
  }

  // Prefer Buffer or Zernio when configured (cheap unified publish).
  if (isUnifiedSocialChannel(payload.channel)) {
    const unified = await publishViaUnified(payload, manualText);
    if (unified) return unified;
  }

  const ch = getChannel(payload.channel);
  const brandConfigured = isBrandChannelConfigured(
    payload.brandId,
    payload.channel as BrandSocialChannel
  );

  if (!ch.supportsAutoPublish || !brandConfigured) {
    const missing =
      payload.channel === "linkedin"
        ? missingBrandChannelEnv(payload.brandId, "linkedin")
        : payload.channel === "facebook"
          ? missingBrandChannelEnv(payload.brandId, "facebook")
          : payload.channel === "instagram"
            ? missingBrandChannelEnv(payload.brandId, "instagram")
            : payload.channel === "reddit"
              ? missingBrandChannelEnv(payload.brandId, "reddit")
              : payload.channel === "youtube"
                ? missingYouTubeEnv(payload.brandId)
                : payload.channel === "x" ||
                    payload.channel === "threads" ||
                    payload.channel === "tiktok"
                  ? missingBrandChannelEnv(payload.brandId, "unified")
                  : (ch.envKey ?? "n/a");
    return {
      ok: false,
      error: `${ch.label} API not configured for ${payload.brandId} (${missing}). Copy and post manually.`,
      mode: "manual",
      manualText,
    };
  }

  const token = brandPub.metaAccessToken;

  try {
    if (payload.channel === "linkedin") {
      const linkedInToken = brandPub.linkedinAccessToken;
      const linkedInOrg = brandPub.linkedinOrgId;
      if (!linkedInToken || !linkedInOrg) {
        return {
          ok: false,
          error: missingBrandChannelEnv(payload.brandId, "linkedin"),
          mode: "manual",
          manualText,
        };
      }
      return publishLinkedIn(payload, linkedInToken, linkedInOrg, formatManualPost(payload));
    }
    if ((payload.channel === "facebook" || payload.channel === "instagram") && token) {
      const pageId = brandPub.metaPageId;
      if (!pageId) {
        return {
          ok: false,
          error: `Meta Page ID not set for ${payload.brandId}.`,
          mode: "manual",
          manualText,
        };
      }

      const pageAuth = await resolveMetaPageAccessToken(token, pageId, {
        fallbackToken: process.env.MARKETING_META_ACCESS_TOKEN?.trim(),
      });
      if (!pageAuth.ok) {
        return { ok: false, error: pageAuth.error, mode: "manual", manualText };
      }

      if (payload.channel === "facebook") {
        return publishFacebook(payload, pageAuth.pageToken, pageId);
      }

      const igResolved = await resolveInstagramBusinessAccount(pageId, pageAuth.pageToken);
      let igUserId: string | undefined;
      if (igResolved.ok) {
        igUserId = igResolved.igUserId;
        const envIgId = brandPub.instagramAccountId;
        if (envIgId && envIgId !== igResolved.igUserId) {
          console.warn(
            `[marketing] ${payload.brandId} INSTAGRAM_ACCOUNT_ID (${envIgId}) differs from Page-linked IG (${igResolved.igUserId}); using Page-linked ID @${igResolved.username ?? "unknown"}.`
          );
        }
      } else {
        igUserId = brandPub.instagramAccountId;
        if (!igUserId) {
          return {
            ok: false,
            error: igResolved.error,
            mode: "manual",
            manualText,
          };
        }
      }

      return publishInstagram(payload, pageAuth.pageToken, igUserId);
    }
    if (payload.channel === "tiktok") {
      return {
        ok: false,
        error:
          "TikTok auto-publish needs Buffer or Zernio (MARKETING_BUFFER_* or MARKETING_ZERNIO_*).",
        mode: "manual",
        manualText,
      };
    }
    if (payload.channel === "reddit") {
      const clientId = brandPub.redditClientId;
      const clientSecret = brandPub.redditClientSecret;
      const username = brandPub.redditUsername;
      const subreddit = brandPub.redditSubreddit;
      if (!clientId || !clientSecret || !username || !subreddit) {
        return {
          ok: false,
          error: missingBrandChannelEnv(payload.brandId, "reddit"),
          mode: "manual",
          manualText,
        };
      }
      const userAgent =
        brandPub.redditUserAgent?.trim() ||
        `web:motivelife-marketing:1.0.0 (by /u/${username})`;
      return publishReddit(
        payload,
        {
          clientId,
          clientSecret,
          username,
          password: brandPub.redditPassword,
          refreshToken: brandPub.redditRefreshToken,
          userAgent,
          subreddit,
        },
        manualText
      );
    }
    if (
      payload.channel === "x" ||
      payload.channel === "threads"
    ) {
      return {
        ok: false,
        error: missingBrandChannelEnv(payload.brandId, "unified"),
        mode: "manual",
        manualText,
      };
    }
    if (payload.channel === "youtube") {
      return {
        ok: false,
        error: missingYouTubeEnv(payload.brandId),
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
  const openai =
    Boolean(process.env.OPENAI_API_KEY?.trim()) && process.env.ENABLE_OPENAI !== "false";
  const gemini = Boolean(
    process.env.GOOGLE_AI_API_KEY?.trim() || process.env.GEMINI_API_KEY?.trim()
  );
  const serper = Boolean(process.env.SERPER_API_KEY?.trim());
  const replicate = Boolean(process.env.REPLICATE_API_TOKEN?.trim());
  const grok = Boolean(process.env.XAI_API_KEY?.trim() || process.env.GROK_API_KEY?.trim());
  return {
    linkedin: isChannelConfigured("linkedin"),
    instagram: isChannelConfigured("instagram"),
    facebook: isChannelConfigured("facebook"),
    tiktok: isChannelConfigured("tiktok"),
    reddit: isChannelConfigured("reddit"),
    x: isChannelConfigured("x"),
    threads: isChannelConfigured("threads"),
    youtube:
      isChannelConfigured("youtube") ||
      isNativeYouTubeConfigured("motivefx") ||
      isNativeYouTubeConfigured("motiveiq") ||
      isNativeYouTubeConfigured("motivepulse"),
    google_ads: isChannelConfigured("google_ads"),
    google_search: true,
    buffer: isBufferConfigured("motivelife"),
    zernio: isZernioConfigured("motivelife"),
    openai,
    chatgpt: openai,
    gemini,
    pollinations: true,
    serper,
    hashtagResearch: serper,
    replicate,
    grok,
    brandPublishers: getAllBrandPublisherStatus(),
    imageGeneration: Boolean(
      gemini ||
        process.env.CLOUDFLARE_ACCOUNT_ID?.trim() ||
        process.env.PUTER_AUTH_TOKEN?.trim() ||
        process.env.GEMINI_BROWSER_WORKER_URL?.trim() ||
        openai ||
        process.env.MARKETING_IMAGE_PROVIDER?.trim() === "pollinations" ||
        !process.env.MARKETING_IMAGE_PROVIDER?.trim()
    ),
    freeImageProviders: {
      pollinations: true,
      cloudflare: Boolean(process.env.CLOUDFLARE_ACCOUNT_ID?.trim()),
      puter: Boolean(process.env.PUTER_AUTH_TOKEN?.trim()),
    },
    geminiImages: Boolean(gemini || process.env.GEMINI_BROWSER_WORKER_URL?.trim()),
    geminiBrowserWorker: Boolean(process.env.GEMINI_BROWSER_WORKER_URL?.trim()),
    videoGeneration: Boolean(replicate),
  };
}

export { getBrandProfile, BRAND_PROFILES, buildTrackingUrl } from "./brands";
export { MARKETING_CHANNELS, getChannel, isChannelConfigured } from "./channels";
export { generateMarketingContent } from "./generate";
export { researchHashtags, mergePostHashtags } from "./hashtags";
export {
  buildCreativePrompt,
  buildVideoMotionPrompt,
  getAppVisualKit,
  pickProductUiScreenshotUrl,
  loadProductUiScreenshot,
  isProductUiReferenceUrl,
  MOTIVELIFE_PRODUCT_SCREENSHOTS,
  generateMarketingImage,
  generateMarketingImageFromReference,
  generateMarketingVideo,
} from "./creatives";
export {
  generateMarketingImageViaGemini,
  generateMarketingImageFromReferenceViaGemini,
  getGeminiImageModel,
  DEFAULT_GEMINI_IMAGE_MODEL,
} from "./gemini-creatives";
export {
  generateMarketingImageViaPollinations,
  generateMarketingImageViaCloudflare,
  generateMarketingImageViaPuter,
} from "./free-image-providers";
export {
  generateMarketingImageViaGeminiBrowser,
  pingGeminiBrowserWorker,
} from "./gemini-browser-client";
export { buildGeminiBrowserPrompt } from "./gemini-browser-prompt";
export { createReplicatePrediction, pollReplicatePrediction } from "./replicate-api";
export {
  resolveMetaPageAccessToken,
  resolveInstagramBusinessAccount,
  waitForInstagramMediaContainer,
  testBrandMetaConnection,
} from "./meta-token";
export type { BrandMetaConnectionTest } from "./meta-token";
export {
  getBrandPublisherConfig,
  getAllBrandPublisherStatus,
  isBrandChannelConfigured,
  missingBrandChannelEnv,
} from "./brand-publishers";
export { isNativeYouTubeConfigured, publishYouTube, missingYouTubeEnv } from "./youtube";
export {
  isBufferConfigured,
  isZernioConfigured,
  isUnifiedPublishConfigured,
  publishViaBuffer,
  publishViaZernio,
  publishViaUnified,
  pickUnifiedProvider,
} from "./unified-publish";
export type { UnifiedPublishProvider } from "./unified-publish";
export type { GeneratedMedia, MarketingMediaKind, ReferenceImageMode } from "./creatives";
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
export type { BrandSocialChannel } from "./brand-publishers";
