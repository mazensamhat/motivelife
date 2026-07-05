import { buildCreativePrompt, getAppVisualKit } from "./app-visuals";
import { getBrandProfile } from "./brands";
import type { GeneratedMedia, ReferenceImageMode } from "./creatives";
import type { MarketingBrandId, MarketingChannelId } from "./types";

export type FreeImageParams = {
  brandId: MarketingBrandId;
  brief: string;
  imagePrompt?: string;
  channel?: MarketingChannelId;
  referenceBase64?: string;
  referenceMimeType?: string;
  referenceUrl?: string;
  mode?: ReferenceImageMode;
};

function dimensions(channel?: MarketingChannelId): { width: number; height: number } {
  const kit = getAppVisualKit("motivelife", channel);
  if (kit.aspectRatio === "9:16") return { width: 768, height: 1344 };
  if (kit.aspectRatio === "16:9") return { width: 1344, height: 768 };
  return { width: 1024, height: 1024 };
}

function buildPrompt(params: FreeImageParams): string {
  const base = buildCreativePrompt(
    params.brandId,
    params.brief,
    params.imagePrompt,
    params.channel
  );
  const brand = getBrandProfile(params.brandId);
  const hasRef = Boolean(params.referenceBase64 || params.referenceUrl);
  const action = hasRef
    ? params.mode === "polish"
      ? "Polish this app screenshot into a premium social ad."
      : "Reimagine this app screenshot as premium social marketing art."
    : "Create a premium social marketing image.";
  return `${action}\n${base}\nBrand: ${brand.name}. Dark premium UI, cyan-to-green gradient accents. No watermarks.`;
}

async function fetchImageBuffer(url: string): Promise<{ buffer: Buffer; mimeType: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not download image (${res.status})`);
  const mimeType = res.headers.get("content-type")?.split(";")[0] || "image/jpeg";
  return { buffer: Buffer.from(await res.arrayBuffer()), mimeType };
}

function toGenerated(buffer: Buffer, mimeType: string, prompt: string, source: GeneratedMedia["source"]): GeneratedMedia {
  return {
    mediaType: "image",
    mimeType,
    base64: buffer.toString("base64"),
    prompt,
    source,
  };
}

/** Pollinations — free flux model, optional POLLINATIONS_API_KEY for higher limits. */
export async function generateMarketingImageViaPollinations(params: FreeImageParams): Promise<GeneratedMedia> {
  const prompt = buildPrompt(params);
  const { width, height } = dimensions(params.channel);
  const model = process.env.POLLINATIONS_IMAGE_MODEL?.trim() || "flux";
  const apiKey = process.env.POLLINATIONS_API_KEY?.trim();

  const qs = new URLSearchParams({
    model,
    width: String(width),
    height: String(height),
    nologo: "true",
  });
  if (params.referenceUrl) qs.set("image", params.referenceUrl);

  const url = `https://gen.pollinations.ai/image/${encodeURIComponent(prompt)}?${qs}`;
  const headers: Record<string, string> = {};
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const res = await fetch(url, { headers, redirect: "follow" });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Pollinations failed: ${err.slice(0, 200)}`);
  }

  const mimeType = res.headers.get("content-type")?.split(";")[0] || "image/jpeg";
  const buffer = Buffer.from(await res.arrayBuffer());
  return toGenerated(buffer, mimeType, prompt, "pollinations");
}

/** Cloudflare Workers AI — free tier ~10k neurons/day. */
function normalizeCloudflareModel(model: string): string {
  const trimmed = model.trim();
  if (!/^@cf\/[\w.-]+\/[\w.-]+$/.test(trimmed)) {
    throw new Error(`Invalid CLOUDFLARE_AI_IMAGE_MODEL: ${trimmed}`);
  }
  return trimmed;
}

export async function generateMarketingImageViaCloudflare(
  params: FreeImageParams,
  accountId: string,
  apiToken: string
): Promise<GeneratedMedia> {
  const prompt = buildPrompt(params);
  const model = normalizeCloudflareModel(
    process.env.CLOUDFLARE_AI_IMAGE_MODEL?.trim() || "@cf/black-forest-labs/flux-1-schnell"
  );

  const body: Record<string, unknown> = { prompt, num_steps: 4 };
  // flux-1-schnell is text-to-image only; img2img params break the request.
  if (params.referenceUrl && model.includes("flux")) {
    // Reference handled via prompt; skip unsupported image input.
  } else if (params.referenceUrl) {
    body.image = params.referenceUrl;
  }

  // Model id must keep literal slashes — encodeURIComponent breaks routing (CF error 7000).
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const data = (await res.json()) as {
      result?: { image?: string };
      success?: boolean;
      errors?: Array<{ message?: string; code?: number }>;
    };
    if (!res.ok || data.success === false) {
      const msg = data.errors?.[0]?.message ?? JSON.stringify(data).slice(0, 250);
      throw new Error(`Cloudflare AI failed: ${msg}`);
    }
    const b64 = data.result?.image;
    if (!b64) {
      throw new Error(data.errors?.[0]?.message ?? "Cloudflare returned no image");
    }
    return toGenerated(Buffer.from(b64, "base64"), "image/png", prompt, "cloudflare");
  }

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Cloudflare AI failed: ${err.slice(0, 250)}`);
  }

  const mimeType = contentType.split(";")[0] || "image/jpeg";
  const buffer = Buffer.from(await res.arrayBuffer());
  return toGenerated(buffer, mimeType, prompt, "cloudflare");
}

/** Puter — uses OpenAI-compatible images API with PUTER_AUTH_TOKEN. */
export async function generateMarketingImageViaPuter(
  params: FreeImageParams,
  authToken: string
): Promise<GeneratedMedia> {
  const prompt = buildPrompt(params);
  const model = process.env.PUTER_IMAGE_MODEL?.trim() || "gpt-image-1-mini";
  const { width, height } = dimensions(params.channel);
  const size = width === height ? "1024x1024" : width > height ? "1536x1024" : "1024x1536";

  const body: Record<string, unknown> = {
    model,
    prompt,
    n: 1,
    size,
    response_format: "b64_json",
  };

  if (params.referenceBase64) {
    body.input_image = `data:${params.referenceMimeType ?? "image/png"};base64,${params.referenceBase64}`;
  }

  const res = await fetch("https://api.puter.com/puterai/openai/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${authToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Puter image failed: ${err.slice(0, 250)}`);
  }

  const data = (await res.json()) as { data?: Array<{ b64_json?: string; url?: string }> };
  const item = data.data?.[0];
  if (item?.b64_json) {
    return toGenerated(Buffer.from(item.b64_json, "base64"), "image/png", prompt, "puter");
  }
  if (item?.url) {
    const { buffer, mimeType } = await fetchImageBuffer(item.url);
    return toGenerated(buffer, mimeType, prompt, "puter");
  }
  throw new Error("Puter returned no image data");
}
