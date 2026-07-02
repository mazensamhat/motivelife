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
  if (lower.includes("publish_actions")) {
    return "Meta rejected publish_actions (deprecated). Use a System User token, set MARKETING_META_PAGE_ID to your Page ID (not the system user ID), and redeploy — the app now exchanges for a Page token automatically.";
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
  if (e instanceof TypeError && /failed to fetch|networkerror|load failed/i.test(e.message)) {
    if (context === "creative") {
      return "Request timed out — 30s video can take up to 5 minutes. Keep this tab open and try again, or use 5s video first.";
    }
    return "Request timed out generating drafts. Try fewer channels or disable auto-media, then retry.";
  }
  return e instanceof Error ? e.message : context === "creative" ? "Creative generation failed" : "Generate failed";
}
