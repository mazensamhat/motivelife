import type { MarketingBrandId, PublishPayload, PublishResult } from "./types";

const YOUTUBE_UPLOAD_URL =
  "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

export function resolveYouTubeOAuthClient(): {
  clientId: string;
  clientSecret: string;
} | null {
  const clientId =
    process.env.MARKETING_YOUTUBE_CLIENT_ID?.trim() ||
    process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret =
    process.env.MARKETING_YOUTUBE_CLIENT_SECRET?.trim() ||
    process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function resolveYouTubeRefreshToken(brandId: MarketingBrandId): string | undefined {
  return (
    process.env[`MARKETING_${brandId.toUpperCase()}_YOUTUBE_REFRESH_TOKEN`]?.trim() ||
    process.env.MARKETING_YOUTUBE_REFRESH_TOKEN?.trim() ||
    undefined
  );
}

export function resolveYouTubeChannelId(brandId: MarketingBrandId): string | undefined {
  return (
    process.env[`MARKETING_${brandId.toUpperCase()}_YOUTUBE_CHANNEL_ID`]?.trim() ||
    process.env.MARKETING_YOUTUBE_CHANNEL_ID?.trim() ||
    undefined
  );
}

export function isNativeYouTubeConfigured(brandId: MarketingBrandId): boolean {
  return Boolean(
    resolveYouTubeOAuthClient() &&
      resolveYouTubeRefreshToken(brandId) &&
      resolveYouTubeChannelId(brandId)
  );
}

export function missingYouTubeEnv(brandId: MarketingBrandId): string {
  const prefix = brandId === "motivelife" ? "MARKETING" : `MARKETING_${brandId.toUpperCase()}`;
  return `${prefix}_YOUTUBE_REFRESH_TOKEN + ${prefix}_YOUTUBE_CHANNEL_ID + MARKETING_YOUTUBE_CLIENT_ID/SECRET (or GOOGLE_CLIENT_*)`;
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
    throw new Error(`YouTube OAuth refresh failed: ${err.slice(0, 300)}`);
  }

  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) {
    throw new Error("YouTube OAuth refresh returned no access_token.");
  }
  return data.access_token;
}

function buildShortTitle(payload: PublishPayload): string {
  const raw = (payload.title?.trim() || payload.body.trim().split("\n")[0] || "Motive Short").trim();
  let title = raw.replace(/\s+/g, " ").slice(0, 90);
  if (!/#shorts/i.test(title)) {
    const withTag = `${title} #Shorts`;
    title = withTag.length <= 100 ? withTag : `${title.slice(0, 92)} #Shorts`;
  }
  return title.slice(0, 100);
}

function buildShortDescription(payload: PublishPayload, manualText: string): string {
  const base = manualText.trim() || payload.body.trim();
  const withTag = /#shorts/i.test(base) ? base : `${base}\n\n#Shorts`;
  return withTag.slice(0, 4900);
}

function privacyStatus(): "public" | "unlisted" | "private" {
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
  const oauth = resolveYouTubeOAuthClient();
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
        "YouTube Shorts need an MP4 — generate 5s video on this draft, then Publish.",
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
        title: buildShortTitle(payload),
        description: buildShortDescription(payload, manualText),
        categoryId: categoryId(),
        tags: tags.length ? tags : undefined,
      },
      privacyStatus()
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
