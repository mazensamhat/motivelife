/** Client-safe MyMotiveFamily™ marketing copy */

export {
  FAMILY_CATEGORY,
  FAMILY_HERO_LINES,
  FAMILY_INTERNAL_PRINCIPLE,
  FAMILY_MAX_MEMBERS,
  FAMILY_MEMBER_PRO_UPGRADE_LABEL,
  FAMILY_MVP_FEATURES,
  FAMILY_OUT_OF_SCOPE_V1,
  FAMILY_PHASE_TWO_FEATURES,
  FAMILY_PLANS,
  FAMILY_PRICE_CAD,
  FAMILY_PRICE_LABEL,
  FAMILY_PRODUCT_NAME,
  FAMILY_SUPPORTING_LINE,
  FAMILY_INTELLIGENCE_ENGINES,
  LIFE_PRO_PRICE_LABEL,
  LOCATION_SHARING_LABELS,
  LOCATION_SHARING_LEVELS,
} from "@forward/shared";

export const FAMILY_PAGE_PATH = "/family";

export const FAMILY_META_TITLE =
  "MyMotiveFamily™ — Family Intelligence powered by MyMotiveLife";

export const FAMILY_META_DESCRIPTION =
  "Family Intelligence for your household: see where everyone is, understand how they move, learn what’s normal, and stay one step ahead — $19.99 CAD/month including MyMotiveLife Pro for the owner.";

export const FAMILY_CTA_PRIMARY = "Open Family Map";
export const FAMILY_CTA_SECONDARY = "Create account";
export const FAMILY_MAP_PATH = "/family-map";

export const FAMILY_NOW_DEMO = {
  title: "YOUR FAMILY — NOW",
  members: [
    { name: "Dad", status: "Driving home · ETA 22 min" },
    { name: "Mom", status: "Costco · Arrived 18 min ago" },
    { name: "Mohamad", status: "University · Leaving around 4:30" },
    { name: "Mahdi", status: "Soccer · Practice ends 7:30" },
  ],
  everyoneHome: "Everyone expected home: 8:06 PM",
  alert: "Traffic is increasing on Dad’s normal route.",
  tip: "Mom is at Costco. 7 items remain on the household shopping list.",
} as const;

export const FAMILY_FLOW_DEMO = {
  title: "FAMILY ETA",
  everyone: "Everyone home around 8:07 PM",
  conflict:
    "Dad’s current ETA and Mahdi’s pickup overlap by approximately 11 minutes. Mom can reach soccer approximately 16 minutes earlier.",
  legs: [
    { name: "Dad", detail: "→ Home · ETA 5:51 PM" },
    { name: "Mom", detail: "→ Grocery · ETA 5:36 PM" },
    { name: "Mohamad", detail: "→ Home · ETA 6:04 PM" },
    { name: "Mahdi", detail: "● Soccer · Pickup 7:30 PM" },
  ],
} as const;

export const FAMILY_DIFFERENT_DEMO = {
  title: "SOMETHING’S DIFFERENT",
  body: "Mahdi normally leaves soccer between 7:25 and 7:42 PM. It’s currently 8:06 PM. He’s still there. Battery: 13%. No calendar change detected.",
  tone: "This is unusual — not an emergency.",
  actions: ["Message", "Call", "Navigate"] as const,
} as const;

export const FAMILY_PRIVACY_PILLARS = [
  {
    title: "You control what you share",
    detail:
      "Precise, approximate, destination-only, ETA-only, driving status, or off — per person.",
  },
  {
    title: "Adult Digital Twins stay private",
    detail:
      "The Family Owner does not own another adult’s Digital Twin. Share is explicit, never assumed.",
  },
  {
    title: "Unusual ≠ emergency",
    detail:
      "Something’s Different™ flags meaningful deviations without false-alarm theatrics.",
  },
] as const;
