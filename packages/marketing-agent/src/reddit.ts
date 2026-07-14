import type { PublishPayload, PublishResult } from "./types";

export type RedditAuthConfig = {
  clientId: string;
  clientSecret: string;
  username: string;
  /** Script-app password grant (personal bot). Prefer refreshToken in production. */
  password?: string;
  /** Web-app permanent refresh token. */
  refreshToken?: string;
  userAgent: string;
  subreddit: string;
};

type TokenCache = { accessToken: string; expiresAt: number; key: string };

let tokenCache: TokenCache | null = null;

function truncate(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trim()}…`;
}

function normalizeSubreddit(raw: string): string {
  return raw
    .trim()
    .replace(/^\/?(r|u)\//i, "")
    .replace(/^u_/i, "u_");
}

/** Reddit post title: prefer payload.title, else first line / truncated body. */
export function resolveRedditTitle(payload: PublishPayload): string {
  const explicit = payload.title?.trim();
  if (explicit) return truncate(explicit, 300);

  const lines = payload.body
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  const first = lines[0] ?? "";
  if (first.length >= 8 && first.length <= 300 && !/^https?:\/\//i.test(first)) {
    return first;
  }

  const flat = payload.body.replace(/\s+/g, " ").trim();
  return truncate(flat || "Update", 300);
}

function resolveRedditText(payload: PublishPayload, title: string): string {
  const tags = payload.hashtags?.length
    ? `\n\n${payload.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")}`
    : "";
  const link = payload.ctaUrl ? `\n\n${payload.ctaUrl}` : "";
  let body = payload.body.trim();

  // Avoid duplicating the title as the first line of a self post.
  const firstLine = body.split(/\n/)[0]?.trim() ?? "";
  if (firstLine && firstLine === title) {
    body = body.slice(firstLine.length).replace(/^\n+/, "").trim();
  }

  return `${body}${tags}${link}`.trim();
}

function authCacheKey(cfg: RedditAuthConfig): string {
  return `${cfg.clientId}:${cfg.username}:${cfg.refreshToken ? "rt" : "pw"}`;
}

async function fetchAccessToken(cfg: RedditAuthConfig): Promise<string> {
  const key = authCacheKey(cfg);
  if (tokenCache && tokenCache.key === key && Date.now() < tokenCache.expiresAt - 60_000) {
    return tokenCache.accessToken;
  }

  const basic = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString("base64");
  const body = new URLSearchParams();

  if (cfg.refreshToken?.trim()) {
    body.set("grant_type", "refresh_token");
    body.set("refresh_token", cfg.refreshToken.trim());
  } else if (cfg.password?.trim()) {
    body.set("grant_type", "password");
    body.set("username", cfg.username);
    body.set("password", cfg.password.trim());
  } else {
    throw new Error(
      "Reddit auth needs MARKETING_REDDIT_REFRESH_TOKEN or MARKETING_REDDIT_PASSWORD"
    );
  }

  const res = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": cfg.userAgent,
    },
    body,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Reddit token failed (${res.status}): ${err.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (!data.access_token) {
    throw new Error(
      data.error_description || data.error || "Reddit token response missing access_token"
    );
  }

  const expiresIn = typeof data.expires_in === "number" ? data.expires_in : 3600;
  tokenCache = {
    accessToken: data.access_token,
    expiresAt: Date.now() + expiresIn * 1000,
    key,
  };
  return data.access_token;
}

type RedditSubmitJson = {
  json?: {
    errors?: Array<[string, string, string?]>;
    data?: {
      id?: string;
      name?: string;
      url?: string;
    };
  };
};

async function submitRedditPost(
  cfg: RedditAuthConfig,
  token: string,
  params: Record<string, string>
): Promise<{ externalId: string; url?: string }> {
  const body = new URLSearchParams({
    api_type: "json",
    resubmit: "true",
    sendreplies: "true",
    ...params,
  });

  const res = await fetch("https://oauth.reddit.com/api/submit", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": cfg.userAgent,
    },
    body,
  });

  const raw = await res.text();
  let parsed: RedditSubmitJson = {};
  try {
    parsed = JSON.parse(raw) as RedditSubmitJson;
  } catch {
    throw new Error(`Reddit submit failed (${res.status}): ${raw.slice(0, 400)}`);
  }

  const errors = parsed.json?.errors ?? [];
  if (errors.length > 0) {
    const msg = errors.map((e) => e.slice(0, 2).join(": ")).join("; ");
    throw new Error(msg || "Reddit submit rejected the post");
  }

  if (!res.ok) {
    throw new Error(`Reddit submit failed (${res.status}): ${raw.slice(0, 400)}`);
  }

  const data = parsed.json?.data;
  const externalId = data?.name ?? data?.id ?? "reddit-post";
  return { externalId, url: data?.url };
}

/**
 * Publish a Reddit self post (or link post when mediaUrl is a public http URL and body is empty-ish).
 * Default: text (self) post to MARKETING_REDDIT_SUBREDDIT.
 */
export async function publishReddit(
  payload: PublishPayload,
  cfg: RedditAuthConfig,
  manualText: string
): Promise<PublishResult> {
  const sr = normalizeSubreddit(cfg.subreddit);
  if (!sr) {
    return {
      ok: false,
      error: "MARKETING_REDDIT_SUBREDDIT is required (e.g. test or u_yourusername).",
      mode: "manual",
      manualText,
    };
  }

  if (payload.mediaType === "video" || payload.mediaType === "gif") {
    return {
      ok: false,
      error:
        "Reddit video/GIF auto-post is not enabled yet — publish as text, or Copy and upload media manually.",
      mode: "manual",
      manualText,
    };
  }

  try {
    const token = await fetchAccessToken(cfg);
    const title = resolveRedditTitle(payload);
    const text = resolveRedditText(payload, title);
    const mediaUrl = payload.mediaUrl?.trim();

    // Public image URL → link post (image hosts / CDN). Otherwise self (text) post.
    const useLink =
      Boolean(mediaUrl?.startsWith("http")) &&
      (payload.mediaType === "image" || (!payload.mediaType && /\.(png|jpe?g|gif|webp)(\?|$)/i.test(mediaUrl!)));

    const result = useLink
      ? await submitRedditPost(cfg, token, {
          kind: "link",
          sr,
          title,
          url: mediaUrl!,
        })
      : await submitRedditPost(cfg, token, {
          kind: "self",
          sr,
          title,
          text: text || manualText,
        });

    return { ok: true, externalId: result.externalId, mode: "api" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Reddit publish failed";
    return { ok: false, error: message, mode: "manual", manualText };
  }
}
