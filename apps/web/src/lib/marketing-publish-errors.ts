/**
 * Turn raw publisher API errors into actionable admin messages.
 * Pass `channel` when known so shared OAuth codes (e.g. invalid_grant) are not
 * mislabeled — YouTube/Google and Reddit both use that error string.
 */
export function formatMarketingPublishError(
  raw: string | null | undefined,
  channel?: string | null
): string | null {
  if (!raw?.trim()) return null;

  let message = raw.trim();

  try {
    const parsed = JSON.parse(message) as { error?: { message?: string; code?: number } };
    if (parsed.error?.message) message = parsed.error.message;
  } catch {
    /* not JSON */
  }

  const lower = message.toLowerCase();
  const ch = (channel ?? "").toLowerCase();
  const mentionsYoutube =
    ch === "youtube" || lower.includes("youtube") || lower.includes("googleapis.com");
  const mentionsReddit = ch === "reddit" || lower.includes("reddit") || lower.includes("subreddit");

  if (mentionsYoutube) {
    if (lower.includes("wrong youtube channel") || lower.includes("token is for")) {
      return message.length > 400 ? `${message.slice(0, 397)}…` : message;
    }
    if (
      lower.includes("client secret is invalid") ||
      (lower.includes("invalid_client") && lower.includes("secret"))
    ) {
      return "YouTube OAuth client secret is wrong in Vercel. Set MARKETING_YOUTUBE_CLIENT_SECRET and GOOGLE_CLIENT_SECRET to the same secret as the Web client that minted the refresh token, delete any MARKETING_*_YOUTUBE_CLIENT_SECRET overrides, and redeploy.";
    }
    if (lower.includes("unauthorized_client") || lower.includes("invalid_grant")) {
      return "YouTube refresh token does not match the OAuth client in Vercel. Re-run packages/marketing-agent/scripts/youtube-oauth.mjs for this brand, paste the new MARKETING_{BRAND}_YOUTUBE_REFRESH_TOKEN, keep MARKETING_YOUTUBE_CLIENT_* in sync, and redeploy.";
    }
    if (lower.includes("invalid_client") || lower.includes("oauth client was not found")) {
      return "YouTube OAuth client_id is missing or deleted. Update MARKETING_YOUTUBE_CLIENT_ID / GOOGLE_CLIENT_ID in Vercel to your current Google Web client and redeploy.";
    }
    if (lower.includes("youtube oauth refresh failed") || lower.includes("youtube uploads need")) {
      return message.length > 280 ? `${message.slice(0, 277)}…` : message;
    }
  }

  if (lower.includes("session has expired") || lower.includes("error validating access token")) {
    return "Meta access token expired. In Meta Business Suite → generate a new Page token, update MARKETING_META_ACCESS_TOKEN in Vercel, and redeploy.";
  }
  if (
    lower.includes("pages_read_engagement") ||
    (lower.includes("(#10)") && lower.includes("endpoint requires"))
  ) {
    return "System User cannot access the MotiveLife Page. In Business Settings → System users → assign Motivelife.ai Page + @motivelife.ai IG (Full control). Set MARKETING_META_BUSINESS_ID=231141370893922 in Vercel, redeploy, or set MARKETING_MOTIVELIFE_META_ACCESS_TOKEN to a Page token from Graph API Explorer.";
  }
  if (lower.includes("publish_actions")) {
    return "Facebook needs a Page access token (not a personal user token). Remove MARKETING_MOTIVELIFE_META_ACCESS_TOKEN if it is a user token, keep MARKETING_META_ACCESS_TOKEN as your System User token, set MARKETING_META_BUSINESS_ID, and redeploy.";
  }
  if (
    lower.includes("media id") &&
    (lower.includes("not available") || lower.includes("is not available"))
  ) {
    return "Instagram is still processing your image/video. Wait 30–60 seconds and click Publish again — the app now polls Meta until the media container is ready.";
  }
  if (lower.includes("media container missing id")) {
    return "Meta did not return a media container ID. Confirm BLOB_READ_WRITE_TOKEN is set, open Public URL to verify the image loads, then retry.";
  }
  if (lower.includes("instagram media still processing")) {
    return message;
  }
  if (
    lower.includes("does not exist") ||
    lower.includes("missing permissions") ||
    lower.includes("unsupported post request")
  ) {
    return "Instagram publish blocked by Meta permissions. In Business Manager: (1) link your IG Business account to the correct Facebook Page for this brand, (2) assign the System User to Page + Instagram assets, (3) enable instagram_content_publish. Set MARKETING_{BRAND}_META_PAGE_ID (or MARKETING_META_PAGE_ID for MotiveLife) — the app reads the IG ID from your Page automatically.";
  }
  if (lower.includes("instagram api needs mp4")) {
    return message;
  }
  if (lower.includes("oauth") && lower.includes("linkedin")) {
    return "LinkedIn token expired or missing scope. Re-authorize with w_organization_social and update Vercel env vars.";
  }
  // Reddit only — do not match bare invalid_grant (YouTube/Google use it too).
  if (
    mentionsReddit &&
    (lower.includes("reddit token") ||
      lower.includes("invalid_grant") ||
      lower.includes("401") ||
      lower.includes("auth failed") ||
      lower.includes("unauthorized"))
  ) {
    return "Reddit auth failed. Check MARKETING_REDDIT_CLIENT_ID/SECRET, USERNAME, and REFRESH_TOKEN (or PASSWORD for script apps), then redeploy.";
  }
  if (mentionsReddit && (lower.includes("ratelimit") || lower.includes("you are doing that too much"))) {
    return "Reddit rate-limited this account. Wait a few minutes and try Publish again.";
  }
  if (lower.includes("subreddit not allowed") || lower.includes("community not found")) {
    return "Reddit subreddit missing or restricted. Set MARKETING_REDDIT_SUBREDDIT to a community you can post in (or u_yourusername for profile).";
  }

  return message.length > 280 ? `${message.slice(0, 277)}…` : message;
}

