/**
 * SEO landing data for /alternatives/life360
 * Reviewed against public product positioning. Prefer “not core / limited /
 * varies” over absolute “doesn’t have”. Label non-live KINZO AI rows.
 */

export const LIFE360_ALT_PATH = "/alternatives/life360";

export const LIFE360_ALT_META = {
  title: "7 Best Life360 Alternatives for Families in 2026",
  metaTitle: "7 Best Life360 Alternatives for Families (2026) | KINZO AI",
  metaDescription:
    "Compare Life360 alternatives for families — location, driving safety, and AI Family Intelligence. Published by MotiveLife. Free KINZO map; intelligence optional.",
  keywords: [
    "Life360 alternatives",
    "apps like Life360",
    "best family tracking app",
    "Life360 alternative Canada",
    "AI family location app",
    "KINZO AI",
    "family intelligence app",
  ],
} as const;

/** As-of date shown on the page — update when rows are re-verified. */
export const LIFE360_ALT_REVIEWED = "August 2026";

export type ComparisonCategory = "location" | "driving" | "ai" | "life";

export type ComparisonCell = {
  text: string;
  /** Emphasize trademarked / differentiator copy */
  strong?: boolean;
  /** KINZO AI capability not fully live yet */
  comingSoon?: boolean;
};

export type ComparisonRow = {
  id: string;
  capability: string;
  category: ComparisonCategory;
  life360: ComparisonCell;
  appleGoogle: ComparisonCell;
  other: ComparisonCell;
  ours: ComparisonCell;
};

export const COMPARISON_FILTERS: {
  id: "all" | ComparisonCategory;
  label: string;
  hint: string;
}[] = [
  { id: "all", label: "All features", hint: "Showing all capabilities." },
  { id: "location", label: "Location", hint: "Where people are, were, and arrive." },
  { id: "driving", label: "Driving & safety", hint: "Movement, driving events, emergency services." },
  { id: "ai", label: "AI intelligence", hint: "Routines, prediction, household coordination." },
  { id: "life", label: "Life integration", hint: "Digital Twin and how movement affects life." },
];

export const COMPARISON_COLUMNS = [
  { id: "life360", label: "Life360" },
  { id: "appleGoogle", label: "Apple / Google" },
  { id: "other", label: "Other family trackers" },
  { id: "ours", label: "KINZO AI™" },
] as const;

