import type { MarketingBrandId } from "./types";
import { getBrandProfile } from "./brands";

export type PredisMediaType = "single_image" | "carousel" | "video";

export type PredisGeneratedContent = {
  postId: string;
  mediaUrls: string[];
  caption?: string;
  mediaType: PredisMediaType;
};

export function isPredisConfigured(brandId?: MarketingBrandId): boolean {
  const apiKey = resolvePredisApiKey(brandId);
  const brandPredisId = resolvePredisBrandId(brandId);
  return Boolean(apiKey && brandPredisId);
}

function env(key: string): string | undefined {
  const v = process.env[key]?.trim();
  return v || undefined;
}

function brandEnv(brandId: MarketingBrandId, suffix: string): string | undefined {
  return env(`MARKETING_${brandId.toUpperCase()}_${suffix}`);
}

export function resolvePredisApiKey(brandId?: MarketingBrandId): string | undefined {
  if (brandId) {
    return brandEnv(brandId, "PREDIS_API_KEY") ?? env("MARKETING_PREDIS_API_KEY");
  }
  return env("MARKETING_PREDIS_API_KEY");
}

export function resolvePredisBrandId(brandId?: MarketingBrandId): string | undefined {
  if (brandId) {
    return brandEnv(brandId, "PREDIS_BRAND_ID") ?? env("MARKETING_PREDIS_BRAND_ID");
  }
  return env("MARKETING_PREDIS_BRAND_ID");
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

type CreateContentResponse = {
  post_ids?: string[];
  post_status?: string;
  errors?: Array<{ detail?: string; solution?: string } | string>;
};

type GetPostsResponse = {
  posts?: Array<{
    post_id?: string;
    urls?: string[];
    caption?: string;
    media_type?: string;
    status?: string;
  }>;
  errors?: unknown[];
};

async function createPredisContent(params: {
  apiKey: string;
  brandId: string;
  text: string;
  mediaType: PredisMediaType;
}): Promise<{ postId: string }> {
  const form = new FormData();
  form.set("brand_id", params.brandId);
  form.set("text", params.text.slice(0, 2000));
  form.set("media_type", params.mediaType);
  form.set("model_version", params.mediaType === "video" ? "2" : "4");
  form.set("n_posts", "1");
  form.set("color_palette_type", "brand");
  if (params.mediaType === "video") {
    form.set("video_duration", "short");
  }

  const res = await fetch("https://brain.predis.ai/predis_api/v1/create_content/", {
    method: "POST",
    headers: { Authorization: params.apiKey },
    body: form,
  });

  const raw = await res.text();
  let data: CreateContentResponse = {};
  try {
    data = JSON.parse(raw) as CreateContentResponse;
  } catch {
    throw new Error(`Predis create failed (${res.status}): ${raw.slice(0, 300)}`);
  }

  if (!res.ok) {
    const err =
      data.errors
        ?.map((e) => (typeof e === "string" ? e : e.detail ?? JSON.stringify(e)))
        .join("; ") || raw.slice(0, 300);
    throw new Error(err);
  }

  const postId = data.post_ids?.[0];
  if (!postId) {
    throw new Error("Predis did not return a post_id");
  }
  return { postId };
}

async function fetchPredisPost(
  apiKey: string,
  predisBrandId: string,
  postId: string,
  mediaType: PredisMediaType
): Promise<PredisGeneratedContent | null> {
  const url = new URL("https://brain.predis.ai/predis_api/v1/get_posts/");
  url.searchParams.set("brand_id", predisBrandId);
  url.searchParams.set("media_type", mediaType);
  url.searchParams.set("page_n", "1");
  url.searchParams.set("items_n", "20");

  const res = await fetch(url.toString(), {
    headers: { Authorization: apiKey },
  });
  if (!res.ok) return null;

  const data = (await res.json()) as GetPostsResponse;
  const match = data.posts?.find((p) => p.post_id === postId);
  if (!match?.urls?.length) return null;

  return {
    postId,
    mediaUrls: match.urls.filter(Boolean),
    caption: match.caption,
    mediaType,
  };
}

/**
 * Create branded Predis content and poll get_posts until media URLs appear.
 * Prefer configuring a Predis webhook for production; polling covers Ops Console UX.
 */
export async function generatePredisContent(params: {
  brandId: MarketingBrandId;
  text: string;
  mediaType: PredisMediaType;
  maxWaitMs?: number;
}): Promise<PredisGeneratedContent> {
  const apiKey = resolvePredisApiKey(params.brandId);
  const predisBrandId = resolvePredisBrandId(params.brandId);
  if (!apiKey || !predisBrandId) {
    throw new Error(
      "Predis not configured. Set MARKETING_PREDIS_API_KEY and MARKETING_PREDIS_BRAND_ID."
    );
  }

  const topic = params.text.trim();
  if (topic.length < 20 || topic.split(/\s+/).length < 3) {
    const brand = getBrandProfile(params.brandId);
    const padded = `${topic} ${brand.tagline} ${brand.name} product update`.trim();
    params = { ...params, text: padded };
  }

  const { postId } = await createPredisContent({
    apiKey,
    brandId: predisBrandId,
    text: params.text,
    mediaType: params.mediaType,
  });

  const maxWait = params.maxWaitMs ?? 120_000;
  const started = Date.now();
  let delay = 3000;

  while (Date.now() - started < maxWait) {
    await sleep(delay);
    const ready = await fetchPredisPost(apiKey, predisBrandId, postId, params.mediaType);
    if (ready?.mediaUrls.length) return ready;
    delay = Math.min(delay + 2000, 10_000);
  }

  throw new Error(
    `Predis post ${postId} still generating after ${Math.round(maxWait / 1000)}s. ` +
      "Configure a Predis webhook or retry Creative in a minute."
  );
}
