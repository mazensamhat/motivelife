import type { MetadataRoute } from "next";
import { listPublishedSeoPosts } from "@/lib/seo-blog";
import { getSiteUrl } from "@/lib/site-url";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = getSiteUrl();
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    { url: site, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${site}/register`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${site}/login`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${site}/blog`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${site}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${site}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${site}/support`, lastModified: now, changeFrequency: "yearly", priority: 0.5 },
  ];

  let blogPages: MetadataRoute.Sitemap = [];
  try {
    const posts = await listPublishedSeoPosts(200);
    blogPages = posts.map((post) => ({
      url: `${site}/blog/${post.slug}`,
      lastModified: post.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    }));
  } catch {
    // DB may be unavailable during build — static pages still ship.
  }

  return [...staticPages, ...blogPages];
}
