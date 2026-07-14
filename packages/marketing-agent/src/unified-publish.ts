import type { MarketingChannelId, PublishPayload, PublishResult } from "./types";

/** Channels Buffer / Zernio can target (env maps channel → channelId / accountId). */
export const UNIFIED_SOCIAL_CHANNELS: MarketingChannelId[] = [
  "linkedin",
  "instagram",
  "facebook",
  "tiktok",
  "reddit",
  "x",
  "threads",
  "youtube",
];

export function isUnifiedSocialChannel(channel: MarketingChannelId): boolean {
  return UNIFIED_SOCIAL_CHANNELS.includes(channel);
}

export type UnifiedPublishProvider = "buffer" | "zernio";

function env(key: string): string | undefined {
  const v = process.env[key]?.trim();
  return v || undefined;
}

function brandEnv(brandId: string, suffix: string): string | undefined {
  return env(`MARKETING_${brandId.toUpperCase()}_${suffix}`);
}

export function resolveBufferApiKey(brandId: string): string | undefined {
  return brandEnv(brandId, "BUFFER_API_KEY") ?? env("MARKETING_BUFFER_API_KEY");
}

export function resolveZernioApiKey(brandId: string): string | undefined {
  return brandEnv(brandId, "ZERNIO_API_KEY") ?? env("MARKETING_ZERNIO_API_KEY");
}

/** Buffer GraphQL channel id for this brand + Motivelife channel. */
export function resolveBufferChannelId(
  brandId: string,
  channel: MarketingChannelId
): string | undefined {
  const suffix = `BUFFER_CHANNEL_${channel.toUpperCase()}`;
  return brandEnv(brandId, suffix) ?? env(`MARKETING_${suffix}`);
}

/** Zernio account id for this brand + channel. */
export function resolveZernioAccountId(
  brandId: string,
  channel: MarketingChannelId
): string | undefined {
  const suffix = `ZERNIO_ACCOUNT_${channel.toUpperCase()}`;
  return brandEnv(brandId, suffix) ?? env(`MARKETING_${suffix}`);
}

export function isBufferConfigured(brandId: string, channel?: MarketingChannelId): boolean {
  const key = resolveBufferApiKey(brandId);
  if (!key) return false;
  if (!channel) return true;
  return Boolean(resolveBufferChannelId(brandId, channel));
}

export function isZernioConfigured(brandId: string, channel?: MarketingChannelId): boolean {
  const key = resolveZernioApiKey(brandId);
  if (!key) return false;
  if (!channel) return true;
  return Boolean(resolveZernioAccountId(brandId, channel));
}

export function isUnifiedPublishConfigured(
  brandId: string,
  channel?: MarketingChannelId
): boolean {
  return isBufferConfigured(brandId, channel) || isZernioConfigured(brandId, channel);
}

/**
 * Prefer MARKETING_PUBLISH_PROVIDER=buffer|zernio, else Buffer if ready, else Zernio.
 */
export function pickUnifiedProvider(
  brandId: string,
  channel: MarketingChannelId
): UnifiedPublishProvider | null {
  const prefer = (env("MARKETING_PUBLISH_PROVIDER") ?? "auto").toLowerCase();
  const bufferOk = isBufferConfigured(brandId, channel);
  const zernioOk = isZernioConfigured(brandId, channel);

  if (prefer === "buffer" && bufferOk) return "buffer";
  if (prefer === "zernio" && zernioOk) return "zernio";
  if (bufferOk) return "buffer";
  if (zernioOk) return "zernio";
  return null;
}

type BufferCreateResult = {
  data?: {
    createPost?: {
      post?: { id?: string };
      message?: string;
    };
  };
  errors?: Array<{ message?: string }>;
};

/** Map Motivelife channel → Zernio platform string */
export function channelToZernioPlatform(channel: MarketingChannelId): string | null {
  switch (channel) {
    case "x":
      return "twitter";
    case "linkedin":
    case "instagram":
    case "facebook":
    case "tiktok":
    case "reddit":
    case "threads":
    case "youtube":
      return channel;
    default:
      return null;
  }
}