export const COMPARISON_ROWS: ComparisonRow[] = [
  {
    id: "live-location",
    capability: "Live family location",
    category: "location",
    life360: { text: "✓" },
    appleGoogle: { text: "✓" },
    other: { text: "✓" },
    ours: { text: "✓ Free forever" },
  },
  {
    id: "arrival",
    capability: "Arrival / departure alerts",
    category: "location",
    life360: { text: "✓" },
    appleGoogle: { text: "Varies" },
    other: { text: "Common" },
    ours: { text: "✓" },
  },
  {
    id: "history",
    capability: "Location history",
    category: "location",
    life360: { text: "2–30 days by plan" },
    appleGoogle: { text: "Limited" },
    other: { text: "Varies widely" },
    ours: { text: "✓ + intelligence", strong: true },
  },
  {
    id: "places",
    capability: "Place profiles",
    category: "location",
    life360: { text: "Place alerts" },
    appleGoogle: { text: "Basic places" },
    other: { text: "Usually alerts / history" },
    ours: {
      text: "Place Intelligence™ — frequency, duration, who visits, changing patterns",
      strong: true,
    },
  },
  {
    id: "driving-summaries",
    capability: "Driving summaries",
    category: "driving",
    life360: { text: "✓" },
    appleGoogle: { text: "Not core" },
    other: { text: "Available in some apps" },
    ours: { text: "✓ Drive Score" },
  },
  {
    id: "drive-events",
    capability: "Speed / braking / driving events",
    category: "driving",
    life360: { text: "✓" },
    appleGoogle: { text: "Not core" },
    other: { text: "Available in some apps" },
    ours: { text: "Drive Intelligence™", strong: true },
  },
  {
    id: "crash",
    capability: "Crash / emergency assistance",
    category: "driving",
    life360: { text: "Strong", strong: true },
    appleGoogle: { text: "Device dependent" },
    other: { text: "Available in some apps" },
    ours: { text: "Future / partner opportunity" },
  },
  {
    id: "roadside",
    capability: "Roadside / protection services",
    category: "driving",
    life360: { text: "Strong paid-tier advantage", strong: true },
    appleGoogle: { text: "Not core" },
    other: { text: "Limited" },
    ours: { text: "Not the core proposition" },
  },
  {
    id: "normal-life",
    capability: "Learns normal routines",
    category: "ai",
    life360: { text: "Some behavioral context" },
    appleGoogle: { text: "Not core" },
    other: { text: "Limited / varies" },
    ours: { text: "Normal Life Model™", strong: true },
  },
  {
    id: "something-different",
    capability: "Explains meaningful deviations",
    category: "ai",
    life360: { text: "Alerts / events" },
    appleGoogle: { text: "Basic notifications" },
    other: { text: "Mostly alerts" },
    ours: { text: "Something’s Different™ AI context", strong: true },
  },
  {
    id: "destination",
    capability: "Predicts likely destination",
    category: "ai",
    life360: { text: "Not a core advertised feature" },
    appleGoogle: { text: "Not core" },
    other: { text: "Not commonly highlighted" },
    ours: { text: "Destination Prediction™", strong: true },
  },
  {
    id: "whos-going",
    capability: "Who is heading to a place",
    category: "ai",
    life360: { text: "Location visibility" },
    appleGoogle: { text: "Location visibility" },
    other: { text: "Location visibility" },
    ours: { text: "Who’s Going There?™", strong: true },
  },
  {
    id: "family-flow",
    capability: "Household-wide ETA",
    category: "ai",
    life360: { text: "Individual location focus" },
    appleGoogle: { text: "Individual location focus" },
    other: { text: "Mostly individual tracking" },
    ours: { text: "Family Flow™ — when everyone is likely home", strong: true },
  },
  {
    id: "logistics",
    capability: "Predicts schedule / pickup conflicts",
    category: "ai",
    life360: { text: "Not core" },
    appleGoogle: { text: "Separate calendar tools" },
    other: { text: "Not typical" },
    ours: { text: "✓ Family logistics AI", strong: true },
  },
  {
    id: "smart-departure",
    capability: "Recommends when to leave",
    category: "ai",
    life360: { text: "ETA / location tools" },
    appleGoogle: { text: "Navigation tools" },
    other: { text: "Varies" },
    ours: {
      text: "Smart Departure™ — calendar + traffic + routines",
      strong: true,
    },
  },
  {
    id: "weekly-pattern",
    capability: "Weekly driving & pattern reports",
    category: "ai",
    life360: { text: "Driving / location reports" },
    appleGoogle: { text: "Not core" },
    other: { text: "Limited" },
    ours: { text: "✓ Weekly Driving Report + Drive Score", strong: true },
  },
  {
    id: "money",
    capability: "Connects movement to money",
    category: "life",
    life360: { text: "Not core" },
    appleGoogle: { text: "Not core" },
    other: { text: "Not typical" },
    ours: { text: "✓ Digital Twin — trips feed Money", strong: true },
  },
  {
    id: "health",
    capability: "Movement feeds personal life context",
    category: "life",
    life360: { text: "Not core" },
    appleGoogle: { text: "Separate health ecosystems" },
    other: { text: "Not typical" },
    ours: {
      text: "Life Impact Engine™ — Twin timeline, travel, fuel estimates",
      strong: true,
    },
  },
  {
    id: "family-time",
    capability: "Connects commute to family time",
    category: "life",
    life360: { text: "Not core" },
    appleGoogle: { text: "Not core" },
    other: { text: "Not typical" },
    ours: { text: "✓ Family Time Intelligence™", strong: true },
  },
  {
    id: "digital-twin",
    capability: "Personal AI Digital Twin",
    category: "life",
    life360: { text: "—" },
    appleGoogle: { text: "—" },
    other: { text: "Not typical" },
    ours: { text: "✓ MyMotiveLife Pro for the owner", strong: true },
  },
  {
    id: "me-us",
    capability: "Understands ME + US",
    category: "life",
    life360: { text: "Primarily family safety" },
    appleGoogle: { text: "Ecosystem tools" },
    other: { text: "Primarily tracking / safety" },
    ours: { text: "Personal Digital Twin + Family Intelligence", strong: true },
  },
];

