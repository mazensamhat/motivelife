/** Client-safe MyMotiveFamily marketing copy */

export {
  FAMILY_CATEGORY,
  FAMILY_HERO_LINES,
  FAMILY_MAX_MEMBERS,
  FAMILY_MEMBER_PRO_UPGRADE_LABEL,
  FAMILY_PLANS,
  FAMILY_PRICE_CAD,
  FAMILY_PRICE_LABEL,
  FAMILY_PRODUCT_NAME,
  FAMILY_SUPPORTING_LINE,
  FAMILY_INTELLIGENCE_ENGINES,
  LIFE_PRO_PRICE_CAD,
  LIFE_PRO_PRICE_LABEL,
  LOCATION_SHARING_LABELS,
  LOCATION_SHARING_LEVELS,
} from "@forward/shared";

export const FAMILY_PAGE_PATH = "/family";
export const FAMILY_MAP_PATH = "/family-map";

export const FAMILY_META_TITLE =
  "MyMotiveFamily — Family Intelligence, not just a map";

export const FAMILY_META_DESCRIPTION =
  "Your family. Connected. Understood. One step ahead. Live Family Intelligence Map, Place & Drive Intelligence, Normal Life Model™ — $19.99 CAD/month, includes MyMotiveLife Pro for the owner.";

export const FAMILY_CTA_PRIMARY = "Start my family";
export const FAMILY_CTA_SECONDARY = "Connect my family";

export const FAMILY_TAGLINE = "Your family. Connected. Understood. One step ahead.";

export const FAMILY_TWO_PRODUCT_LINE = "One AI for your life. One AI for your family.";

export const FAMILY_NOW_DEMO = {
  title: "Live Family Intelligence Map",
  members: [
    { name: "Mazen", status: "→ Home · 23 min", pin: "Ma" },
    { name: "Inaam", status: "● Costco · 18 min", pin: "In" },
    { name: "Mohamad", status: "→ University · 11 min", pin: "Mo" },
    { name: "Mahdi", status: "● Soccer · Pickup 7:30", pin: "Mh" },
  ],
  everyoneHome: "Everyone home around 8:06 PM",
} as const;

export const FAMILY_AI_CARD = {
  title: "AI noticed something",
  body: "Mahdi normally leaves soccer between 7:25–7:40 PM. It’s 8:02 PM and he’s still there.",
  meta: "Battery 14% · No calendar change",
  tone: "Unusual — not an emergency.",
  actions: ["Message", "Call", "Navigate"] as const,
} as const;

export const FAMILY_PLACE_DEMO = {
  name: "Costco",
  visits: "14 visits in 90 days",
  avgVisit: "52 min",
  usual: "Saturday afternoon",
  visitor: "Inaam",
  current: "Inaam → Heading there · ETA 11 min",
  listCount: 7,
} as const;

export const FAMILY_DRIVE_DEMO = {
  name: "Mahdi’s drive",
  score: 91,
  band: "Safe drive",
  duration: "18 min · 11.4 km",
  maxSpeed: "67 km/h",
  hardBraking: 0,
  rapidAccel: 0,
  ai: "Everything looks normal. Drive Score is 3 points above Mahdi’s average for this route.",
} as const;

export const FAMILY_NORMAL_LIFE_DEMO = {
  headline: "First, AI learns what’s normal.",
  normalTitle: "Normal Tuesday",
  normal: [
    { place: "School", time: "8:04" },
    { place: "Home", time: "3:24" },
    { place: "Soccer", time: "5:57" },
    { place: "Home", time: "7:46" },
  ],
  todayTitle: "Today",
  today: [
    { place: "School", time: "8:02" },
    { place: "Home", time: "3:21" },
    { place: "Soccer", time: "5:59" },
    { place: "Still at Soccer", time: "8:08", highlight: true },
  ],
  punch: "Something’s different.",
} as const;

export const FAMILY_LIFE_IMPACT_DEMO = {
  headline: "Your commute changed your life more than you realized.",
  chain: ["Commute", "Time", "Fuel Cost", "Exercise", "Family Time", "Sleep", "Life Momentum"],
  since: "Since changing offices:",
  deltas: [
    "+21 min/day driving",
    "+$94/month transportation",
    "−3.8 hours/month exercise",
    "−19 min/night sleep",
  ],
  momentum: "Life Momentum impact: −4 points",
} as const;

export const FAMILY_INTELLIGENCE_PILLARS = [
  {
    name: "Live Family Intelligence Map",
    detail: "See where everyone is, where they’re headed and when they’ll arrive.",
  },
  {
    name: "Place Intelligence™",
    detail: "Understand where your family goes, how often, how long they stay and how routines change.",
  },
  {
    name: "Drive Intelligence™",
    detail: "Speed, routes, driving behavior, Drive Scores and AI-detected changes.",
  },
  {
    name: "Destination Prediction™",
    detail: "AI learns routines and predicts likely destinations and ETAs.",
  },
  {
    name: "Family Flow™",
    detail: "See who’s going where and when everyone is likely to be home.",
  },
  {
    name: "Something’s Different™",
    detail: "AI learns normal routines and surfaces meaningful deviations — calmly.",
  },
] as const;

/** Defensible comparison — never name competitors; avoid absolute “nobody has this”. */
export const FAMILY_COMPARISON_CORE = [
  { label: "Live family location", typical: "Included", ours: "Included" },
  { label: "Arrival & departure alerts", typical: "Included", ours: "Included" },
  { label: "Location history", typical: "Included", ours: "Included" },
  { label: "Driving speed & events", typical: "Included", ours: "Included" },
] as const;

export const FAMILY_COMPARISON_FURTHER = [
  { label: "Drive insights", typical: "Basic / varies", ours: "AI-powered Drive Intelligence™" },
  { label: "Time & behavior at places", typical: "Limited / varies", ours: "Place Intelligence™" },
  { label: "Who’s heading there", typical: "Not typically offered", ours: "Household awareness" },
  { label: "Likely destination", typical: "Limited / varies", ours: "Destination Prediction™" },
  { label: "Family-wide ETAs", typical: "Limited / varies", ours: "Family Flow™" },
  { label: "Learns normal routines", typical: "Limited / varies", ours: "Normal Life Model™" },
  { label: "Meaningful change detection", typical: "Basic alerts", ours: "Something’s Different™" },
  { label: "Movement → lifestyle impact", typical: "Not typically offered", ours: "Life Impact via Digital Twin™" },
  { label: "Personal AI Digital Twin", typical: "Not typically offered", ours: "MyMotiveLife Pro for the owner" },
] as const;

export const FAMILY_PRIVACY_PILLARS = [
  {
    title: "You choose what to share",
    detail: "Precise, approximate, destination, ETA, driving status — or off.",
  },
  {
    title: "Personal Twin stays private",
    detail:
      "Their personal MyMotiveLife data remains private. The household never owns another adult’s Twin.",
  },
  {
    title: "Calm alerts",
    detail: "When something looks off, we say it’s unusual — not that it’s an emergency.",
  },
] as const;

/** Homepage teaser — keep short; full story lives on /family */
export const FAMILY_HOME_TEASER = {
  eyebrow: "Introducing MyMotiveFamily",
  headline: "One AI for your life. One AI for your family.",
  body: "A map tells you where they are. MyMotiveFamily understands what’s happening.",
  cta: "Explore MyMotiveFamily",
} as const;
