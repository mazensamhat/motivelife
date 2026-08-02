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
  LIFE_PRO_PRICE_LABEL,
  LOCATION_SHARING_LABELS,
  LOCATION_SHARING_LEVELS,
} from "@forward/shared";

export const FAMILY_PAGE_PATH = "/family";
export const FAMILY_MAP_PATH = "/family-map";

export const FAMILY_META_TITLE = "MyMotiveFamily — Family Map & household intelligence";

export const FAMILY_META_DESCRIPTION =
  "See where your family is, understand how they move, and stay one step ahead. MyMotiveFamily — $19.99 CAD/month, includes MyMotiveLife Pro for the owner.";

export const FAMILY_CTA_PRIMARY = "Open Family Map";
export const FAMILY_CTA_SECONDARY = "Create account";

export const FAMILY_NOW_DEMO = {
  title: "Your family — now",
  members: [
    { name: "Dad", status: "Driving home · ETA 22 min" },
    { name: "Mom", status: "Costco · Arrived 18 min ago" },
    { name: "Mohamad", status: "University · Leaving around 4:30" },
    { name: "Mahdi", status: "Soccer · Practice ends 7:30" },
  ],
  everyoneHome: "Everyone expected home: 8:06 PM",
  alert: "Traffic is building on Dad’s usual route.",
  tip: "Mom is at Costco — 7 items still on the household list.",
} as const;

export const FAMILY_FLOW_DEMO = {
  title: "Family ETA",
  everyone: "Everyone home around 8:07 PM",
  conflict:
    "Dad’s ETA and Mahdi’s pickup overlap by about 11 minutes. Mom can reach soccer about 16 minutes earlier.",
  legs: [
    { name: "Dad", detail: "→ Home · ETA 5:51 PM" },
    { name: "Mom", detail: "→ Grocery · ETA 5:36 PM" },
    { name: "Mohamad", detail: "→ Home · ETA 6:04 PM" },
    { name: "Mahdi", detail: "● Soccer · Pickup 7:30 PM" },
  ],
} as const;

export const FAMILY_DIFFERENT_DEMO = {
  title: "Something’s different",
  body: "Mahdi usually leaves soccer between 7:25 and 7:42. It’s 8:06 and he’s still there. Battery is at 13%.",
  tone: "Flagged as unusual — not an emergency.",
  actions: ["Message", "Call", "Navigate"] as const,
} as const;

export const FAMILY_PRIVACY_PILLARS = [
  {
    title: "You choose what to share",
    detail: "Precise, approximate, destination, ETA, driving status — or off.",
  },
  {
    title: "Adult Twins stay private",
    detail: "Your Digital Twin isn’t owned by the household. Share only what you intend.",
  },
  {
    title: "Calm alerts",
    detail: "When something looks off, we say it’s unusual — not that it’s an emergency.",
  },
] as const;

/** Product benefits for marketing — only features that ship today */
export const FAMILY_PRODUCT_HIGHLIGHTS = [
  "Live family map with clear status for each person",
  "Household ETAs and pickup conflict hints",
  "Places your family actually uses",
  "Drive Score on trips you take",
  "Likely destinations while someone’s on the move",
  "Calm alerts when a routine looks different",
  "Per-person sharing controls — including Off",
  "Invite codes so your household can join in minutes",
] as const;
