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

export type CreativeKind = "image" | "animation" | "video_5" | "video_30";

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
  const freeParams = {
    brandId,
    brief,
    imagePrompt: post.imagePrompt ?? undefined,
    channel,
    referenceBase64: post.sourceImageData ?? undefined,
    referenceMimeType: post.sourceImageMimeType ?? undefined,
    mode,
    referenceUrl: post.sourceImageData
      ? await uploadReferenceFetchableUrl(
          post.sourceImageData,
          post.sourceImageMimeType ?? "image/png"
        )
      : undefined,
  };

  if (backend.provider === "browser-worker") {
    const prompt = buildGeminiBrowserPrompt({
      brandId,
      brief,
      imagePrompt: post.imagePrompt ?? undefined,
      channel,
      hasReference: Boolean(post.sourceImageData),
      mode,
    });
    const still = await generateMarketingImageViaGeminiBrowser(
      backend.url,
      {
        prompt,
        referenceBase64: post.sourceImageData ?? undefined,
        referenceMimeType: post.sourceImageMimeType ?? undefined,
      },
      backend.secret
    );
    return wrapStill(still.base64, brandId, channel, brief, Boolean(post.sourceImageData), mode);
  }

  if (backend.provider === "pollinations") {
    const still = await generateMarketingImageViaPollinations(freeParams);
    return wrapStill(still.base64, brandId, channel, brief, Boolean(post.sourceImageData), mode);
  }

  if (backend.provider === "cloudflare") {
    const still = await generateMarketingImageViaCloudflare(
      freeParams,
      backend.accountId,
      backend.apiToken
    );
    return wrapStill(still.base64, brandId, channel, brief, Boolean(post.sourceImageData), mode);
  }

  if (backend.provider === "puter") {
    const still = await generateMarketingImageViaPuter(freeParams, backend.authToken);
    return wrapStill(still.base64, brandId, channel, brief, Boolean(post.sourceImageData), mode);
  }

  const apiKey = backend.apiKey;
  const imageBackend = backend.provider;

  if (post.sourceImageData) {
    const refParams = {
      brandId,
      brief,
      imagePrompt: post.imagePrompt ?? undefined,
      channel,
      referenceBase64: post.sourceImageData,
      referenceMimeType: post.sourceImageMimeType ?? "image/png",
      mode,
    };
    const still =
      imageBackend === "gemini"
        ? await generateMarketingImageFromReferenceViaGemini(refParams, apiKey)
        : await generateMarketingImageFromReference(refParams, apiKey);
    return wrapStill(still.base64, brandId, channel, brief, true, mode);
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
        { brandId, postBody: post.body, durationSec },
        narrationKey
      );
      const audioMp3 = await generateSpeechMp3(script, narrationKey);
      narrationData = audioMp3.toString("base64");
      narrationMimeType = "audio/mpeg";

      if (kind === "video_5") {
        const mp4 = await tryReplicateMp4(
          {
            brandId,
            brief,
            imagePrompt: post.imagePrompt ?? undefined,
            channel,
            imageBase64: pngBuffer.toString("base64"),
          },
          narrationKey
        );
        if (mp4) {
          media = mp4;
        } else {
          media = await buildKenBurnsMedia(pngBuffer, channel, 5);
        }
      } else {
        media = await buildKenBurnsMedia(pngBuffer, channel, 30);
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
            ? "30s narrated MP4 ready — voiceover is baked in for Reels, TikTok, or auto-publish."
            : "5s narrated MP4 ready — voiceover is baked in for Reels, TikTok, or auto-publish.";
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
