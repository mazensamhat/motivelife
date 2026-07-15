import { NextResponse } from "next/server";
import { prisma } from "@forward/database";
import { buildTrackingUrl, type MarketingBrandId } from "@forward/marketing-agent";
import { getSiteUrl } from "@/lib/site-url";

type RouteParams = { params: Promise<{ postId: string }> };

const COOKIE = "ml_acq_post";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

/**
 * Public click hop: log landing attribution, set signup cookie, redirect to brand destination.
 * Social CTAs use https://www.mymotivelife.com/r/m/<postId> so all brands share one tracker.
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const { postId } = await params;
  const id = decodeURIComponent(postId || "").trim();
  if (!id) {
    return NextResponse.redirect(getSiteUrl(), 302);
  }

  const post = await prisma.marketingPost.findUnique({
    where: { id },
    select: {
      id: true,
      brand: true,
      channel: true,
      destinationUrl: true,
      ctaUrl: true,
    },
  });

  const brandId = (post?.brand ?? "motivelife") as MarketingBrandId;
  const channel = post?.channel ?? "social";

  let destination =
    post?.destinationUrl?.trim() ||
    (post?.ctaUrl?.trim() && !post.ctaUrl.includes("/r/m/")
      ? post.ctaUrl.trim()
      : null) ||
    buildTrackingUrl(brandId, channel, id);

  // Never redirect back into the hop.
  if (destination.includes("/r/m/")) {
    destination = buildTrackingUrl(brandId, channel, id);
  }

  try {
    await prisma.pageView.create({
      data: {
        path: `/r/m/${id}`,
        referrer: null,
        source: channel,
        medium: "social",
        campaign: brandId,
        content: id,
      },
    });
  } catch (error) {
    console.warn("[r/m] pageview log failed", error);
  }

  const response = NextResponse.redirect(destination, 302);
  response.cookies.set(COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
  return response;
}
