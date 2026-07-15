import { z } from "zod";
import { prisma } from "@forward/database";
import { requireAdmin } from "@/lib/admin";
import { badRequest, forbidden, json, serverError, unauthorized } from "@/lib/api";

const querySchema = z.object({
  brand: z.enum(["motivelife", "motivefx", "motiveiq", "motivepulse", "all"]).optional(),
  channel: z
    .enum([
      "linkedin",
      "instagram",
      "facebook",
      "tiktok",
      "reddit",
      "x",
      "threads",
      "youtube",
      "all",
    ])
    .optional(),
  status: z.enum(["published", "scheduled", "draft", "all"]).optional(),
  days: z.coerce.number().int().min(1).max(365).optional(),
});

export async function GET(request: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) {
      if (auth.status === 401) return unauthorized(auth.error);
      return forbidden(auth.error);
    }

    const url = new URL(request.url);
    const parsed = querySchema.safeParse({
      brand: url.searchParams.get("brand") ?? undefined,
      channel: url.searchParams.get("channel") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      days: url.searchParams.get("days") ?? undefined,
    });
    if (!parsed.success) return badRequest("Invalid performance filters.");

    const brand = parsed.data.brand ?? "all";
    const channel = parsed.data.channel ?? "all";
    const status = parsed.data.status ?? "published";
    const days = parsed.data.days ?? 90;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const posts = await prisma.marketingPost.findMany({
      where: {
        kind: "social_post",
        ...(brand !== "all" ? { brand } : {}),
        ...(channel !== "all" ? { channel } : {}),
        ...(status !== "all" ? { status } : { status: { in: ["published", "scheduled"] } }),
        OR: [{ publishedAt: { gte: since } }, { createdAt: { gte: since } }],
      },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      take: 100,
      select: {
        id: true,
        brand: true,
        channel: true,
        status: true,
        title: true,
        body: true,
        publishedAt: true,
        createdAt: true,
        publishedUrl: true,
        externalPostId: true,
        ctaUrl: true,
        destinationUrl: true,
        metricImpressions: true,
        metricEngagements: true,
        metricClicks: true,
        metricsSyncedAt: true,
      },
    });

    const ids = posts.map((p) => p.id);
    const [landings, signups] = await Promise.all([
      ids.length
        ? prisma.pageView.groupBy({
            by: ["content"],
            where: { content: { in: ids } },
            _count: { _all: true },
          })
        : Promise.resolve([]),
      ids.length
        ? prisma.user.groupBy({
            by: ["acquisitionPostId"],
            where: { acquisitionPostId: { in: ids } },
            _count: { _all: true },
          })
        : Promise.resolve([]),
    ]);

    const landingMap = new Map(
      landings
        .filter((r) => r.content)
        .map((r) => [r.content as string, r._count._all])
    );
    const signupMap = new Map(
      signups
        .filter((r) => r.acquisitionPostId)
        .map((r) => [r.acquisitionPostId as string, r._count._all])
    );

    const rows = posts.map((p) => ({
      id: p.id,
      brand: p.brand,
      channel: p.channel,
      status: p.status,
      title: p.title || p.body.slice(0, 80),
      publishedAt: p.publishedAt?.toISOString() ?? null,
      createdAt: p.createdAt.toISOString(),
      publishedUrl: p.publishedUrl,
      ctaUrl: p.ctaUrl,
      destinationUrl: p.destinationUrl,
      siteLandings: landingMap.get(p.id) ?? 0,
      signups: signupMap.get(p.id) ?? 0,
      platformViews: p.metricImpressions,
      platformEngagement: p.metricEngagements,
      platformClicks: p.metricClicks,
      metricsSyncedAt: p.metricsSyncedAt?.toISOString() ?? null,
    }));

    return json({ rows, filters: { brand, channel, status, days } });
  } catch (error) {
    console.error("[admin/marketing/performance]", error);
    return serverError("Could not load marketing performance.");
  }
}
