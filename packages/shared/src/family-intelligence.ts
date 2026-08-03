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
      `Up to ${FAMILY_MAX_MEMBERS} members — Live Family Intelligence Map`,
      "Place, Drive & Destination Intelligence™",
      "Family Flow™ + Something’s Different™ + Normal Life Model™",
      "Basic personal Digital Twin for each member",
    ],
  },
  {
    id: "family_member_pro",
    name: "Family Member Pro Upgrade",
    priceCad: FAMILY_MEMBER_PRO_UPGRADE_CAD,
    priceLabel: FAMILY_MEMBER_PRO_UPGRADE_LABEL,
    summary: "Invited member upgrades their private Digital Twin to full Pro for only $5/month.",
    includes: [
      "Full private MyMotiveLife Pro for that member",
      "Their personal MyMotiveLife data remains private",
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

/** Household relationship labels shown on Family Map pins / member sheets. */
export const FAMILY_RELATIONSHIP_PRESETS = [
  "Wife",
  "Husband",
  "Partner",
  "Mom",
  "Dad",
  "Son",
  "Daughter",
  "Brother",
  "Sister",
  "Grandmother",
  "Grandfather",
  "Granddaughter",
  "Grandson",
  "Aunt",
  "Uncle",
  "Cousin",
  "Mother-in-law",
  "Father-in-law",
  "Other",
] as const;

export type FamilyRelationshipPreset = (typeof FAMILY_RELATIONSHIP_PRESETS)[number];

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
  id?: string;
  memberId?: string;
  memberName?: string;
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
  estimatedFuelCostCad?: number | null;
  estimatedFuelLitres?: number | null;
  estimatedFuelKwh?: number | null;
  startedAt?: string;
  endedAt?: string | null;
  startLat?: number | null;
  startLng?: number | null;
  endLat?: number | null;
  endLng?: number | null;
};

/** Unified history item for Life360-style Today / Month / Year. */
export type FamilyHistoryItem =
  | {
      kind: "drive";
      id: string;
      at: string;
      trip: DriveTripSummary;
    }
  | {
      kind: "stay";
      id: string;
      at: string;
      visit: FamilyPlaceVisitView & {
        placeLat?: number | null;
        placeLng?: number | null;
        placeRadiusM?: number | null;
      };
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

/** Map / presence API payload shapes */

export type FamilyMemberRole = "OWNER" | "MEMBER";

export type FamilyPlaceCategory =
  | "home"
  | "work"
  | "school"
  | "shop"
  | "sports"
  | "other";

export type FamilyMapMemberView = {
  id: string;
  displayName: string;
  /** Household relationship label — Wife, Son, Mom, etc. */
  relationshipLabel: string | null;
  role: FamilyMemberRole;
  color: string;
  isYou: boolean;
  isSimulated: boolean;
  locationSharingLevel: LocationSharingLevel;
  presence: FamilyMemberPresenceStatus;
  statusLabel: string;
  /** Null when privacy filters hide coordinates */
  lat: number | null;
  lng: number | null;
  speedKmh: number | null;
  headingDeg: number | null;
  batteryPercent: number | null;
  lastLocationAt: string | null;
  placeName: string | null;
  placeCategory: FamilyPlaceCategory | null;
  likelyDestination: string | null;
  destinationConfidence: number | null;
  etaMinutes: number | null;
  timeAtPlaceMinutes: number | null;
  driveScoreRecent: number | null;
  /** E.164-ish phone for Call/Message — household only, never sold */
  phoneNumber: string | null;
  /** Profile photo from User.avatarUrl — initials fallback when null */
  avatarUrl: string | null;
  vehicleLabel: string | null;
};

export type FamilyAreaAlert = {
  id: string;
  title: string;
  body: string;
  severity: "info" | "watch" | "warning";
  kind: "weather" | "traffic" | "emergency" | "road";
  memberId?: string | null;
  memberName?: string | null;
};

export type FamilyMemberWeather = {
  memberId: string;
  memberName: string;
  lat: number;
  lng: number;
  weather: {
    summary: string;
    tempC: number;
    feelsLikeC: number | null;
    windKmh: number;
    precipMm: number;
    code: number;
    severe: boolean;
  };
};

export type FamilyAreaIntel = {
  weather: {
    summary: string;
    tempC: number;
    feelsLikeC: number | null;
    windKmh: number;
    precipMm: number;
    code: number;
    severe: boolean;
  } | null;
  /** Live weather at each driving member's coordinates */
  memberWeather?: FamilyMemberWeather[];
  traffic: {
    level: "clear" | "slow" | "unknown";
    summary: string;
  };
  alerts: FamilyAreaAlert[];
  center: { lat: number; lng: number } | null;
  updatedAt: string;
};

export type FamilyVehicleView = {
  make: string;
  model: string;
  year: number | null;
  fuelType: "gas" | "diesel" | "hybrid" | "ev";
  engineSummary: string;
  litresPer100km: number | null;
  kwhPer100km: number | null;
  fuelPriceCadPerLitre: number;
  evPriceCadPerKwh: number;
};

export type FamilyFuelSummary = {
  monthCad: number;
  prevMonthCad: number;
  direction: "up" | "down" | "flat";
  tripCount: number;
};

export type FamilyPlaceView = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radiusM: number;
  category: FamilyPlaceCategory;
  /** Geofence: alert household on enter */
  notifyOnEnter: boolean;
  /** Geofence: alert household on leave */
  notifyOnLeave: boolean;
  visitCount: number;
  averageVisitMinutes: number;
  lastVisitedAt: string | null;
  mostCommonVisitorName: string | null;
  membersHeadingThere: number;
  insight: string | null;
};

/** Closed or live place stay for Today timeline / history. */
export type FamilyPlaceVisitView = {
  id: string;
  memberId: string;
  placeName: string;
  arrivedAt: string;
  departedAt: string | null;
  dwellMinutes: number;
  isActive: boolean;
  placeId?: string | null;
  /** Coordinates for map (saved place or unsaved stop) */
  placeLat?: number | null;
  placeLng?: number | null;
  placeRadiusM?: number | null;
};

export type FamilyMapState = {
  household: {
    id: string;
    name: string;
    inviteCode: string;
    isOwner: boolean;
    memberCount: number;
    maxMembers: number;
  };
  you: {
    memberId: string;
    locationSharingLevel: LocationSharingLevel;
    shareDrivingData: boolean;
    sharePlaceHistory: boolean;
    shareRoutineLearning: boolean;
    shareFamilyInsights: boolean;
    /** Feed own movement into private Digital Twin / Money / Travel */
    shareDigitalTwinIntegration: boolean;
    memberKind: "ADULT" | "TEEN" | "CHILD";
    vehicle: FamilyVehicleView | null;
    fuelSummary: FamilyFuelSummary;
  };
  members: FamilyMapMemberView[];
  places: FamilyPlaceView[];
  recentTrips: DriveTripSummary[];
  /** Your place stays today (cloud) — fills Today even when backgrounded */
  placeVisitsToday: FamilyPlaceVisitView[];
  flow: FamilyFlowSummary;
  somethingDifferent: {
    memberName: string;
    title: string;
    body: string;
    tone: string;
  } | null;
  areaIntel: FamilyAreaIntel;
  updatedAt: string;
};

export function computeDriveScore(input: {
  hardBraking: number;
  rapidAcceleration: number;
  unusualRouteEvents: number;
  maxSpeedKmh: number;
}): number {
  let score = 100;
  score -= input.hardBraking * 4;
  score -= input.rapidAcceleration * 3;
  score -= input.unusualRouteEvents * 5;
  if (input.maxSpeedKmh > 110) score -= Math.min(20, (input.maxSpeedKmh - 110) * 0.4);
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function presenceFromSpeed(speedKmh: number | null | undefined): FamilyMemberPresenceStatus {
  if (speedKmh == null || Number.isNaN(speedKmh)) return "unknown";
  if (speedKmh >= 20) return "driving";
  if (speedKmh >= 3) return "moving";
  return "stationary";
}

/** Haversine distance in kilometres */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatEtaClock(from: Date, etaMinutes: number): string {
  const arrival = new Date(from.getTime() + etaMinutes * 60_000);
  return arrival.toLocaleTimeString("en-CA", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function approximateCoordinate(lat: number, lng: number): { lat: number; lng: number } {
  // ~1.1 km fuzz
  const fuzz = 0.01;
  const seed = Math.abs(Math.sin(lat * 12.9898 + lng * 78.233) * 43758.5453);
  const frac = seed - Math.floor(seed);
  return {
    lat: lat + (frac - 0.5) * fuzz,
    lng: lng + (frac - 0.5) * fuzz * 1.2,
  };
}
