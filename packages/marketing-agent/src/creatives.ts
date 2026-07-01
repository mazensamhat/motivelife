import { buildCreativePrompt, getAppVisualKit } from "./app-visuals";
import { getBrandProfile } from "./brands";
import type { MarketingBrandId, MarketingChannelId } from "./types";

export type MarketingMediaKind = "image" | "gif" | "video";

export type GeneratedMedia = {
  mediaType: MarketingMediaKind;
  mimeType: string;
  base64: string;
  prompt: string;
  source: "dalle" | "ken-burns" | "replicate";
};

function dalleSize(channel?: MarketingChannelId): "1024x1024" | "1024x1792" | "1792x1024" {
  const kit = getAppVisualKit("motivelife", channel);
  if (kit.aspectRatio === "9:16") return "1024x1792";
  if (kit.aspectRatio === "16:9") return "1792x1024";
  return "1024x1024";
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

  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "dall-e-3",
      prompt: `${prompt}\nBrand name: ${brand.name}.`,
      n: 1,
      size: dalleSize(params.channel),
      quality: "hd",
      response_format: "b64_json",
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Image generation failed: ${err.slice(0, 300)}`);
  }

  const data = (await response.json()) as {
    data?: { b64_json?: string }[];
  };
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw new Error("Image generation returned no data.");

  return {
    mediaType: "image",
    mimeType: "image/png",
    base64: b64,
    prompt,
    source: "dalle",
  };
}

async function pollReplicatePrediction(
  id: string,
  token: string,
  timeoutMs = 120_000
): Promise<string> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const res = await fetch(`https://api.replicate.com/v1/predictions/${id}`, {
      headers: { Authorization: `Token ${token}` },
    });
    if (!res.ok) throw new Error(`Replicate poll failed (${res.status})`);
    const data = (await res.json()) as {
      status?: string;
      output?: string | string[];
      error?: string;
    };
    if (data.status === "succeeded") {
      const out = data.output;
      const url = Array.isArray(out) ? out[0] : out;
      if (!url) throw new Error("Replicate returned empty output.");
      return url;
    }
    if (data.status === "failed" || data.status === "canceled") {
      throw new Error(data.error ?? "Replicate video generation failed.");
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error("Video generation timed out.");
}

/** Optional ~5s clip via Replicate (set REPLICATE_API_TOKEN). */
export async function generateMarketingVideo(
  params: {
    brandId: MarketingBrandId;
    brief: string;
    imagePrompt?: string;
    channel?: MarketingChannelId;
    imageBase64?: string;
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

  const prompt = buildCreativePrompt(
    params.brandId,
    params.brief,
    params.imagePrompt,
    params.channel
  );
  const model =
    process.env.MARKETING_VIDEO_MODEL?.trim() ||
    "minimax/video-01";

  const createRes = await fetch("https://api.replicate.com/v1/models/" + model + "/predictions", {
    method: "POST",
    headers: {
      Authorization: `Token ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: {
        prompt: `${prompt}. Subtle camera motion, premium product ad, 5 seconds.`,
        first_frame_image: `data:${image.mimeType};base64,${image.base64}`,
        duration: 5,
      },
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`Replicate create failed: ${err.slice(0, 300)}`);
  }

  const created = (await createRes.json()) as { id?: string };
  if (!created.id) throw new Error("Replicate missing prediction id.");

  const videoUrl = await pollReplicatePrediction(created.id, token);
  const videoBuffer = await fetchImageBuffer(videoUrl);

  return {
    mediaType: "video",
    mimeType: "video/mp4",
    base64: videoBuffer.toString("base64"),
    prompt,
    source: "replicate",
  };
}

export { buildCreativePrompt, getAppVisualKit } from "./app-visuals";
