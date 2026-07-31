import { prisma } from "@forward/database";
import { STATIC_BLOG_POSTS, type StaticBlogKind } from "@/lib/blog-content";
import { getSiteUrl } from "@/lib/site-url";

function parseJsonArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw) as unknown;
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

export type PublishedSeoPost = {
  id: string;
  slug: string;
  title: string;
  body: string;
  metaTitle: string;
  metaDescription: string;
  keywords: string[];
  kind?: StaticBlogKind;
  publishedAt: Date;
  updatedAt: Date;
};

export function seoPostPublicPath(slug: string): string {
  return `/blog/${slug}`;
}

export function seoPostPublicUrl(slug: string): string {
  return `${getSiteUrl()}${seoPostPublicPath(slug)}`;
}

function isMissingBlogSchemaError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String(error.code) : "";
  if (code === "P2022") return true;
  const message = "message" in error ? String(error.message) : "";
  return message.includes("MarketingPost.slug") || message.includes("does not exist");
}

function staticToPublished(post: (typeof STATIC_BLOG_POSTS)[number]): PublishedSeoPost {
  const publishedAt = new Date(`${post.publishedAt}T12:00:00.000Z`);
  return {
    id: `static:${post.slug}`,
    slug: post.slug,
    title: post.title,
    body: post.body,
    metaTitle: post.metaTitle,
    metaDescription: post.metaDescription,
    keywords: post.keywords,
    kind: post.kind,
    publishedAt,
    updatedAt: publishedAt,
  };
}

function mergePosts(dbPosts: PublishedSeoPost[]): PublishedSeoPost[] {
  const bySlug = new Map<string, PublishedSeoPost>();
  for (const post of dbPosts) {
    bySlug.set(post.slug, post);
  }
  // Static content wins for the same slug so shipped guides stay authoritative.
  for (const post of STATIC_BLOG_POSTS) {
    bySlug.set(post.slug, staticToPublished(post));
  }
  return [...bySlug.values()].sort(
    (a, b) => b.publishedAt.getTime() - a.publishedAt.getTime() || a.title.localeCompare(b.title)
  );
}

export async function getPublishedSeoPostBySlug(slug: string): Promise<PublishedSeoPost | null> {
  const staticPost = STATIC_BLOG_POSTS.find((post) => post.slug === slug);
  if (staticPost) return staticToPublished(staticPost);

  try {
    const row = await prisma.marketingPost.findFirst({
      where: {
        slug,
        status: "published",
        channel: "google_search",
      },
    });

    if (!row?.slug) return null;

    return {
      id: row.id,
      slug: row.slug,
      title: row.title ?? row.metaTitle ?? "MotiveLife",
      body: row.body,
      metaTitle: row.metaTitle ?? row.title ?? "MotiveLife",
      metaDescription: row.metaDescription ?? "",
      keywords: parseJsonArray(row.keywords),
      publishedAt: row.publishedAt ?? row.updatedAt,
      updatedAt: row.updatedAt,
    };
  } catch (error) {
    if (isMissingBlogSchemaError(error)) return null;
    throw error;
  }
}

export async function listPublishedSeoPosts(limit = 50): Promise<PublishedSeoPost[]> {
  let dbPosts: PublishedSeoPost[] = [];
  try {
    const rows = await prisma.marketingPost.findMany({
      where: {
        status: "published",
        channel: "google_search",
        slug: { not: null },
      },
      orderBy: { publishedAt: "desc" },
      take: limit,
    });

    dbPosts = rows
      .filter((row): row is typeof row & { slug: string } => Boolean(row.slug))
      .map((row) => ({
        id: row.id,
        slug: row.slug,
        title: row.title ?? row.metaTitle ?? "MotiveLife",
        body: row.body,
        metaTitle: row.metaTitle ?? row.title ?? "MotiveLife",
        metaDescription: row.metaDescription ?? "",
        keywords: parseJsonArray(row.keywords),
        publishedAt: row.publishedAt ?? row.updatedAt,
        updatedAt: row.updatedAt,
      }));
  } catch (error) {
    if (!isMissingBlogSchemaError(error)) throw error;
  }

  return mergePosts(dbPosts).slice(0, limit);
}
