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
import { uploadMarketingTempFetchableUrl } from "@/lib/marketing-blob-temp";
import { generateNarrationScript, generateSpeechMp3 } from "@/lib/marketing-voice";
import { muxMarketingVideoWithNarration } from "@/lib/marketing-video-mux";
import { buildPartialVideoNote } from "@/lib/marketing-publish-errors";

export type CreativeKind =
  | "image"
  | "animation"
  | "video_5"
  | "video_15"
  | "video_30";

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
    durationSec?: 5 | 15 | 30;
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

function videoDurationSec(kind: CreativeKind): 5 | 15 | 30 {
  if (kind === "video_30") return 30;
  if (kind === "video_15") return 15;
  return 5;
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

  const imageBackend = imageProvider
    ? resolveMarketingImageBackendForProvider(imageProvider)
    : resolveMarketingImageBackend();
  if (!imageBackend) {
    return {
      ok: false as const,
      error: marketingImageBackendHint(),
    };
  }

  try {
    const { pngBuffer, brandId, channel, brief, fromReference, referenceMode } =
      await resolveStillImage(post, imageBackend);

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
      // Narrated video: still → I2V (~5–6s) → Ken Burns extend for 15/30 → script + TTS → mux.
      // If mux fails, keep silent visual + separate narration player (not a hard fail).
      const durationSec = videoDurationSec(kind);
      if (!process.env.REPLICATE_API_TOKEN?.trim()) {
        return {
          ok: false as const,
          error:
            "Narrated video needs REPLICATE_API_TOKEN in Vercel. Or use Image / GIF, then CapCut/AIReel.",
        };
      }

      const apiKey =
        getOpenAiApiKey() ??
        (imageBackend.provider === "openai" || imageBackend.provider === "gemini"
          ? imageBackend.apiKey
          : null);
      if (!apiKey || apiKey === "unused") {
        return {
          ok: false as const,
          error: "Narrated video needs OPENAI_API_KEY (script + TTS).",
        };
      }

      // Try I2V on 5s / 15s (30s skips I2V to stay within serverless time budgets).
      const motion =
        durationSec <= 15
          ? await tryReplicateMp4(
              {
                brandId,
                brief,
                imagePrompt: post.imagePrompt ?? undefined,
                channel,
                imageBase64: pngBuffer.toString("base64"),
                durationSec,
              },
              apiKey
            )
          : null;

      let visual: MediaPayload;
      let pipelineNote = "";

      if (durationSec > 6) {
        // I2V caps ~5–6s — extend to 15/30 with Ken Burns from the same still.
        visual = await buildKenBurnsMedia(pngBuffer, channel, durationSec);
        pipelineNote = motion
          ? ` I2V motion base + Ken Burns extend to ${durationSec}s.`
          : ` Extended to ${durationSec}s with Ken Burns.`;
      } else if (motion) {
        visual = motion;
        pipelineNote = " AI motion clip.";
      } else {
        visual = await buildKenBurnsMedia(pngBuffer, channel, 5);
        pipelineNote = " Ken Burns fallback (I2V unavailable).";
      }

      let narrationMp3: Buffer | null = null;
      try {
        const script = await generateNarrationScript(
          {
            brandId,
            postBody: post.body,
            durationSec,
            brief: post.aiBrief ?? post.body.slice(0, 500),
          },
          apiKey
        );
        narrationMp3 = await generateSpeechMp3(script, apiKey);
      } catch (error) {
        console.warn("[marketing/creative] Narration failed", error);
      }

      const narrationData = narrationMp3 ? narrationMp3.toString("base64") : null;
      const narrationMimeType = narrationMp3 ? "audio/mpeg" : null;

      if (narrationMp3) {
        const muxed = await muxMarketingVideoWithNarration(
          visual.buffer,
          visual.mimeType,
          narrationMp3,
          durationSec
        );
        if (muxed.ok) {
          media = {
            buffer: muxed.buffer,
            mimeType: "video/mp4",
            mediaType: "video",
          };
          fallbackNote = `${durationSec}s narrated MP4 ready.${pipelineNote}`;
        } else {
          media = visual;
          partialSuccess = true;
          fallbackNote = buildPartialVideoNote(durationSec, muxed.error) + pipelineNote;
        }
      } else {
        media = visual;
        partialSuccess = true;
        fallbackNote = `${durationSec}s visual ready — voiceover failed. Retry video when OpenAI is available.${pipelineNote}`;
      }

      if (fromReference) {
        fallbackNote += ` ${referenceCreativeNote(referenceMode, kind)}`;
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
