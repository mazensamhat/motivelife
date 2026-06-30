import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-url";

export default function sitemap(): MetadataRoute.Sitemap {
  const site = getSiteUrl();
  const now = new Date();

  const pages: MetadataRoute.Sitemap = [
    { url: site, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${site}/register`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${site}/login`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${site}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${site}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];

  return pages;
}