export type AlternativeProfile = {
  id: string;
  name: string;
  tag: string;
  whyChoose: string;
  bestFor: string;
  limit: string;
  href?: string;
  featured?: boolean;
};

/** Seven named alternatives — title keyword match. */
export const LIFE360_ALTERNATIVES: AlternativeProfile[] = [
  {
    id: "life360",
    name: "Life360",
    tag: "Safety + protection",
    whyChoose:
      "The category leader for family location with place alerts, driver reports, crash/SOS, and paid roadside / protection tiers.",
    bestFor: "Households that want established emergency and roadside infrastructure.",
    limit: "Intelligence beyond alerts and reports is not the core story.",
  },
  {
    id: "apple",
    name: "Apple Find My",
    tag: "Free ecosystem",
    whyChoose:
      "Already on iPhone — Family Sharing location is enough for many households with zero new app.",
    bestFor: "All-Apple families who want basic “where are they?”",
    limit: "Limited history, driving intelligence, and household coordination AI.",
  },
  {
    id: "google",
    name: "Google Family Link / Find My Device",
    tag: "Free ecosystem",
    whyChoose: "Built into Android / Google accounts for location and parental controls.",
    bestFor: "Android-first families who want basics without another subscription.",
    limit: "Not designed as a Family Intelligence platform.",
  },
  {
    id: "isharing",
    name: "iSharing",
    tag: "History depth",
    whyChoose:
      "Strong on location sharing with longer history on higher tiers, plus driving / high-speed alerts.",
    bestFor: "Families who care about extended history and speed alerts.",
    limit: "Less emphasis on routines, prediction, and life-context AI.",
  },
  {
    id: "geozilla",
    name: "GeoZilla",
    tag: "Tracking + driving safety",
    whyChoose: "Real-time tracking combined with driving and crash-oriented safety features.",
    bestFor: "Parents focused on kid location and driving safety signals.",
    limit: "Does not center household pattern intelligence or Digital Twin context.",
  },
  {
    id: "findmykids",
    name: "Findmykids",
    tag: "Child safety",
    whyChoose: "Purpose-built for child location, SOS, and parental peace of mind.",
    bestFor: "Parents monitoring younger kids specifically.",
    limit: "Not aimed at whole-household Adult + US intelligence.",
  },
  {
    id: "mymotivefamily",
    name: "KINZO AI",
    tag: "Family Intelligence",
    whyChoose:
      "Live KINZO map stays free. Upgrade when you want routines, calm “something’s different” context, Drive & Place Intelligence, and MyMotiveLife Pro for the owner.",
    bestFor: "Families who want location to become context, patterns, and coordination — in Canada and beyond.",
    limit: "Not competing on roadside assistance or emergency dispatch infrastructure.",
    href: "/family",
    featured: true,
  },
];

export const STRENGTH_BANDS = [
  {
    title: "Life360’s strength: Safety + protection",
    body: "Location, driving, crash/SOS, and premium assistance services.",
  },
  {
    title: "Free ecosystem strength: Apple + Google",
    body: "Basic family location is already built into major phone ecosystems.",
  },
  {
    title: "KINZO AI’s position: Family Intelligence",
    body: "Location becomes context, patterns, prediction, coordination, and life impact.",
  },
] as const;