export async function publishViaBuffer(
  payload: PublishPayload,
  manualText: string
): Promise<PublishResult> {
  const apiKey = resolveBufferApiKey(payload.brandId);
  const channelId = resolveBufferChannelId(payload.brandId, payload.channel);
  if (!apiKey || !channelId) {
    return {
      ok: false,
      error: `Buffer not configured for ${payload.channel}. Set MARKETING_BUFFER_API_KEY + MARKETING_BUFFER_CHANNEL_${payload.channel.toUpperCase()}.`,
      mode: "manual",
      manualText,
    };
  }

  const scheduled = Boolean(payload.scheduleDate?.trim());
  const input: Record<string, unknown> = {
    text: manualText,
    channelId,
    schedulingType: "automatic",
    mode: scheduled ? "customScheduled" : "shareNow",
    assets: [],
  };
  if (scheduled) {
    input.dueAt = payload.scheduleDate!.trim();
  }

  // Optional photo via public URL (Buffer asset from URL when supported)
  if (payload.mediaUrl?.startsWith("http") && payload.mediaType !== "video") {
    input.assets = [{ url: payload.mediaUrl, mimeType: "image/jpeg" }];
  }

  const mutation = `
    mutation CreatePost($input: CreatePostInput!) {
      createPost(input: $input) {
        ... on PostActionSuccess {
          post { id text status }
        }
        ... on MutationError {
          message
        }
      }
    }
  `;

  const res = await fetch("https://api.buffer.com", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query: mutation,
      variables: { input },
    }),
  });

  const raw = await res.text();
  let parsed: BufferCreateResult = {};
  try {
    parsed = JSON.parse(raw) as BufferCreateResult;
  } catch {
    return {
      ok: false,
      error: `Buffer publish failed (${res.status}): ${raw.slice(0, 400)}`,
      mode: "manual",
      manualText,
    };
  }

  if (parsed.errors?.length) {
    return {
      ok: false,
      error: parsed.errors.map((e) => e.message).filter(Boolean).join("; ") || "Buffer GraphQL error",
      mode: "manual",
      manualText,
    };
  }

  const create = parsed.data?.createPost;
  if (create?.message && !create.post?.id) {
    // shareNow may not exist on all plans — retry addToQueue
    if (!scheduled && /shareNow|ShareMode|mode/i.test(create.message)) {
      return publishViaBufferQueueFallback(apiKey, channelId, manualText, payload);
    }
    return { ok: false, error: create.message, mode: "manual", manualText };
  }

  const id = create?.post?.id;
  if (!id) {
    return {
      ok: false,
      error: "Buffer did not return a post id",
      mode: "manual",
      manualText,
    };
  }
  return { ok: true, externalId: id, mode: "api" };
}

async function publishViaBufferQueueFallback(
  apiKey: string,
  channelId: string,
  manualText: string,
  payload: PublishPayload
): Promise<PublishResult> {
  const input: Record<string, unknown> = {
    text: manualText,
    channelId,
    schedulingType: "automatic",
    mode: "addToQueue",
    assets: [],
  };
  if (payload.mediaUrl?.startsWith("http") && payload.mediaType !== "video") {
    input.assets = [{ url: payload.mediaUrl, mimeType: "image/jpeg" }];
  }

  const mutation = `
    mutation CreatePost($input: CreatePostInput!) {
      createPost(input: $input) {
        ... on PostActionSuccess { post { id } }
        ... on MutationError { message }
      }
    }
  `;

  const res = await fetch("https://api.buffer.com", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ query: mutation, variables: { input } }),
  });

  const data = (await res.json()) as BufferCreateResult;
  const id = data.data?.createPost?.post?.id;
  if (id) return { ok: true, externalId: id, mode: "api" };
  const msg = data.data?.createPost?.message || data.errors?.[0]?.message || "Buffer queue failed";
  return { ok: false, error: msg, mode: "manual", manualText };
}

export async function publishViaZernio(
  payload: PublishPayload,
  manualText: string
): Promise<PublishResult> {
  const apiKey = resolveZernioApiKey(payload.brandId);
  const accountId = resolveZernioAccountId(payload.brandId, payload.channel);
  const platform = channelToZernioPlatform(payload.channel);
  if (!apiKey || !accountId || !platform) {
    return {
      ok: false,
      error: `Zernio not configured for ${payload.channel}. Set MARKETING_ZERNIO_API_KEY + MARKETING_ZERNIO_ACCOUNT_${payload.channel.toUpperCase()}.`,
      mode: "manual",
      manualText,
    };
  }

  const body: Record<string, unknown> = {
    content: manualText,
    platforms: [{ platform, accountId }],
  };

  if (payload.scheduleDate?.trim()) {
    body.scheduledFor = payload.scheduleDate.trim();
    body.timezone = env("MARKETING_ZERNIO_TIMEZONE") || "America/New_York";
  } else {
    body.publishNow = true;
  }

  if (payload.mediaUrl?.startsWith("http")) {
    body.mediaUrls = [payload.mediaUrl];
  }

  if (payload.channel === "reddit" && payload.title?.trim()) {
    body.title = payload.title.trim().slice(0, 300);
  }

  const res = await fetch("https://zernio.com/api/v1/posts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  const raw = await res.text();
  let data: { post?: { _id?: string; id?: string }; error?: string; message?: string } = {};
  try {
    data = JSON.parse(raw) as typeof data;
  } catch {
    return {
      ok: false,
      error: `Zernio publish failed (${res.status}): ${raw.slice(0, 400)}`,
      mode: "manual",
      manualText,
    };
  }

  if (!res.ok) {
    return {
      ok: false,
      error: data.message || data.error || raw.slice(0, 400),
      mode: "manual",
      manualText,
    };
  }

  const externalId = data.post?._id || data.post?.id || "zernio-post";
  return { ok: true, externalId: String(externalId), mode: "api" };
}

export async function publishViaUnified(
  payload: PublishPayload,
  manualText: string
): Promise<PublishResult | null> {
  const provider = pickUnifiedProvider(payload.brandId, payload.channel);
  if (!provider) return null;
  if (provider === "buffer") return publishViaBuffer(payload, manualText);
  return publishViaZernio(payload, manualText);
}
