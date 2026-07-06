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

function isMissingBlogSchemaError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String(error.code) : "";
  if (code === "P2022") return true;
  const message = "message" in error ? String(error.message) : "";
  return message.includes("MarketingPost.slug") || message.includes("does not exist");
}

export async function getPublishedSeoPostBySlug(slug: string): Promise<PublishedSeoPost | null> {
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
  } catch (error) {
    if (isMissingBlogSchemaError(error)) return [];
    throw error;
  }
}
