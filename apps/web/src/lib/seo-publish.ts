import type { MarketingPost } from "@prisma/client";
import { prisma } from "@forward/database";
import { revalidatePath } from "next/cache";
import { ensureUniqueMarketingSlug } from "@/lib/seo-slug";
import { seoPostPublicPath, seoPostPublicUrl } from "@/lib/seo-blog";

function isSeoMarketingPost(post: MarketingPost): boolean {
  return (
    post.channel === "google_search" ||
    post.kind === "seo_page" ||
    post.kind === "seo_blog"
  );
}

export async function publishSeoPostToSite(post: MarketingPost) {
  if (!isSeoMarketingPost(post)) {
    return { ok: false as const, error: "Not an SEO post." };
  }

  const titleSource = post.metaTitle?.trim() || post.title?.trim() || post.body.split("\n")[0]?.replace(/^#+\s*/, "").trim();
  if (!titleSource) {
    return { ok: false as const, error: "SEO post needs a title or meta title before publishing." };
  }

  if (!post.metaDescription?.trim()) {
    return { ok: false as const, error: "SEO post needs a meta description before publishing." };
  }

  if (!post.body.trim()) {
    return { ok: false as const, error: "SEO post body is empty." };
  }

  await prisma.marketingPost.update({
    where: { id: post.id },
    data: { status: "publishing" },
  });

  try {
    const slug =
      post.slug?.trim() ||
      (await ensureUniqueMarketingSlug(titleSource, post.id));

    const path = seoPostPublicPath(slug);
    const publishedUrl = seoPostPublicUrl(slug);

    await prisma.marketingPost.update({
      where: { id: post.id },
      data: {
        status: "published",
        slug,
        title: post.title?.trim() || titleSource,
        metaTitle: post.metaTitle?.trim() || titleSource.slice(0, 60),
        publishedAt: post.publishedAt ?? new Date(),
        externalPostId: path,
        publishError: null,
      },
    });

    revalidatePath(path);
    revalidatePath("/blog");
    revalidatePath("/sitemap.xml");

    return {
      ok: true as const,
      mode: "api" as const,
      externalId: slug,
      publishedUrl,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not publish SEO page.";
    const schemaHint =
      message.includes("MarketingPost.slug") || (error as { code?: string })?.code === "P2022"
        ? " Run db:push to add the MarketingPost.slug column."
        : "";
    await prisma.marketingPost.update({
      where: { id: post.id },
      data: {
        status: "failed",
        publishError: message + schemaHint,
      },
    });
    return { ok: false as const, error: message + schemaHint };
  }
}
