import type { MetadataRoute } from "next";
import { PLATFORMS } from "@/lib/platforms";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://www.motive-corp.com";
  return [
    { url: base, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: `${base}/platforms`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/about`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/contact`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    ...PLATFORMS.map((p) => ({
      url: `${base}/platforms/${p.slug}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
