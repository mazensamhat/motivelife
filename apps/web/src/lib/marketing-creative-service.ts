import { prisma } from "@forward/database";
import { randomUUID } from "crypto";
import {
  generateMarketingImage,
  generateMarketingImageFromReference,
  generateMarketingImageFromReferenceViaGemini,
  generateMarketingImageViaGemini,
  generateMarketingImageViaGeminiBrowser,
  generateMarketingImageViaPollinations,
  generateMarketingImageViaCloudflare,
  generateMarketingImageViaPuter,
  generateMarketingVideo,
  generatePredisContent,
  isPredisConfigured,
  buildGeminiBrowserPrompt,
  loadProductUiScreenshot,
  type MarketingBrandId,
  type MarketingChannelId,
  type ReferenceImageMode,
} from "@forward/marketing-agent";
import {
  resolveMarketingImageBackend,
  resolveMarketingImageBackendForProvider,
  marketingImageBackendHint,
  type MarketingImageBackend,
  type MarketingImageProvider,
} from "@/lib/google-ai-config";
import { getOpenAiApiKey } from "@/lib/openai-config";
import {
  createKenBurnsGif,
  kenBurnsOptionsForChannel,
  optimizeMediaBuffer,
  persistMarketingMedia,
} from "@/lib/marketing-creatives";
import { serializeMarketingPost } from "@/lib/marketing-agent-service";
import { generateNarrationScript, generateSpeechMp3 } from "@/lib/marketing-voice";
import { muxMarketingVideoWithNarration } from "@/lib/marketing-video-mux";
import { buildPartialVideoNote } from "@/lib/marketing-publish-errors";
import { uploadMarketingTempFetchableUrl } from "@/lib/marketing-blob-temp";

export type CreativeKind =
  | "image"
  | "animation"
  | "video_5"
  | "video_30"
  | "predis_image"
  | "predis_carousel"
  | "predis_video";

type MediaPayload = {
  buffer: Buffer;
  mimeType: string;
  mediaType: "image" | "gif" | "video";
};

async function uploadReferenceFetchableUrl(
  base64: string,
  mimeType: string
): Promise<string | undefined> {
  const ext = mimeType.includes("png") ? "png" : mimeType.includes("webp") ? "webp" : "jpg";
  const buffer = Buffer.from(base64, "base64");
  return uploadMarketingTempFetchableUrl(
    `marketing/ref-temp/${randomUUID()}.${ext}`,
    buffer,
    mimeType
  );
}

