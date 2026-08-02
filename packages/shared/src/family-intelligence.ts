/**
 * MyMotiveFamily™ — Family Intelligence platform primitives.
 * Canonical pricing, privacy, engines, and MVP scope for product + marketing.
 */

export const FAMILY_PRODUCT_NAME = "MyMotiveFamily";
export const FAMILY_CATEGORY = "Family Intelligence";
export const FAMILY_POWERED_BY = "MyMotiveLife";

export const FAMILY_HERO_LINES = [
  "Your Family.",
  "Connected. Understood. One Step Ahead.",
] as const;

export const FAMILY_SUPPORTING_LINE =
  "See where your family is, understand how they move, discover the patterns shaping their lives, and let AI help everyone stay one step ahead.";

export const FAMILY_INTERNAL_PRINCIPLE =
  "Life360 maps where your family goes. MyMotiveFamily understands how your family lives.";

/** CAD monthly list prices — keep marketing + ops analytics in sync. */
export const LIFE_PRO_PRICE_CAD = 14.99;
export const FAMILY_PRICE_CAD = 19.99;
export const FAMILY_MEMBER_PRO_UPGRADE_CAD = 5;

export const LIFE_PRO_PRICE_LABEL = "$14.99 CAD/month";
export const FAMILY_PRICE_LABEL = "$19.99 CAD/month";
export const FAMILY_MEMBER_PRO_UPGRADE_LABEL = "+$5 CAD/month";

/** Soft cap for invited household seats at launch. */
export const FAMILY_MAX_MEMBERS = 6;

export type FamilyPlanId = "life_pro" | "family" | "family_member_pro";

export type FamilyPlanDefinition = {
  id: FamilyPlanId;
  name: string;
  priceCad: number;
  priceLabel: string;
  summary: string;
  includes: string[];
};

export const FAMILY_PLANS: FamilyPlanDefinition[] = [
  {
    id: "life_pro",
    name: "MyMotiveLife Pro",
    priceCad: LIFE_PRO_PRICE_CAD,
    priceLabel: LIFE_PRO_PRICE_LABEL,
    summary: "AI for your life. One person. Full Digital Twin.",
    includes: [
      "Digital Twin™",
      "Life Probability Engine™",
      "Future Simulator™",
      "Daily Life Brief™",
      "Financial, career, goals, patterns, memory",
    ],
  },
  {
    id: "family",
    name: "MyMotiveFamily",
    priceCad: FAMILY_PRICE_CAD,
    priceLabel: FAMILY_PRICE_LABEL,
    summary: "AI for your life + your family. Owner gets Life Pro + Family platform.",
    includes: [
      "Everything in MyMotiveLife Pro for the account owner",
      `Up to ${FAMILY_MAX_MEMBERS} family members — core Family at no extra seat fee`,
      "Intelligent Family Map™ & Family Flow™",
      "Place, Drive, Destination, and Pattern intelligence",
      "Basic personal Digital Twin for each member",
    ],
  },
  {
    id: "family_member_pro",
    name: "Family Member Pro Upgrade",
    priceCad: FAMILY_MEMBER_PRO_UPGRADE_CAD,
    priceLabel: FAMILY_MEMBER_PRO_UPGRADE_LABEL,
    summary: "Invited member upgrades their private Digital Twin to full Pro.",
    includes: [
      "Full private MyMotiveLife Pro for that member",
      "Digital Twin remains private to them",
      "Family Owner does not own another adult’s Twin",
    ],
  },
];

/** Location sharing granularity — member-controlled. */
export const LOCATION_SHARING_LEVELS = [
  "precise",
  "approximate",
  "destination_only",
  "eta_only",
  "driving_status_only",
  "off",
] as const;

export type LocationSharingLevel = (typeof LOCATION_SHARING_LEVELS)[number];

export const LOCATION_SHARING_LABELS: Record<LocationSharingLevel, string> = {
  precise: "Precise Location",
  approximate: "Approximate Location",
  destination_only: "Destination Only",
  eta_only: "ETA Only",
  driving_status_only: "Driving Status Only",
  off: "Off",
};

/** Separate consent dimensions beyond live location. */
export const FAMILY_DATA_CONSENTS = [
  "driving_data",
  "place_history",
  "routine_learning",
  "family_insights",
  "digital_twin_integration",
] as const;

export type FamilyDataConsent = (typeof FAMILY_DATA_CONSENTS)[number];

