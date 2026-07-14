import { buildCreativePrompt, buildVideoMotionPrompt, getAppVisualKit } from "./app-visuals";
import { createReplicatePrediction, pollReplicatePrediction } from "./replicate-api";
import { getBrandProfile } from "./brands";
import type { MarketingBrandId, MarketingChannelId } from "./types";

export type MarketingMediaKind = "image" | "gif" | "video";

export type GeneratedMedia = {
  mediaType: MarketingMediaKind;
  mimeType: string;
  base64: string;
  prompt: string;
  source: "dalle" | "openai-image" | "openai-edit" | "ken-burns" | "replicate" | "gemini" | "pollinations" | "cloudflare" | "puter";
};

export type ReferenceImageMode = "reimagine" | "polish";

function imageSize(channel?: MarketingChannelId): string {
  const kit = getAppVisualKit("motivelife", channel);
  // gpt-image-1 sizes (DALL·E 3 sizes no longer valid)
  if (kit.aspectRatio === "9:16") return "1024x1536";
  if (kit.aspectRatio === "16:9") return "1536x1024";
  return "1024x1024";
}

function isGptImageModel(model: string): boolean {
  return model.startsWith("gpt-image");
}

async function fetchImageBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not fetch image (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}

export async function generateMarketingImage(
  params: {
    brandId: MarketingBrandId;
    brief: string;
    imagePrompt?: string;
    channel?: MarketingChannelId;
  },
  apiKey: string
): Promise<GeneratedMedia> {
  const prompt = buildCreativePrompt(
    params.brandId,
    params.brief,
    params.imagePrompt,
    params.channel
  );
  const brand = getBrandProfile(params.brandId);

  const model = process.env.MARKETING_IMAGE_MODEL?.trim() || "gpt-image-1";
  const payload: Record<string, string | number> = {
    model,
    prompt: `${prompt}\nBrand name spelled exactly: ${brand.name}.`,
    size: imageSize(params.channel),
  };
  if (isGptImageModel(model)) {
    payload.quality = process.env.MARKETING_IMAGE_QUALITY?.trim() || "high";
  } else if (model.startsWith("dall-e")) {
    payload.n = 1;
    payload.quality = "hd";
  } else {
    payload.n = 1;
  }

  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Image generation failed: ${err.slice(0, 300)}`);
  }

  const data = (await response.json()) as {
    data?: { url?: string; b64_json?: string }[];
  };
  const item = data.data?.[0];
  let base64: string | undefined = item?.b64_json;
  if (!base64 && item?.url) {
    const buf = await fetchImageBuffer(item.url);
    base64 = buf.toString("base64");
  }
  if (!base64) throw new Error("Image generation returned no data.");

  return {
    mediaType: "image",
    mimeType: "image/png",
    base64: base64,
    prompt,
    source: isGptImageModel(model) ? "openai-image" : "dalle",
  };
}

function referenceEditPrompt(
  mode: ReferenceImageMode,
  basePrompt: string,
  brandName: string
): string {
  const intro =
    mode === "polish"
      ? [
          "EDIT BRIEF — Polish this real app screenshot into a paid-social still.",
          "Keep the same feature, layout hierarchy, and brand chrome.",
          "Remove OS status bars, notch clutter, and home-indicator noise.",
          "Upgrade lighting, contrast, and accent gradient so it feels campaign-ready — not a raw phone capture.",
        ].join(" ")
      : [
          "EDIT BRIEF — Reimagine this app screenshot as a premium growth ad.",
          "Preserve the feature and message visible in the UI.",
          "Recreate as a cinematic product shot: dark navy atmosphere, crisp UI panels,",
          "intentional phone/UI hero, cyan/lime (or brand) accent rim light.",
          "Do not paste a naked screenshot with white margins.",
        ].join(" ");

  return `${intro}\n\n${basePrompt}\nBrand: ${brandName}.`;
}

/** Re-imagine or polish a reference screenshot via OpenAI images/edits. */
export async function generateMarketingImageFromReference(
  params: {
    brandId: MarketingBrandId;
    brief: string;
    imagePrompt?: string;
    channel?: MarketingChannelId;
    referenceBase64: string;
    referenceMimeType: string;
    mode?: ReferenceImageMode;
  },
  apiKey: string
): Promise<GeneratedMedia> {
  const mode = params.mode ?? "reimagine";
  const brand = getBrandProfile(params.brandId);
  const basePrompt = buildCreativePrompt(
    params.brandId,
    params.brief,
    params.imagePrompt,
    params.channel
  );
  const prompt = referenceEditPrompt(mode, basePrompt, brand.name);
  const model = process.env.MARKETING_IMAGE_MODEL?.trim() || "gpt-image-1";
  const size = imageSize(params.channel);

  const mime =
    params.referenceMimeType === "image/jpeg" ||
    params.referenceMimeType === "image/png" ||
    params.referenceMimeType === "image/webp"
      ? params.referenceMimeType
      : "image/png";
  const ext = mime === "image/jpeg" ? "jpg" : mime === "image/webp" ? "webp" : "png";

  const form = new FormData();
  form.append("model", model);
  form.append("prompt", prompt);
  form.append("size", size);
  form.append(
    "image",
    new Blob([Buffer.from(params.referenceBase64, "base64")], { type: mime }),
    `reference.${ext}`
  );
  if (isGptImageModel(model)) {
    form.append("quality", process.env.MARKETING_IMAGE_QUALITY?.trim() || "high");
    if (mode === "polish" && model.includes("1.5")) {
      form.append("input_fidelity", "high");
    }
  }

  const response = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Image re-imagine failed: ${err.slice(0, 300)}`);
  }

  const data = (await response.json()) as {
    data?: { url?: string; b64_json?: string }[];
  };
  const item = data.data?.[0];
  let base64: string | undefined = item?.b64_json;
  if (!base64 && item?.url) {
    const buf = await fetchImageBuffer(item.url);
    base64 = buf.toString("base64");
  }
  if (!base64) throw new Error("Image re-imagine returned no data.");

  return {
    mediaType: "image",
    mimeType: "image/png",
    base64,
    prompt,
    source: "openai-edit",
  };
}

