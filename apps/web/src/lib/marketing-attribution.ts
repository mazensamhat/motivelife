import { getSiteUrl } from "@/lib/site-url";
import {
  buildMarketingHopPath,
  buildTrackingUrl,
  type MarketingBrandId,
} from "@forward/marketing-agent";

export const ML_ACQ_POST_COOKIE = "ml_acq_post";

export function marketingHopUrl(postId: string): string {
  return `${getSiteUrl()}${buildMarketingHopPath(postId)}`;
}

export function marketingDestinationUrl(
  brandId: MarketingBrandId,
  channel: string,
  postId: string
): string {
  return buildTrackingUrl(brandId, channel, postId);
}

/** Resolve permalink after a successful native/API publish. */
export function publishedPermalink(
  channel: string | null | undefined,
  externalId: string | null | undefined
): string | null {
  if (!externalId?.trim()) return null;
  const id = externalId.trim();
  switch (channel) {
    case "youtube":
      return `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`;
    case "facebook":
      return id.includes("http") ? id : `https://www.facebook.com/${id}`;
    case "instagram":
      return id.includes("http") ? id : `https://www.instagram.com/p/${id}/`;
    case "linkedin":
      return id.includes("http") ? id : null;
    default:
      return id.startsWith("http") ? id : null;
  }
}
