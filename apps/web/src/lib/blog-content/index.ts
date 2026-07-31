import type { StaticBlogPost } from "./types";
import { creatorAffiliatesArticle } from "./article-creator-affiliates";
import { digitalTwinArticle } from "./article-digital-twin";
import { gettingStartedGuide } from "./guide-getting-started";
import { voiceOrganizeGuide } from "./guide-voice-organize";
import { dailyBriefGuide } from "./guide-daily-brief";
import { lifeGraphGuide } from "./guide-life-graph";

export type { StaticBlogKind, StaticBlogPost } from "./types";

/** Ship-with-code articles & guides (merged with CMS MarketingPost rows). */
export const STATIC_BLOG_POSTS: StaticBlogPost[] = [
  creatorAffiliatesArticle,
  digitalTwinArticle,
  gettingStartedGuide,
  voiceOrganizeGuide,
  dailyBriefGuide,
  lifeGraphGuide,
];

export function getStaticBlogPost(slug: string): StaticBlogPost | undefined {
  return STATIC_BLOG_POSTS.find((post) => post.slug === slug);
}
