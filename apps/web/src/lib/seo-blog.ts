import { prisma } from "@forward/database";
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
  publishedAt: Date;
  updatedAt: Date;
};

export function seoPostPublicPath(slug: string): string {
  return `/blog/${slug}`;
}

export function seoPostPublicUrl(slug: string): string {
  return `${getSiteUrl()}${seoPostPublicPath(slug)}`;
}

export async function getPublishedSeoPostBySlug(slug: string): Promise<PublishedSeoPost | null> {
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
}

export async function listPublishedSeoPosts(limit = 50): Promise<PublishedSeoPost[]> {
  const rows = await prisma.marketingPost.findMany({
    where: {
      status: "published",
      channel: "google_search",
      slug: { not: null },
    },
    orderBy: { publishedAt: "desc" },
    take: limit,
  });

  return rows
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
}
