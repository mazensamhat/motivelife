import type { StaticBlogPost } from "./types";
import { creatorAffiliatesArticle } from "./article-creator-affiliates";
import { digitalTwinArticle } from "./article-digital-twin";
import { aiLifeCoachArticle } from "./article-ai-life-coach";
import { aiDailyPlannerArticle } from "./article-ai-daily-planner";
import { voiceProductivityArticle } from "./article-voice-productivity";
import { gettingStartedGuide } from "./guide-getting-started";
import { voiceOrganizeGuide } from "./guide-voice-organize";
import { dailyBriefGuide } from "./guide-daily-brief";
import { lifeGraphGuide } from "./guide-life-graph";
import { familyIntelligenceArticle } from "./article-family-intelligence";
import { life360AlternativesArticle } from "./article-life360-alternatives";
import { kashuCashFlowArticle } from "./article-kashu-cash-flow";

export type { StaticBlogKind, StaticBlogPost } from "./types";

/** Ship-with-code articles & guides (merged with CMS MarketingPost rows). */
export const STATIC_BLOG_POSTS: StaticBlogPost[] = [
  kashuCashFlowArticle,
  life360AlternativesArticle,
  familyIntelligenceArticle,
  aiLifeCoachArticle,
  aiDailyPlannerArticle,
  voiceProductivityArticle,
  creatorAffiliatesArticle,
  digitalTwinArticle,
  gettingStartedGuide,
  voiceOrganizeGuide,
  dailyBriefGuide,
  lifeGraphGuide,
];

/** Featured posts for homepage + footer internal links (organic SEO). */
export const FEATURED_BLOG_LINKS: { href: string; label: string; blurb: string }[] = [
  {
    href: "/blog/kashu-cash-flow-intelligence-safe-to-spend",
    label: "Kashu · Safe to Spend",
    blurb: "Cash-Flow Intelligence — balance minus reserved minus safety floor.",
  },
  {
    href: "/alternatives/life360",
    label: "Life360 alternatives compared",
    blurb: "Interactive table — Family Intelligence vs tracking apps.",
  },
  {
    href: "/blog/family-intelligence-beyond-location-sharing",
    label: "KINZO AI beyond the map",
    blurb: "Family intelligence: understand how your household lives.",
  },
  {
    href: "/blog/ai-life-coach-that-actually-runs-your-day",
    label: "AI life coach that runs your day",
    blurb: "Why MotiveLife is an operating system — not just chat advice.",
  },
  {
    href: "/blog/ai-daily-planner-morning-briefing",
    label: "AI daily planner & morning briefing",
    blurb: "One Daily Life Brief beats a packed to-do list.",
  },
];

export function getStaticBlogPost(slug: string): StaticBlogPost | undefined {
  return STATIC_BLOG_POSTS.find((post) => post.slug === slug);
}