async function resolveStillImage(
  post: {
    brand: string;
    channel: string | null;
    body: string;
    imagePrompt: string | null;
    aiBrief: string | null;
    sourceImageData: string | null;
    sourceImageMimeType: string | null;
    sourceImageMode: string | null;
  },
  backend: MarketingImageBackend
) {
  const brandId = post.brand as MarketingBrandId;
  const channel = post.channel as MarketingChannelId;
  const brief = post.aiBrief ?? post.body.slice(0, 500);
  const mode = (post.sourceImageMode as ReferenceImageMode | null) ?? "reimagine";

  // Prefer ops-pasted screenshot; otherwise condition on real product UI frames.
  let referenceBase64 = post.sourceImageData ?? undefined;
  let referenceMimeType = post.sourceImageMimeType ?? undefined;
  let usedProductUi = false;
  if (!referenceBase64) {
    const productShot = await loadProductUiScreenshot(
      brandId,
      `${brief} ${post.imagePrompt ?? ""}`,
      channel
    );
    if (productShot) {
      referenceBase64 = productShot.base64;
      referenceMimeType = productShot.mimeType;
      usedProductUi = true;
    } else {
      // Fetch env / public kit URLs for FX / Pulse / IQ when configured.
      const productShotUrl = await fetchKitScreenshotFallback(brandId, brief, channel);
      if (productShotUrl) {
        referenceBase64 = productShotUrl.base64;
        referenceMimeType = productShotUrl.mimeType;
        usedProductUi = true;
      }
    }
  }

  const fromUser = Boolean(post.sourceImageData);
  const freeParams = {
    brandId,
    brief,
    imagePrompt: post.imagePrompt ?? undefined,
    channel,
    referenceBase64,
    referenceMimeType,
    mode: fromUser ? mode : ("reimagine" as ReferenceImageMode),
    referenceUrl: referenceBase64
      ? await uploadReferenceFetchableUrl(referenceBase64, referenceMimeType ?? "image/png")
      : undefined,
  };

  if (backend.provider === "browser-worker") {
    const prompt = buildGeminiBrowserPrompt({
      brandId,
      brief,
      imagePrompt: post.imagePrompt ?? undefined,
      channel,
      hasReference: Boolean(referenceBase64),
      mode: freeParams.mode,
    });
    const still = await generateMarketingImageViaGeminiBrowser(
      backend.url,
      {
        prompt,
        referenceBase64,
        referenceMimeType,
      },
      backend.secret
    );
    return wrapStill(
      still.base64,
      brandId,
      channel,
      brief,
      fromUser || usedProductUi,
      fromUser ? freeParams.mode : null
    );
  }

  if (backend.provider === "pollinations") {
    const still = await generateMarketingImageViaPollinations(freeParams);
    return wrapStill(
      still.base64,
      brandId,
      channel,
      brief,
      fromUser || usedProductUi,
      fromUser ? freeParams.mode : null
    );
  }

  if (backend.provider === "cloudflare") {
    const still = await generateMarketingImageViaCloudflare(
      freeParams,
      backend.accountId,
      backend.apiToken
    );
    return wrapStill(
      still.base64,
      brandId,
      channel,
      brief,
      fromUser || usedProductUi,
      fromUser ? freeParams.mode : null
    );
  }

  if (backend.provider === "puter") {
    const still = await generateMarketingImageViaPuter(freeParams, backend.authToken);
    return wrapStill(
      still.base64,
      brandId,
      channel,
      brief,
      fromUser || usedProductUi,
      fromUser ? freeParams.mode : null
    );
  }

  const apiKey = backend.apiKey;
  const imageBackend = backend.provider;

  if (referenceBase64) {
    const refParams = {
      brandId,
      brief,
      imagePrompt: post.imagePrompt ?? undefined,
      channel,
      referenceBase64,
      referenceMimeType: referenceMimeType ?? "image/png",
      mode: freeParams.mode,
    };
    const still =
      imageBackend === "gemini"
        ? await generateMarketingImageFromReferenceViaGemini(refParams, apiKey)
        : await generateMarketingImageFromReference(refParams, apiKey);
    return wrapStill(
      still.base64,
      brandId,
      channel,
      brief,
      true,
      fromUser ? freeParams.mode : null
    );
  }

  const still =
    imageBackend === "gemini"
      ? await generateMarketingImageViaGemini(
          { brandId, brief, imagePrompt: post.imagePrompt ?? undefined, channel },
          apiKey
        )
      : await generateMarketingImage(
          { brandId, brief, imagePrompt: post.imagePrompt ?? undefined, channel },
          apiKey
        );
  return wrapStill(still.base64, brandId, channel, brief, false, null);
}