export const FAMILY_DATA_CONSENT_LABELS: Record<FamilyDataConsent, string> = {
  driving_data: "Driving Data",
  place_history: "Place History",
  routine_learning: "Routine Learning",
  family_insights: "Family Insights",
  digital_twin_integration: "Digital Twin Integration",
};

export const FAMILY_INTELLIGENCE_ENGINES = [
  {
    id: "location",
    name: "Location Engine™",
    role: "Understands where people are and where they’ve been.",
  },
  {
    id: "place",
    name: "Place Intelligence™",
    role: "Understands what locations mean and how they’re used.",
  },
  {
    id: "drive",
    name: "Drive Intelligence™",
    role: "Understands movement and driving behavior.",
  },
  {
    id: "destination",
    name: "Destination Prediction™",
    role: "Estimates where someone is heading.",
  },
  {
    id: "normal_life",
    name: "Normal Life Model™",
    role: "Learns ordinary behavior for each consenting member.",
  },
  {
    id: "pattern",
    name: "Pattern Intelligence™",
    role: "Identifies meaningful changes and relationships.",
  },
  {
    id: "family_flow",
    name: "Family Flow™",
    role: "Understands the household as a coordinated system.",
  },
  {
    id: "life_impact",
    name: "Life Impact Engine™",
    role: "Connects location and movement back to the individual’s Digital Twin.",
  },
] as const;

export type FamilyEngineId = (typeof FAMILY_INTELLIGENCE_ENGINES)[number]["id"];

/** Features intentionally deferred — operational/compliance complexity. */
export const FAMILY_OUT_OF_SCOPE_V1 = [
  "Roadside assistance",
  "Insurance products",
  "Identity theft reimbursement",
  "Towing",
  "Emergency dispatch infrastructure",
  "Hardware trackers",
  "Travel insurance",
  "Stolen phone reimbursement",
] as const;

export const FAMILY_MVP_FEATURES = [
  "Intelligent Family Map™",
  "Live location & history",
  "Places, arrival/departure, speed",
  "Trip history & Drive Score",
  "Place Intelligence™",
  "Who’s Going There?™",
  "Family Flow™",
  "Destination Prediction™",
  "Normal Life Model™",
  "Something’s Different™",
  "Smart Departure™",
  "Weekly Family Intelligence",
  "MyMotiveLife Digital Twin integration",
] as const;

export const FAMILY_PHASE_TWO_FEATURES = [
  "Family Future™",
  "Schedule optimization",
  "Advanced Family Patterns",
  "Family Time Intelligence™",
  "Life Impact depth",
  "Household spending/location correlations",
  "Shared shopping intelligence",
  "AI trip consolidation",
  "Predictive traffic behavior",
  "Advanced driving intelligence",
] as const;

export type FamilyMemberPresenceStatus =
  | "stationary"
  | "moving"
  | "driving"
  | "unknown";

export type FamilyMemberPresence = {
  memberId: string;
  displayName: string;
  statusLabel: string;
  presence: FamilyMemberPresenceStatus;
  placeName?: string | null;
  etaMinutes?: number | null;
  batteryPercent?: number | null;
  likelyDestination?: string | null;
  destinationConfidence?: number | null;
};

export type FamilyFlowSummary = {
  everyoneHomeByLabel: string | null;
  conflictNote?: string | null;
  opportunityNote?: string | null;
  members: FamilyMemberPresence[];
};

export type DriveScoreBand = "safe" | "caution" | "review";

export type DriveTripSummary = {
  fromLabel: string;
  toLabel: string;
  distanceKm: number;
  durationMinutes: number;
  avgSpeedKmh: number;
  maxSpeedKmh: number;
  hardBraking: number;
  rapidAcceleration: number;
  unusualRouteEvents: number;
  driveScore: number;
  band: DriveScoreBand;
  personalBaselineScore?: number | null;
};

export function driveScoreBand(score: number): DriveScoreBand {
  if (score >= 85) return "safe";
  if (score >= 70) return "caution";
  return "review";
}

export function estimateHouseholdMrrCad(opts: {
  ownerFamily: boolean;
  memberProUpgrades: number;
}): number {
  if (!opts.ownerFamily) return 0;
  const upgrades = Math.max(0, Math.min(FAMILY_MAX_MEMBERS - 1, opts.memberProUpgrades));
  return FAMILY_PRICE_CAD + upgrades * FAMILY_MEMBER_PRO_UPGRADE_CAD;
}
