/** Canonical public site URL for SEO, emails, and OAuth. */
export function getSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (raw?.startsWith("http")) return raw.replace(/\/$/, "");
  return "https://www.mymotivelife.com";
}