async function fetchKitScreenshotFallback(
  brandId: MarketingBrandId,
  brief: string,
  channel: MarketingChannelId
): Promise<{ base64: string; mimeType: string } | null> {
  const { pickProductUiScreenshotUrl } = await import("@forward/marketing-agent");
  const url = pickProductUiScreenshotUrl(brandId, brief, channel);
  if (!url) return null;
  try {
    const res = await fetch(url, {
      headers: { Accept: "image/*" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    const mimeType = res.headers.get("content-type")?.split(";")[0]?.trim() || "image/png";
    if (!mimeType.startsWith("image/")) return null;
    return { base64: Buffer.from(await res.arrayBuffer()).toString("base64"), mimeType };
  } catch {
    return null;
  }
}

function wrapStill(
  base64: string,
  brandId: MarketingBrandId,
  channel: MarketingChannelId,
  brief: string,
  fromReference: boolean,
  referenceMode: ReferenceImageMode | null
) {
  return {
    pngBuffer: Buffer.from(base64, "base64"),
    brandId,
    channel,
    brief,
    fromReference,
    referenceMode,
  };
}

function referenceCreativeNote(mode: ReferenceImageMode | null, kind: CreativeKind): string {
  if (!mode) return "Conditioned on MotiveLife product UI.";
  if (mode === "polish") {
    return kind === "image"
      ? "Polished your screenshot into a social-ready image."
      : "Built from your polished screenshot.";
  }
  return kind === "image"
    ? "AI reimagined your screenshot as a premium social creative."
    : "Built from your reimagined screenshot.";
}

async function buildKenBurnsMedia(
  pngBuffer: Buffer,
  channel: MarketingChannelId,
  durationSec: number
): Promise<MediaPayload> {
  const opts = kenBurnsOptionsForChannel(channel, durationSec);
  const gifBuffer = await createKenBurnsGif(pngBuffer, opts);
  return { buffer: gifBuffer, mimeType: "image/gif", mediaType: "gif" };
}

async function tryReplicateMp4(
  params: {
    brandId: MarketingBrandId;
    brief: string;
    imagePrompt?: string;
    channel: MarketingChannelId;
    imageBase64: string;
    durationSec?: 5 | 30;
  },
  apiKey: string
): Promise<MediaPayload | null> {
  const token = process.env.REPLICATE_API_TOKEN?.trim();
  if (!token) return null;

  try {
    const video = await generateMarketingVideo(params, apiKey, token);
    return {
      buffer: Buffer.from(video.base64, "base64"),
      mimeType: video.mimeType,
      mediaType: "video",
    };
  } catch (error) {
    console.warn("[marketing/creative] Replicate video unavailable", error);
    return null;
  }
}

async function generatePredisCreative(
  postId: string,
  post: {
    brand: string;
    body: string;
    aiBrief: string | null;
    imagePrompt: string | null;
  },
  kind: "predis_image" | "predis_carousel" | "predis_video"
) {
  const brandId = post.brand as MarketingBrandId;
  if (!isPredisConfigured(brandId)) {
    return {
      ok: false as const,
      error:
        "Predis not configured. Set MARKETING_PREDIS_API_KEY and MARKETING_PREDIS_BRAND_ID in Vercel.",
    };
  }

  const mediaType =
    kind === "predis_carousel" ? "carousel" : kind === "predis_video" ? "video" : "single_image";

  const brandLabel =
    brandId === "motivepulse"
      ? "MotivePulse IQ"
      : brandId === "motivefx"
        ? "MotiveFX"
        : brandId === "motiveiq"
          ? "MotiveIQ"
          : "MotiveLife";
  const text = [
    `Brand voice creative for ${brandLabel}.`,
    "Make a premium social ad that looks like the real product UI — dark, sharp, conversion-ready.",
    post.aiBrief,
    post.body,
    post.imagePrompt,
  ]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 1800);

  try {
    const predis = await generatePredisContent({
      brandId,
      text,
      mediaType,
      maxWaitMs: 150_000,
    });

    const primaryUrl = predis.mediaUrls[0];
    if (!primaryUrl) {
      return { ok: false as const, error: "Predis returned no media URLs." };
    }

    const mediaRes = await fetch(primaryUrl);
    if (!mediaRes.ok) {
      return {
        ok: false as const,
        error: `Could not download Predis media (${mediaRes.status}).`,
      };
    }

    const buffer = Buffer.from(await mediaRes.arrayBuffer());
    const contentType = mediaRes.headers.get("content-type") ?? "image/jpeg";
    const isVideo = mediaType === "video" || contentType.includes("video");
    const mimeType = isVideo
      ? contentType.split(";")[0]?.trim() || "video/mp4"
      : contentType.split(";")[0]?.trim() || "image/jpeg";

    const stored = await persistMarketingMedia(postId, buffer, mimeType);
    const caption =
      predis.caption?.trim() && predis.caption.trim().length > 40
        ? predis.caption.trim()
        : null;
    const updated = await prisma.marketingPost.update({
      where: { id: postId },
      data: {
        mediaType: isVideo ? "video" : "image",
        mediaMimeType: mimeType,
        mediaUrl: stored.mediaUrl ?? primaryUrl,
        mediaBlobPath: stored.mediaBlobPath,
        mediaData: stored.mediaData,
        publishError: null,
        ...(caption ? { body: caption.slice(0, 2200) } : {}),
      },
    });

    const serialized = serializeMarketingPost(updated);
    return {
      ok: true as const,
      post: serialized,
      previewUrl: serialized.mediaPreviewUrl,
      fallbackNote: `Predis ${mediaType.replace("_", " ")} ready (${predis.mediaUrls.length} asset${predis.mediaUrls.length === 1 ? "" : "s"})${caption ? " — caption refined." : "."}`,
      partialSuccess: false,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Predis creative failed.";
    return { ok: false as const, error: message };
  }
}

export async function generatePostCreative(
  postId: string,
  kind: CreativeKind,
  imageProvider?: MarketingImageProvider
) {
  const post = await prisma.marketingPost.findUnique({ where: { id: postId } });
  if (!post) return { ok: false as const, error: "Post not found" };
  if (!post.channel) {
    return { ok: false as const, error: "Creatives are only for social posts." };
  }

  if (kind === "predis_image" || kind === "predis_carousel" || kind === "predis_video") {
    return generatePredisCreative(postId, post, kind);
  }

  const imageBackend = imageProvider
    ? resolveMarketingImageBackendForProvider(imageProvider)
    : resolveMarketingImageBackend();
  if (!imageBackend) {
    return {
      ok: false as const,
      error: marketingImageBackendHint(),
    };
  }

  const copyKey = getOpenAiApiKey();
  const narrationKey =
    copyKey ??
    (imageBackend.provider === "openai"
      ? imageBackend.apiKey
      : imageBackend.provider === "gemini"
        ? imageBackend.apiKey
        : null);

  try {
    const { pngBuffer, brandId, channel, brief, fromReference, referenceMode } =
      await resolveStillImage(post, imageBackend);

    let narrationData: string | null = null;
    let narrationMimeType: string | null = null;
    let fallbackNote: string | undefined;
    let partialSuccess = false;
    let media: MediaPayload;

    if (kind === "image") {
      const optimized = await optimizeMediaBuffer(pngBuffer, "image/png");
      media = {
        buffer: optimized.buffer,
        mimeType: optimized.mimeType,
        mediaType: "image",
      };
      if (fromReference) {
        fallbackNote = referenceCreativeNote(referenceMode, kind);
      }
    } else if (kind === "animation") {
      media = await buildKenBurnsMedia(pngBuffer, channel, 5);
      fallbackNote = fromReference
        ? `5s Ken Burns animation — ${referenceCreativeNote(referenceMode, kind)}`
        : "5s Ken Burns animation (GIF) — ready for Stories, posts, or Reels upload.";
    } else {
      if (!narrationKey) {
        return {
          ok: false as const,
          error: "Narrated video needs OPENAI_API_KEY for voiceover (or generate Image/GIF only with Gemini).",
        };
      }
      const durationSec = kind === "video_30" ? 30 : 5;
      const script = await generateNarrationScript(
        {
          brandId,
          postBody: post.body,
          durationSec,
          brief: post.aiBrief ?? brief,
        },
        narrationKey
      );
      const audioMp3 = await generateSpeechMp3(script, narrationKey);
      narrationData = audioMp3.toString("base64");
      narrationMimeType = "audio/mpeg";

      const mp4 = await tryReplicateMp4(
        {
          brandId,
          brief,
          imagePrompt: post.imagePrompt ?? undefined,
          channel,
          imageBase64: pngBuffer.toString("base64"),
          durationSec,
        },
        narrationKey
      );
      if (mp4) {
        media = mp4;
      } else {
        media = await buildKenBurnsMedia(pngBuffer, channel, durationSec);
      }

      const muxed = await muxMarketingVideoWithNarration(
        media.buffer,
        media.mimeType,
        audioMp3,
        durationSec
      );
      if (muxed.ok) {
        media = { buffer: muxed.buffer, mimeType: "video/mp4", mediaType: "video" };
        fallbackNote =
          durationSec >= 20
            ? mp4
              ? "30s narrated MP4 ready — AI motion + HD voiceover for Reels/TikTok."
              : "30s narrated MP4 ready (Ken Burns fallback) — add REPLICATE_API_TOKEN for real motion."
            : mp4
              ? "5s narrated MP4 ready — AI motion + HD voiceover for Reels/TikTok."
              : "5s narrated MP4 ready (Ken Burns fallback) — add REPLICATE_API_TOKEN for real motion.";
        if (fromReference) {
          fallbackNote += ` ${referenceCreativeNote(referenceMode, kind)}`;
        }
      } else if (muxed.noToken) {
        fallbackNote =
          "Animation + AI voiceover ready. Add REPLICATE_API_TOKEN in Vercel for narrated MP4s.";
        partialSuccess = true;
      } else {
        fallbackNote = buildPartialVideoNote(durationSec, muxed.error);
        partialSuccess = true;
      }
    }

    const stored = await persistMarketingMedia(postId, media.buffer, media.mimeType);

    const updated = await prisma.marketingPost.update({
      where: { id: postId },
      data: {
        mediaType: media.mediaType,
        mediaMimeType: media.mimeType,
        mediaUrl: stored.mediaUrl,
        mediaBlobPath: stored.mediaBlobPath,
        mediaData: stored.mediaData,
        narrationData,
        narrationMimeType,
        publishError: null,
      },
    });

    const serialized = serializeMarketingPost(updated);
    return {
      ok: true as const,
      post: serialized,
      previewUrl: serialized.mediaPreviewUrl,
      fallbackNote,
      partialSuccess,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Creative generation failed.";
    return { ok: false as const, error: message };
  }
}

export async function generateCreativesForPosts(
  postIds: string[],
  kind: CreativeKind
): Promise<{ created: number; errors: string[] }> {
  let created = 0;
  const errors: string[] = [];

  for (const id of postIds) {
    const result = await generatePostCreative(id, kind);
    if (result.ok) created += 1;
    else errors.push(result.error);
  }

  return { created, errors };
}
