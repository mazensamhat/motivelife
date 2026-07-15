import { prisma, MarketingPostStatus, type Prisma } from "@forward/database";
import {
  fetchYouTubeVideoStatistics,
  getBrandPublisherConfig,
  resolveMetaPageAccessToken,
  type MarketingBrandId,
} from "@forward/marketing-agent";
import { publishedPermalink } from "@/lib/marketing-attribution";

async function fetchMetaInsights(
  brandId: MarketingBrandId,
  channel: "instagram" | "facebook",
  externalPostId: string
): Promise<{ impressions: number; engagements: number; clicks: number | null } | null> {
  const cfg = getBrandPublisherConfig(brandId);
  const token = cfg.metaAccessToken?.trim();
  const pageId = cfg.metaPageId?.trim();
  if (!token || !externalPostId.trim()) return null;

  try {
    const pageAuth = pageId
      ? await resolveMetaPageAccessToken(token, pageId, {
          fallbackToken: process.env.MARKETING_META_ACCESS_TOKEN?.trim(),
        })
      : { ok: true as const, pageToken: token };

    if (!pageAuth.ok) return null;
    const accessToken = pageAuth.pageToken;

    if (channel === "instagram") {
      const fields =
        "impressions,reach,likes,comments,saved,shares,plays,total_interactions";
      const url = `https://graph.facebook.com/v21.0/${encodeURIComponent(externalPostId)}/insights?metric=${fields}&access_token=${encodeURIComponent(accessToken)}`;
      const res = await fetch(url);
      if (!res.ok) {
        // Fallback: media object fields (limited but often available)
        const mediaRes = await fetch(
          `https://graph.facebook.com/v21.0/${encodeURIComponent(externalPostId)}?fields=like_count,comments_count,permalink&access_token=${encodeURIComponent(accessToken)}`
        );
        if (!mediaRes.ok) return null;
        const media = (await mediaRes.json()) as {
          like_count?: number;
          comments_count?: number;
          permalink?: string;
        };
        return {
          impressions: 0,
          engagements: (media.like_count ?? 0) + (media.comments_count ?? 0),
          clicks: null,
        };
      }
      const data = (await res.json()) as {
        data?: { name?: string; values?: { value?: number }[] }[];
      };
      const byName = new Map(
        (data.data ?? []).map((m) => [m.name ?? "", Number(m.values?.[0]?.value ?? 0) || 0])
      );
      const impressions = byName.get("impressions") || byName.get("reach") || byName.get("plays") || 0;
      const engagements =
        byName.get("total_interactions") ||
        (byName.get("likes") ?? 0) +
          (byName.get("comments") ?? 0) +
          (byName.get("saved") ?? 0) +
          (byName.get("shares") ?? 0);
      return { impressions, engagements, clicks: null };
    }

    // Facebook Page post
    const url = `https://graph.facebook.com/v21.0/${encodeURIComponent(externalPostId)}?fields=insights.metric(post_impressions,post_engaged_users,post_clicks),permalink_url&access_token=${encodeURIComponent(accessToken)}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      insights?: { data?: { name?: string; values?: { value?: number }[] }[] };
      permalink_url?: string;
    };
    const byName = new Map(
      (data.insights?.data ?? []).map((m) => [
        m.name ?? "",
        Number(m.values?.[0]?.value ?? 0) || 0,
      ])
    );
    return {
      impressions: byName.get("post_impressions") ?? 0,
      engagements: byName.get("post_engaged_users") ?? 0,
      clicks: byName.get("post_clicks") ?? null,
    };
  } catch (error) {
    console.warn(`[marketing/metrics] Meta ${channel} failed`, error);
    return null;
  }
}

export async function syncMarketingPostMetrics(postIds?: string[]) {
  const where: Prisma.MarketingPostWhereInput = {
    status: { in: [MarketingPostStatus.published, MarketingPostStatus.scheduled] },
    externalPostId: { not: null },
    ...(postIds?.length ? { id: { in: postIds } } : {}),
  };

  const posts = await prisma.marketingPost.findMany({
    where,
    orderBy: { publishedAt: "desc" },
    take: postIds?.length ? postIds.length : 40,
    select: {
      id: true,
      brand: true,
      channel: true,
      externalPostId: true,
      publishedUrl: true,
    },
  });

  let updated = 0;
  const errors: string[] = [];

  for (const post of posts) {
    const externalId = post.externalPostId?.trim();
    if (!externalId) continue;
    const brandId = post.brand as MarketingBrandId;

    try {
      let impressions: number | null = null;
      let engagements: number | null = null;
      let clicks: number | null = null;
      let publishedUrl = post.publishedUrl;

      if (post.channel === "youtube") {
        const stats = await fetchYouTubeVideoStatistics(brandId, externalId);
        if (!stats) {
          errors.push(`${post.id}: YouTube stats unavailable`);
          continue;
        }
        impressions = stats.views;
        engagements = stats.likes + stats.comments;
        publishedUrl = publishedUrl || publishedPermalink("youtube", externalId);
      } else if (post.channel === "instagram" || post.channel === "facebook") {
        const stats = await fetchMetaInsights(brandId, post.channel, externalId);
        if (!stats) {
          errors.push(`${post.id}: Meta insights unavailable (check token scopes)`);
          continue;
        }
        impressions = stats.impressions;
        engagements = stats.engagements;
        clicks = stats.clicks;
        publishedUrl = publishedUrl || publishedPermalink(post.channel, externalId);
      } else {
        continue;
      }

      await prisma.marketingPost.update({
        where: { id: post.id },
        data: {
          metricImpressions: impressions,
          metricEngagements: engagements,
          metricClicks: clicks,
          metricsSyncedAt: new Date(),
          ...(publishedUrl ? { publishedUrl } : {}),
        },
      });
      updated += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "sync failed";
      errors.push(`${post.id}: ${message.slice(0, 120)}`);
    }
  }

  return { updated, scanned: posts.length, errors };
}
