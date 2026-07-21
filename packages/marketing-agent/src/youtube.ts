import type { MarketingBrandId, PublishPayload, PublishResult } from "./types";

const YOUTUBE_UPLOAD_URL =
  "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

/**
 * Prefer per-brand YouTube OAuth client so each channel's refresh token can
 * match the Google Cloud client that issued it (avoids unauthorized_client).
 *
 * MotiveLife and MotiveFX MUST use separate refresh tokens
 * (`MARKETING_MOTIVELIFE_YOUTUBE_REFRESH_TOKEN` vs `MARKETING_MOTIVEFX_…`).
 * Do not reuse one brand's token for the other.
 */
export function resolveYouTubeOAuthClient(brandId?: MarketingBrandId): {
  clientId: string;
  clientSecret: string;
} | null {
  const prefix = brandId ? `MARKETING_${brandId.toUpperCase()}_YOUTUBE` : null;
  const clientId =
    (prefix ? process.env[`${prefix}_CLIENT_ID`]?.trim() : undefined) ||
    process.env.MARKETING_YOUTUBE_CLIENT_ID?.trim() ||
    process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret =
    (prefix ? process.env[`${prefix}_CLIENT_SECRET`]?.trim() : undefined) ||
    process.env.MARKETING_YOUTUBE_CLIENT_SECRET?.trim() ||
    process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

/** Per-brand only — never fall back to a shared token (avoids Life↔FX mix-ups). */
export function resolveYouTubeRefreshToken(brandId: MarketingBrandId): string | undefined {
  return process.env[`MARKETING_${brandId.toUpperCase()}_YOUTUBE_REFRESH_TOKEN`]?.trim() || undefined;
}

/** Per-brand only — never fall back to a shared channel id. */
export function resolveYouTubeChannelId(brandId: MarketingBrandId): string | undefined {
  return process.env[`MARKETING_${brandId.toUpperCase()}_YOUTUBE_CHANNEL_ID`]?.trim() || undefined;
}


export function isNativeYouTubeConfigured(brandId: MarketingBrandId): boolean {
  return Boolean(
    resolveYouTubeOAuthClient(brandId) &&
      resolveYouTubeRefreshToken(brandId) &&
      resolveYouTubeChannelId(brandId)
  );
}

export function missingYouTubeEnv(brandId: MarketingBrandId): string {
  const prefix = `MARKETING_${brandId.toUpperCase()}`;
  return (
    `${prefix}_YOUTUBE_REFRESH_TOKEN + ${prefix}_YOUTUBE_CHANNEL_ID ` +
    `+ MARKETING_YOUTUBE_CLIENT_ID/SECRET or GOOGLE_CLIENT_* ` +
    `(per-brand token required — do not reuse MotiveLife↔MotiveFX refresh tokens)`
  );
}

async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<string> {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const err = await res.text();
    const lower = err.toLowerCase();
    let hint = "";
    if (lower.includes("client secret is invalid") || (lower.includes("invalid_client") && lower.includes("secret"))) {
      hint =
        " — MARKETING_YOUTUBE_CLIENT_SECRET / GOOGLE_CLIENT_SECRET does not match this client_id. Update both to the secret from Google Cloud → Clients (delete stale MARKETING_*_YOUTUBE_CLIENT_SECRET overrides), then redeploy.";
    } else if (lower.includes("unauthorized_client") || lower.includes("invalid_grant")) {
      hint =
        " — refresh token must be issued by the same OAuth client_id. Re-run youtube-oauth.mjs for THIS brand (motivelife vs motivefx) with the same MARKETING_YOUTUBE_CLIENT_* / GOOGLE_CLIENT_* as Vercel. Do not paste MotiveFX's refresh token into MARKETING_MOTIVELIFE_YOUTUBE_REFRESH_TOKEN (or vice versa).";
    } else if (lower.includes("invalid_client")) {
      hint =
        " — OAuth client_id not found. Update MARKETING_YOUTUBE_CLIENT_ID / GOOGLE_CLIENT_ID to your current Google Web client and redeploy.";
    }
    throw new Error(`YouTube OAuth refresh failed: ${err.slice(0, 300)}${hint}`);
  }

  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) {
    throw new Error("YouTube OAuth refresh returned no access_token.");
  }
  return data.access_token;
}

function asShorts(payload: PublishPayload): boolean {
  const fmt = payload.publishFormat?.trim().toLowerCase();
  return !fmt || fmt === "shorts" || fmt === "short";
}