export function fetchMarketingErrorMessage(e: unknown, context: "generate" | "creative"): string {
  if (e instanceof Error && /body stream already read/i.test(e.message)) {
    return "Browser loaded an old admin script. Hard-refresh this page (Ctrl+Shift+R) and try again.";
  }
  if (
    e instanceof Error &&
    /FUNCTION_INVOCATION_TIMEOUT|timed out|timeout/i.test(e.message)
  ) {
    if (context === "creative") {
      return "Video timed out on the server (up to 5 minutes). Keep this tab open and retry, or try 5s video first.";
    }
    return "Draft generation timed out. Uncheck auto-media, try fewer channels, then add Image/Video per draft.";
  }
  if (e instanceof TypeError && /failed to fetch|networkerror|load failed/i.test(e.message)) {
    if (context === "creative") {
      return "Request timed out — 30s video can take up to 5 minutes. Keep this tab open and try again, or use 5s video first.";
    }
    return "Request timed out generating drafts. Try fewer channels or disable auto-media, then retry.";
  }
  return e instanceof Error ? e.message : context === "creative" ? "Creative generation failed" : "Generate failed";
}

/** Turn raw Replicate mux errors into short admin-friendly copy. */
export function formatMuxError(raw: string): string {
  let message = raw.trim();

  const jsonStart = message.indexOf("{");
  if (jsonStart >= 0) {
    try {
      const parsed = JSON.parse(message.slice(jsonStart)) as { detail?: string; error?: string };
      message = parsed.detail ?? parsed.error ?? message;
    } catch {
      /* keep original */
    }
  }

  message = message
    .replace(/^GIF→MP4 \([^)]+\):\s*/i, "")
    .replace(/^Mux \([^)]+\):\s*/i, "")
    .replace(/^Replicate create failed:\s*/i, "")
    .trim();

  const lower = message.toLowerCase();
  if (lower.includes("throttl") || lower.includes("rate limit")) {
    return "Replicate is busy (rate limit). Wait 1–2 minutes and click 5s video again to merge voice into MP4.";
  }
  if (lower.includes("timed out") || lower.includes("timeout")) {
    return "Video merge timed out. Try again, or combine the animation + voiceover in CapCut.";
  }
  if (lower.includes("input_file") || lower.includes("convert_input_to_mp4") || lower.includes("extensions")) {
    return "GIF→MP4 converter couldn’t read the file URL. Retry 5s video after deploy — mux URLs now include .gif/.mp4.";
  }
  if (lower.includes("blob") || lower.includes("upload")) {
    return "Could not upload files for video merge. Check BLOB_READ_WRITE_TOKEN in Vercel.";
  }

  return message.length > 160 ? `${message.slice(0, 157)}…` : message;
}

export function buildPartialVideoNote(durationSec: number, muxError: string): string {
  const clip =
    durationSec >= 30 ? "30s clip" : durationSec >= 15 ? "15s clip" : "5s clip";
  const retry =
    durationSec >= 30 ? "30s video" : durationSec >= 15 ? "15s video" : "5s video";
  return `${clip} and AI voiceover are ready — MP4 merge didn’t finish (${formatMuxError(muxError)}). Play voiceover below, wait a minute, then click ${retry} again.`;
}
