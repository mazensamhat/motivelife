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
  "MyMotiveFamily — The map knows where they are. The AI understands why it matters.";

export const FAMILY_META_DESCRIPTION =
  "Peace of mind without watching the map. Live Family Intelligence Map, Normal Life Model™, Place & Drive Intelligence, Family Flow™ — $19.99 CAD/month, includes MyMotiveLife Pro for the owner.";

export const FAMILY_CTA_PRIMARY = "Start My Family";
export const FAMILY_CTA_SECONDARY = "Connect my family";

export const FAMILY_TAGLINE = "Your family. Connected. Understood. One step ahead.";

/** Strongest product statement — use near hero / compare / final CTA */
export const FAMILY_PRODUCT_STATEMENT =
  "The map knows where they are. The AI understands why it matters.";

export const FAMILY_NORMAL_LIFE_PUNCH =
  "First, AI learns what’s normal. Then it knows when something is different.";

export const FAMILY_TWO_PRODUCT_LINE = "One AI for your life. One AI for your family.";

/** Generic demo cast — never use real customer or founder names on marketing surfaces. */
export const FAMILY_NOW_DEMO = {
  title: "Live Family Intelligence Map",
  members: [
    { name: "Alex", status: "→ Home · 23 min", pin: "A" },
    { name: "Jordan", status: "● Costco · 18 min", pin: "J" },
    { name: "Sam", status: "→ University · 11 min", pin: "S" },
    { name: "Riley", status: "● Soccer · Pickup 7:30", pin: "R" },
  ],
  everyoneHome: "Everyone home around 8:06 PM",
} as const;

export const FAMILY_AI_CARD = {
  title: "AI noticed something",
  body: "Riley normally leaves soccer between 7:25–7:40 PM. It’s 8:02 PM and they’re still there.",
  meta: "Battery 14% · No calendar change",
  tone: "Unusual — not an emergency.",
  actions: ["Message", "Call", "Navigate"] as const,
} as const;

export const FAMILY_PLACE_DEMO = {
  name: "Costco",
  visits: "14 visits in 90 days",
  avgVisit: "52 min",
  usual: "Saturday afternoon",
  visitor: "Jordan",
  current: "Jordan → Heading there · ETA 11 min",
  listCount: 7,
} as const;

export const FAMILY_DRIVE_DEMO = {
  name: "Riley’s drive",
  score: 91,
  band: "Safe drive",
  duration: "18 min · 11.4 km",
  maxSpeed: "67 km/h",
  hardBraking: 0,
  rapidAccel: 0,
  ai: "Everything looks normal. Drive Score is 3 points above Riley’s average for this route.",
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

/** Spectacular change-detection example — show high on /family */
export const FAMILY_OMG_CHANGE_DEMO = {
  eyebrow: "Do I Need to Worry?™",
  headline: "AI noticed a change you didn’t.",
  over: "Over the last 6 weeks:",
  deltas: [
    { label: "Work departure", value: "+38 min later" },
    { label: "Commute", value: "+17% longer" },
    { label: "Family time", value: "−6.2 hrs/month" },
    { label: "Exercise", value: "−3 sessions/month" },
    { label: "Transportation", value: "+$87/month" },
  ],
  insight: "These changes began within 9 days of your office relocation.",
  momentum: "Life Momentum impact: −6",
  cta: "See how to recover the lost time →",
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
  {
    label: "Understands why movement matters to your life",
    typical: "Not typically offered",
    ours: "Digital Twin + Life Impact™",
  },
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
  eyebrow: "MyMotiveFamily · US intelligence",
  headline: "Peace of mind without making you watch a map.",
  bullets: [
    "See where everyone is.",
    "Know what’s normal for each person.",
    "Get calm alerts only when something needs you.",
    "Coordinate tomorrow before it gets complicated.",
  ],
  cta: "Explore MyMotiveFamily →",
} as const;

/** Emotional buy reason — immediately after the map on /family */
export const FAMILY_PEACE_OF_MIND = {
  eyebrow: "Peace of mind",
  headline: "You shouldn’t have to watch the map.",
  subhead: "MyMotiveFamily learns what’s normal so you don’t have to keep checking.",
  ok: {
    name: "Riley",
    lines: [
      "At school",
      "Normal Tuesday routine",
      "Battery 71%",
      "Expected departure ~3:14 PM",
    ],
    footer: "Everything looks normal.",
    action: "No action needed.",
  },
  checkIn: {
    name: "Sam",
    lines: [
      "Something’s different",
      "Usual departure: 5:10–5:30",
      "Current time: 6:04",
      "Battery: 9%",
      "No calendar change",
    ],
    footer: "Worth checking in.",
    action: "Message Sam",
  },
  punch: "They’re okay. We’ll tell you when something needs your attention.",
} as const;

/** Family Operating System — logistics intelligence */
export const FAMILY_FLOW_LOGISTICS = {
  eyebrow: "Family Flow™",
  headline: "Tomorrow looks complicated.",
  summary: "5 people · 11 commitments · 6 locations · 3 vehicles",
  conflict: "2 schedule conflicts detected",
  facts: [
    "Dad won’t reach soccer pickup until approximately 7:41 PM.",
    "Mom’s current route passes within four minutes of the field.",
  ],
  suggestionTitle: "Suggested change",
  suggestion: "Mom → Soccer pickup",
  resultsTitle: "Estimated result",
  results: ["Everyone on time", "23 fewer km driven", "41 minutes saved"],
} as const;
