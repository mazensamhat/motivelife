/** Public domain shown in product copy (no protocol). */
export const SITE_DOMAIN = "mymotivelife.com";

/** Canonical public site URL for SEO, emails, and OAuth. */
export const SITE_URL = `https://www.${SITE_DOMAIN}`;

export function getSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (raw?.startsWith("http")) return raw.replace(/\/$/, "");
  return SITE_URL;
}