/** Short MP4 via Replicate image-to-video (no separate voiceover / mux). */
export async function generateMarketingVideo(
  params: {
    brandId: MarketingBrandId;
    brief: string;
    imagePrompt?: string;
    channel?: MarketingChannelId;
    imageBase64?: string;
    /** Target length hint — models often cap ~5–6s; longer requests still get best available I2V. */
    durationSec?: 5 | 15 | 30;
  },
  apiKey: string,
  replicateToken?: string | null
): Promise<GeneratedMedia> {
  const image =
    params.imageBase64 != null
      ? {
          mediaType: "image" as const,
          mimeType: "image/png",
          base64: params.imageBase64,
          prompt: "",
          source: "dalle" as const,
        }
      : await generateMarketingImage(params, apiKey);

  const token = replicateToken?.trim();
  if (!token) {
    throw new Error(
      "REPLICATE_API_TOKEN not set — use Ken Burns GIF fallback or add Replicate for MP4."
    );
  }

  const durationSec = params.durationSec ?? 5;
  const prompt = buildVideoMotionPrompt(
    params.brandId,
    params.brief,
    params.imagePrompt,
    params.channel,
    durationSec
  );
  const model =
    process.env.MARKETING_VIDEO_MODEL?.trim() ||
    "minimax/video-01";

  const input: Record<string, unknown> = {
    prompt,
    first_frame_image: `data:${image.mimeType};base64,${image.base64}`,
    prompt_optimizer: true,
  };

  const predictionId = await createReplicatePrediction(model, input, token);

  // Fail faster so Ken Burns + narrated mux still fit in the serverless budget.
  const videoUrl = await pollReplicatePrediction(predictionId, token, 90_000);
  const videoBuffer = await fetchImageBuffer(videoUrl);

  return {
    mediaType: "video",
    mimeType: "video/mp4",
    base64: videoBuffer.toString("base64"),
    prompt,
    source: "replicate",
  };
}

export {
  buildCreativePrompt,
  buildVideoMotionPrompt,
  getAppVisualKit,
  pickProductUiScreenshotUrl,
  loadProductUiScreenshot,
  isProductUiReferenceUrl,
  MOTIVELIFE_PRODUCT_SCREENSHOTS,
} from "./app-visuals";