function buildVideoTitle(payload: PublishPayload): string {
  const raw = (payload.title?.trim() || payload.body.trim().split("\n")[0] || "Motive video").trim();
  let title = raw.replace(/\s+/g, " ").slice(0, 90);
  if (asShorts(payload) && !/#shorts/i.test(title)) {
    const withTag = `${title} #Shorts`;
    title = withTag.length <= 100 ? withTag : `${title.slice(0, 92)} #Shorts`;
  }
  if (!asShorts(payload)) {
    title = title.replace(/\s*#shorts\b/gi, "").trim();
  }
  return title.slice(0, 100);
}

function buildVideoDescription(payload: PublishPayload, manualText: string): string {
  const base = manualText.trim() || payload.body.trim();
  if (!asShorts(payload)) {
    return base.replace(/\n\n#Shorts\b/gi, "").replace(/#shorts\b/gi, "").trim().slice(0, 4900);
  }
  const withTag = /#shorts/i.test(base) ? base : `${base}\n\n#Shorts`;
  return withTag.slice(0, 4900);
}

function privacyStatus(payload: PublishPayload): "public" | "unlisted" | "private" {
  const fromPost = payload.publishPrivacy?.trim().toLowerCase();
  if (fromPost === "unlisted" || fromPost === "private" || fromPost === "public") return fromPost;
  const raw = process.env.MARKETING_YOUTUBE_PRIVACY?.trim()?.toLowerCase();
  if (raw === "unlisted" || raw === "private" || raw === "public") return raw;
  return "public";
}

function categoryId(): string {
  return process.env.MARKETING_YOUTUBE_CATEGORY_ID?.trim() || "22";
}

async function fetchVideoBuffer(url: string): Promise<{ buffer: Buffer; contentType: string }> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Could not fetch video for YouTube (${res.status}).`);
  }
  const contentType = res.headers.get("content-type") ?? "video/mp4";
  return { buffer: Buffer.from(await res.arrayBuffer()), contentType };
}

async function resumableUpload(
  accessToken: string,
  buffer: Buffer,
  contentType: string,
  snippet: { title: string; description: string; categoryId: string; tags?: string[] },
  privacy: "public" | "unlisted" | "private"
): Promise<string> {
  const initRes = await fetch(YOUTUBE_UPLOAD_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Length": String(buffer.byteLength),
      "X-Upload-Content-Type": contentType.split(";")[0]?.trim() || "video/mp4",
    },
    body: JSON.stringify({
      snippet: {
        title: snippet.title,
        description: snippet.description,
        categoryId: snippet.categoryId,
        tags: snippet.tags?.slice(0, 15),
      },
      status: {
        privacyStatus: privacy,
        selfDeclaredMadeForKids: false,
      },
    }),
  });

  if (!initRes.ok) {
    const err = await initRes.text();
    throw new Error(`YouTube upload init failed: ${err.slice(0, 400)}`);
  }

  const uploadUrl = initRes.headers.get("location");
  if (!uploadUrl) {
    throw new Error("YouTube upload init missing Location header.");
  }

  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": contentType.split(";")[0]?.trim() || "video/mp4",
      "Content-Length": String(buffer.byteLength),
    },
    body: new Uint8Array(buffer),
  });

  if (!uploadRes.ok) {
    const err = await uploadRes.text();
    throw new Error(`YouTube video upload failed: ${err.slice(0, 400)}`);
  }

  const data = (await uploadRes.json()) as { id?: string };
  if (!data.id) {
    throw new Error("YouTube upload returned no video id.");
  }
  return data.id;
}

/** Upload a Short (9:16 MP4) via YouTube Data API v3 resumable upload. */
export async function publishYouTube(
  payload: PublishPayload,
  manualText: string
): Promise<PublishResult> {
  const oauth = resolveYouTubeOAuthClient(payload.brandId);
  const refreshToken = resolveYouTubeRefreshToken(payload.brandId);
  const channelId = resolveYouTubeChannelId(payload.brandId);

  if (!oauth || !refreshToken || !channelId) {
    return {
      ok: false,
      error: `YouTube API not configured (${missingYouTubeEnv(payload.brandId)}).`,
      mode: "manual",
      manualText,
    };
  }

  const mediaUrl = payload.mediaUrl?.trim();
  if (!mediaUrl || payload.mediaType !== "video") {
    return {
      ok: false,
      error:
        "YouTube uploads need an MP4 — generate 5s / 15s / 30s video on this draft, then Publish.",
      mode: "manual",
      manualText: mediaUrl ? `${manualText}\n\nMedia: ${mediaUrl}` : manualText,
    };
  }

  try {
    const accessToken = await refreshAccessToken(
      refreshToken,
      oauth.clientId,
      oauth.clientSecret
    );
    const { buffer, contentType } = await fetchVideoBuffer(mediaUrl);
    if (buffer.byteLength < 1024) {
      throw new Error("Video file is empty or too small to upload.");
    }

    const tags = (payload.hashtags ?? [])
      .map((h) => h.replace(/^#/, "").trim())
      .filter(Boolean)
      .slice(0, 12);

    const videoId = await resumableUpload(
      accessToken,
      buffer,
      contentType.includes("video") ? contentType : "video/mp4",
      {
        title: buildVideoTitle(payload),
        description: buildVideoDescription(payload, manualText),
        categoryId: categoryId(),
        tags: tags.length ? tags : undefined,
      },
      privacyStatus(payload)
    );

    return {
      ok: true,
      externalId: videoId,
      mode: "api",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "YouTube publish failed";
    return {
      ok: false,
      error: message.slice(0, 500),
      mode: "manual",
      manualText: `${manualText}\n\nMedia: ${mediaUrl}\nChannel: https://www.youtube.com/channel/${channelId}`,
    };
  }
}

export async function fetchYouTubeVideoStatistics(
  brandId: MarketingBrandId,
  videoId: string
): Promise<{ views: number; likes: number; comments: number } | null> {
  const oauth = resolveYouTubeOAuthClient(brandId);
  const refreshToken = resolveYouTubeRefreshToken(brandId);
  if (!oauth || !refreshToken || !videoId.trim()) return null;

  try {
    const accessToken = await refreshAccessToken(
      refreshToken,
      oauth.clientId,
      oauth.clientSecret
    );
    const url = new URL("https://www.googleapis.com/youtube/v3/videos");
    url.searchParams.set("part", "statistics");
    url.searchParams.set("id", videoId.trim());
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      items?: { statistics?: { viewCount?: string; likeCount?: string; commentCount?: string } }[];
    };
    const stats = data.items?.[0]?.statistics;
    if (!stats) return null;
    return {
      views: Number(stats.viewCount ?? 0) || 0,
      likes: Number(stats.likeCount ?? 0) || 0,
      comments: Number(stats.commentCount ?? 0) || 0,
    };
  } catch (error) {
    console.warn("[youtube/stats]", error);
    return null;
  }
}
