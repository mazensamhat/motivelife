export type StaticBlogKind = "article" | "guide";

export type StaticBlogPost = {
  slug: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  keywords: string[];
  kind: StaticBlogKind;
  /** ISO date string (YYYY-MM-DD) */
  publishedAt: string;
  body: string;
};
