/** Turn raw Meta/LinkedIn API errors into actionable admin messages. */
export function formatMarketingPublishError(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;

  let message = raw.trim();

  try {
    const parsed = JSON.parse(message) as { error?: { message?: string; code?: number } };
    if (parsed.error?.message) message = parsed.error.message;
  } catch {
    /* not JSON */
  }

  const lower = message.toLowerCase();
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
  if (lower.includes("input_file") || lower.includes("convert_input_to_mp4")) {
    return "GIF→MP4 converter misconfigured — redeploy latest code, then retry 5s video.";
  }
  if (lower.includes("blob") || lower.includes("upload")) {
    return "Could not upload files for video merge. Check BLOB_READ_WRITE_TOKEN in Vercel.";
  }

  return message.length > 160 ? `${message.slice(0, 157)}…` : message;
}

export function buildPartialVideoNote(durationSec: number, muxError: string): string {
  const clip = durationSec >= 20 ? "30s animation" : "Animation";
  return `${clip} and AI voiceover are ready — MP4 merge didn’t finish (${formatMuxError(muxError)}). Play voiceover below, wait a minute, then click 5s video again.`;
}
