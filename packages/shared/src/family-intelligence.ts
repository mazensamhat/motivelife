/**
 * KINZO AI — Family Intelligence platform primitives.
 * Display name is KINZO AI; MyMotiveFamily remains the legal / Stripe SKU name.
 */

export const FAMILY_PRODUCT_NAME = "KINZO AI";
/** Legal / Stripe / App Store SKU — use in privacy, terms, and billing footnotes. */
export const FAMILY_PRODUCT_LEGAL_NAME = "MyMotiveFamily";
export const FAMILY_CATEGORY = "Family Intelligence";
export const FAMILY_POWERED_BY = "MotiveLife";

export const FAMILY_HERO_LINES = [
  "Your Family.",
  "Connected. Understood. One Step Ahead.",
] as const;

export const FAMILY_SUPPORTING_LINE =
  "See where your family is, understand how they move, discover the patterns shaping their lives, and let AI help everyone stay one step ahead.";

export const FAMILY_INTERNAL_PRINCIPLE =
  "Life360 maps where your family goes. KINZO AI understands how your family lives.";

/**
 * CAD monthly list prices — keep marketing + ops analytics in sync.
 *
 * Anti-arbitrage: invited members get Family free, but full standalone Pro is
 * never $5. Household discount is $9.99 vs $14.99 list — still a real family
 * benefit without making stranger “fake families” economically attractive.
 */
export const LIFE_PRO_PRICE_CAD = 14.99;
export const FAMILY_PRICE_CAD = 19.99;
export const FAMILY_MEMBER_PRO_UPGRADE_CAD = 9.99;

export const LIFE_PRO_PRICE_LABEL = "$14.99 CAD / month";
export const FAMILY_PRICE_LABEL = "$19.99 CAD / month";
export const FAMILY_MEMBER_PRO_UPGRADE_LABEL = "$9.99 CAD / month";

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
    summary: "14-day free trial · no card · personal Life OS",
    includes: [
      "DayO, LifeVue, UPLIFT, Kashu, Vitalu & VYRA — one connected Life OS",
      "Digital Twin™ · Places · Movement · Life Graph",
      "VYRA Chief of Staff consults money, health, goals & calendar",
      "Free KINZO live map + speed for your household",
      "Then $14.99 CAD/mo · cancel anytime",
    ],
  },
  {
    id: "family",
    name: "KINZO AI",
    priceCad: FAMILY_PRICE_CAD,
    priceLabel: FAMILY_PRICE_LABEL,
    summary: "Live now · owner Pro + Family for up to 6",
    includes: [
      "Free forever: live KINZO map, speed & household invites",
      "Family Intelligence: history, Drive Score, place alerts & AI inbox",
      "Family Flow™, Something's Different™ & Normal Life learning",
      "Full MyMotiveLife Pro for the household owner",
      `Up to ${FAMILY_MAX_MEMBERS} members — Family experience included free`,
    ],
  },
  {
    id: "family_member_pro",
    name: "Family Pro Upgrade",
    priceCad: FAMILY_MEMBER_PRO_UPGRADE_CAD,
    priceLabel: FAMILY_MEMBER_PRO_UPGRADE_LABEL,
    summary: "Full personal Pro for active KINZO members",
    includes: [
      "Private MyMotiveLife Pro — DayO, LifeVue, Kashu, Vitalu, UPLIFT & VYRA",
      "Your Digital Twin & Life OS — never visible to the household owner",
      `Household price vs ${LIFE_PRO_PRICE_LABEL} standalone`,
      "Requires an active KINZO AI household",
      "Upgrade anytime from Settings while Family is active",
    ],
  },
];

/** Free KINZO map tier — product freemium (not a Stripe SKU). */
export const FAMILY_FREE_MAP = {
  name: "KINZO Map Free",
  priceCad: 0,
  priceLabel: "$0 forever",
  summary: "Live household location + speed. No card. Upgrade when you want intelligence.",
  includes: [
    "Live KINZO map (location + speed)",
    `Up to ${FAMILY_MAX_MEMBERS} members`,
    "Share when you choose — privacy levels included",
  ],
} as const;

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
  "Family logistics AI",
  "Family Time Intelligence™",
  "Weekly Family Intelligence",
  "MyMotiveLife Digital Twin integration",
] as const;

export const FAMILY_PHASE_TWO_FEATURES = [
  "Family Future™",
  "Schedule optimization",
  "Advanced Family Patterns",
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

/** Smart Departure™ — leave-by recommendation for the viewer. */
export type FamilySmartDeparture = {
  leaveByLabel: string;
  arriveByLabel: string;
  destinationName: string;
  etaMinutes: number;
  trafficBufferMin: number;
  rationale: string;
};

/** Per-person Normal Life™ card — learned place/time rhythm. */
export type FamilyMemberNormal = {
  memberId: string;
  displayName: string;
  placeName: string | null;
  usualArriveLabel: string | null;
  usualLeaveLabel: string | null;
  /**
   * Minutes until usual leave from current place (when stationary + rhythm ready).
   * Used for “Coming up” leave countdowns — null when unknown.
   */
  leaveInMinutes?: number | null;
  sampleCount: number;
  status: "normal" | "learning" | "unusual";
  /** One calm line for Family Intelligence. */
  line: string;
};

/** Something’s Different™ — break from learned normal (not an emergency). */
export type FamilySomethingDifferent = {
  memberId: string | null;
  memberName: string;
  title: string;
  body: string;
  tone: string;
  kind: "late_leave";
  placeName: string | null;
  usualLeaveLabel: string | null;
  sampleCount: number;
  /** e.g. "Based on 14 Mondays" */
  confidenceLabel: string | null;
};

/** Family Time Intelligence™ — commute vs time at home with family. */
export type FamilyTimeIntel = {
  commuteMinPerDay: number;
  commuteDeltaMinPerDay: number | null;
  familyHomeHoursWeek: number;
  insight: string;
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
  /** App/phone in-use ticks while driving (0 when unknown). */
  phoneUsageEvents?: number;
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

/** Life360-style weekly driving report periods (Mon-start weeks). */
export type DrivingReportPeriod = "this_week" | "last_week" | "week_2" | "week_3";

export type DrivingReportMemberRow = {
  memberId: string;
  displayName: string;
  color: string;
  driveCount: number;
  distanceKm: number;
  hardBraking: number;
  rapidAcceleration: number;
  unusualRouteEvents: number;
  phoneUsageEvents: number;
  riskyEvents: number;
  topSpeedKmh: number;
  avgDriveScore: number | null;
  /** Learned routines — e.g. usual Work arrive time. */
  learningNotes?: string[];
  /** Rough fuel spend this period when vehicle profile is set. */
  estimatedFuelCostCad?: number | null;
};

export type DrivingReportTotals = {
  drives: number;
  distanceKm: number;
  hardBraking: number;
  rapidAcceleration: number;
  unusualRouteEvents: number;
  phoneUsageEvents: number;
  riskyEvents: number;
  topSpeedKmh: number;
  topSpeedMemberName: string | null;
  avgDriveScore: number | null;
};

export type DrivingReportDelta = {
  hardBraking: number;
  rapidAcceleration: number;
  unusualRouteEvents: number;
  phoneUsageEvents: number;
  riskyEvents: number;
  distanceKm: number;
  drives: number;
};

export type DrivingReport = {
  period: DrivingReportPeriod;
  label: string;
  rangeStart: string;
  rangeEnd: string;
  totals: DrivingReportTotals;
  members: DrivingReportMemberRow[];
  /** Plain-language household insight (rule-based Family Intelligence). */
  insight: string | null;
  /** Change vs the immediately previous week (negative = improvement for events). */
  vsPrevious: DrivingReportDelta | null;
  /** Per-person learning summary for the weekly "report ready" notification. */
  memberInsights?: Array<{
    memberId: string;
    displayName: string;
    summary: string;
  }>;
  /** Opening line of the weekly personal learning letter. */
  letterHeadline?: string | null;
  /** Short paragraphs for the household learning letter. */
  letterParagraphs?: string[];
};

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
  /**
   * Short “why” line for KINZO PREDICTS (e.g. heading + OD habit + time-of-day).
   * Optional — older clients ignore.
   */
  predictionWhy?: string | null;
  /**
   * Minutes until this member usually leaves their current place (routine).
   * Null when unknown / not at a learned place.
   */
  leaveInMinutes?: number | null;
  /** Historic median trip duration for this OD pair (learned), when known. */
  typicalEtaMinutes?: number | null;
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
  kind: "weather" | "traffic" | "emergency" | "road" | "air";
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

/** Live drive-impact event kinds shown as Route Orbs on Family Map. */
export type FamilyDriveEventKind =
  | "weather"
  | "traffic"
  | "construction"
  | "accident"
  | "hazard"
  | "police"
  | "closure"
  | "air"
  | "other";

/** Global air-quality snapshot (Open-Meteo). Scale picked by region. */
export type FamilyAirQuality = {
  aqi: number;
  scale: "us" | "european";
  category: string;
  level:
    | "good"
    | "moderate"
    | "unhealthy_sensitive"
    | "unhealthy"
    | "very_unhealthy"
    | "hazardous";
  severity: "info" | "watch" | "warning";
  summary: string;
  pm25: number | null;
  pm10: number | null;
  ozone: number | null;
  nitrogenDioxide: number | null;
  pollenMax: number | null;
  pollenLabel: string | null;
  usAqi: number | null;
  europeanAqi: number | null;
};

export type FamilyMemberAirQuality = {
  memberId: string;
  memberName: string;
  lat: number;
  lng: number;
  airQuality: FamilyAirQuality;
};

/** Animated glyph for Route Orbs (map-first, minimal text). */
export type FamilyDriveEventVisual =
  | "sun"
  | "partly_cloudy"
  | "cloud"
  | "fog"
  | "drizzle"
  | "rain"
  | "snow"
  | "storm"
  | "traffic"
  | "air"
  | "construction"
  | "accident"
  | "hazard"
  | "closure"
  | "police"
  | "other";

export type FamilyDriveEvent = {
  id: string;
  kind: FamilyDriveEventKind;
  title: string;
  detail: string;
  severity: "info" | "watch" | "warning";
  memberId: string | null;
  memberName: string | null;
  lat: number;
  lng: number;
  /** Estimated delay in minutes (positive = later arrival). */
  etaDeltaMin: number | null;
  /** Rough distance ahead of the driver, when known. */
  distanceAheadKm: number | null;
  /** Compact value on the orb — e.g. "33°", "62", "18". */
  badge?: string | null;
  /** Which animated glyph to render on the map. */
  visual?: FamilyDriveEventVisual | null;
};

/** Household drive-impact brief — Route Orbs + Family Intelligence embed. */
export type FamilyDriveImpact = {
  primaryMemberId: string | null;
  primaryMemberName: string | null;
  headline: string;
  summary: string;
  etaMinutes: number | null;
  etaWasMinutes: number | null;
  etaDeltaMin: number;
  routeTint: "clear" | "weather" | "traffic" | "mixed";
  events: FamilyDriveEvent[];
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
  /** Global air quality at household center (Open-Meteo). */
  airQuality?: FamilyAirQuality | null;
  /** Air quality at each active driver's coordinates. */
  memberAirQuality?: FamilyMemberAirQuality[];
  traffic: {
    level: "clear" | "slow" | "unknown";
    summary: string;
  };
  alerts: FamilyAreaAlert[];
  /** Active-drive Route Orbs + ETA impact (null when nobody is driving with signals). */
  driveImpact?: FamilyDriveImpact | null;
  /**
   * Nearby regional road events (construction / incidents / closures)
   * from open feeds available for the driver's region (e.g. Ontario 511).
   * Not a full city congestion heatmap.
   */
  roadEvents?: FamilyDriveEvent[];
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

export type FamilyPlaceShape = "circle" | "square";

export type FamilyPlaceView = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radiusM: number;
  category: FamilyPlaceCategory;
  /** circle = radius; square/box = half-height (north) from center */
  shape: FamilyPlaceShape;
  /** Box only — degrees counter-clockwise from axis-aligned (0–360). */
  rotationDeg: number;
  /** Box only — east/north half-extent ratio (1 = square, >1 = wider). */
  aspectRatio: number;
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
  /**
   * Freemium: free = live map + speed only.
   * Family plan (household owner) unlocks intelligence for everyone in the household.
   */
  entitlements: FamilyEntitlements;
  you: {
    memberId: string;
    locationSharingLevel: LocationSharingLevel;
    shareDrivingData: boolean;
    sharePlaceHistory: boolean;
    shareRoutineLearning: boolean;
    shareFamilyInsights: boolean;
    /** Feed own movement into private Digital Twin / Money / Travel */
    shareDigitalTwinIntegration: boolean;
    /** Phone / inbox alerts you want about the rest of the household */
    alertArrive: boolean;
    alertLeave: boolean;
    alertDriving: boolean;
    alertRoadHazards: boolean;
    alertStillThere: boolean;
    alertNoShow: boolean;
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
  somethingDifferent: FamilySomethingDifferent | null;
  /** Per-member learned place/time normals for Family Intelligence cards. */
  normalLife: FamilyMemberNormal[];
  /** Viewer-scoped leave-by recommendation (calendar + ETA + traffic). */
  smartDeparture: FamilySmartDeparture | null;
  /** Viewer-scoped commute vs family-at-home signal. */
  familyTime: FamilyTimeIntel | null;
  /**
   * Unsaved stop clusters KINZO noticed — save with one tap.
   * Empty when learning or none qualify (min visits).
   */
  suggestedPlaces: FamilySuggestedPlace[];
  areaIntel: FamilyAreaIntel;
  updatedAt: string;
};

/** Frequent unsaved stop KINZO suggests turning into a Place. */
export type FamilySuggestedPlace = {
  id: string;
  label: string;
  lat: number;
  lng: number;
  visitCount: number;
  memberCount: number;
  usualWindowLabel: string | null;
};

/** What the household can use on Family Map. */
export type FamilyEntitlements = {
  /** Always true when in a household — live pins + speed. */
  liveMap: boolean;
  /**
   * Paid MyMotiveFamily on the household owner unlocks history, Drive Score,
   * weekly report, inbox, place alerts, no-show, temporary circles, intel KPIs.
   */
  intelligence: boolean;
  /** True when the current viewer can start Family checkout (household owner). */
  canUpgrade: boolean;
  plan: "free" | "family";
  upgradeHeadline: string;
  upgradeBody: string;
};

export const FAMILY_FREE_LIMITS_COPY =
  "Free Family Map shows who’s where and how fast they’re going. Upgrade for history, Drive Score, alerts, and Family Intelligence.";

export function familyEntitlementsForOwnerPlan(opts: {
  ownerHasFamilyPlan: boolean;
  viewerIsOwner: boolean;
}): FamilyEntitlements {
  if (opts.ownerHasFamilyPlan) {
    return {
      liveMap: true,
      intelligence: true,
      canUpgrade: false,
      plan: "family",
      upgradeHeadline: "",
      upgradeBody: "",
    };
  }
  return {
    liveMap: true,
    intelligence: false,
    canUpgrade: opts.viewerIsOwner,
    plan: "free",
    upgradeHeadline: "Unlock Family Intelligence",
    upgradeBody: opts.viewerIsOwner
      ? "Upgrade to MyMotiveFamily for drive history, Weekly Driving Report, Inbox alerts, place & no-show alerts, and AI household insights. Free keeps live location + speed only."
      : "Ask the household owner to upgrade to MyMotiveFamily. Free keeps live location + speed only.",
  };
}

export function computeDriveScore(input: {
  hardBraking: number;
  rapidAcceleration: number;
  unusualRouteEvents: number;
  maxSpeedKmh: number;
  phoneUsageEvents?: number;
}): number {
  let score = 100;
  // Aggressive GPS telematics are paused product-wide (too many false
  // positives on phones). Keep the weights for when COUNT_AGGRESSIVE_GPS_EVENTS
  // is re-enabled — until then callers pass zeros.
  score -= input.hardBraking * 3;
  score -= input.rapidAcceleration * 2;
  score -= input.unusualRouteEvents * 4;
  // Phone-in-use while driving is the trustworthy distraction signal.
  score -= Math.min(24, (input.phoneUsageEvents ?? 0) * 4);
  const capped = sanitizeSpeedKmh(input.maxSpeedKmh) ?? 0;
  // Highway posted 100–110 is common; only ding clearly excessive pace.
  if (capped > 125) score -= Math.min(16, (capped - 125) * 0.35);
  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * GPS sometimes reports absurd speeds (thousands of km/h). Cap to a
 * road-realistic ceiling so reports never show "195 km/h" from a teleport spike.
 * Ontario highways top out ~110–120 posted; 160 leaves room for true overspeed
 * without accepting GPS glitches in the 170–200 band.
 */
export const FAMILY_MAX_PLAUSIBLE_SPEED_KMH = 160;

export function sanitizeSpeedKmh(speed: number | null | undefined): number | null {
  if (speed == null || !Number.isFinite(speed) || speed < 0) return null;
  if (speed > FAMILY_MAX_PLAUSIBLE_SPEED_KMH) return null;
  return Math.round(speed * 10) / 10;
}

/** Human explanations for drive-event tiles (Household Event Mix). */
export const DRIVE_EVENT_EXPLAINERS = {
  topSpeed: {
    title: "Top speed",
    short: "Highest GPS speed on a drive this period (capped at realistic road speeds).",
    detail:
      "We take the peak speed from completed trips and ignore GPS glitches above 160 km/h. Highway 100–120 km/h is normal here — we only treat clearly excessive peaks as a watch.",
  },
  hardBraking: {
    title: "Hard braking",
    short: "Paused — phone GPS was too noisy for family trips.",
    detail:
      "We’re not counting hard brakes from phone GPS right now (too many false alarms at lights). Drive Score uses top speed + phone-in-use instead until we bring back sensor-backed braking.",
  },
  rapidAccel: {
    title: "Rapid acceleration",
    short: "Paused — phone GPS was too noisy for family trips.",
    detail:
      "Aggressive-launch detection from GPS alone was firing on ordinary merges. It’s off until we can trust it again — it won’t affect Drive Score.",
  },
  unusual: {
    title: "Unusual route events",
    short: "Paused — sudden-stop GPS heuristics were unreliable.",
    detail:
      "Highway sudden-stop guesses from phone GPS created clutter. Cleared for a clean baseline; road work still comes from regional open feeds on the map.",
  },
  phone: {
    title: "Phone usage",
    short: "Times the phone looked in use while driving.",
    detail:
      "On Android we count when the screen is on and unlocked at driving speed — even if MotiveLife is in the background. On iOS we count when MotiveLife is open on screen while driving (Apple doesn’t allow broader unlock/app monitoring without Screen Time entitlements). Cooldown prevents stacking ticks every second.",
  },
} as const;

/**
 * Presence from sanitized speed.
 * Walking is foot-speed only (~1.5–8 km/h). Car speeds must never read as Walking.
 * Aligns with trip start (~14 km/h) so 12–19 km/h isn't "Walking at 15".
 */
export function presenceFromSpeed(speedKmh: number | null | undefined): FamilyMemberPresenceStatus {
  if (speedKmh == null || Number.isNaN(speedKmh)) return "unknown";
  if (speedKmh >= 12) return "driving";
  // Real walking / slow jog. Above ~8 is bike/jog — still "moving", not Walking label.
  if (speedKmh >= 1.5) return "moving";
  return "stationary";
}

/** True walking pace for UI copy — bikes/jogs use "On the move". */
export function isWalkingPaceKmh(speedKmh: number | null | undefined): boolean {
  if (speedKmh == null || !Number.isFinite(speedKmh)) return false;
  return speedKmh >= 1.5 && speedKmh < 8;
}

export type MotionActivityHint = "stationary" | "walking" | "driving" | "unknown";

/**
 * Resolve presence for Family Map pins.
 * Prefers phone motion (steps) when available, then Doppler speed, then
 * displacement pace so the first steps of a walk still read as Walking
 * even when GPS speed is stuck at 0.
 */
export function resolvePresence(opts: {
  speedKmh: number | null | undefined;
  /** Distance moved since last sample (metres). */
  movedM?: number | null;
  /** Seconds since last sample. */
  dtSec?: number | null;
  /** Core Motion / Activity Recognition hint from the native shell. */
  activity?: MotionActivityHint | null;
  previousPresence?: FamilyMemberPresenceStatus | null;
}): FamilyMemberPresenceStatus {
  const speed =
    opts.speedKmh != null && Number.isFinite(opts.speedKmh) ? opts.speedKmh : null;
  const activity = opts.activity ?? null;

  // Core Motion often fires low-confidence "walking" on wake / pocket fidget.
  // Only trust it when Doppler or real pin movement also looks like a walk.
  if (activity === "walking" && (speed == null || speed < 14)) {
    const walked =
      (speed != null && speed >= 1.5) ||
      (opts.movedM != null && opts.movedM >= 25);
    if (walked) return "moving";
  }
  // Never treat automotive + null Doppler as driving — parked cars keep
  // reporting "automotive" and that froze kids at 95 km/h with a blue route.
  // Dense GPS (2–5s) often posts speed 0 while the pin clearly moves — trust
  // real displacement with automotive hint.
  if (activity === "driving") {
    if (speed != null && speed >= 8) return "driving";
    if (
      opts.movedM != null &&
      opts.movedM >= 35 &&
      opts.dtSec != null &&
      opts.dtSec >= 1.5 &&
      opts.dtSec <= 30
    ) {
      const dispKmh = opts.movedM / 1000 / (opts.dtSec / 3600);
      if (Number.isFinite(dispKmh) && dispKmh >= 10) return "driving";
    }
  }
  if (activity === "stationary" && (speed == null || speed < 1.5)) {
    return "stationary";
  }

  let presence = presenceFromSpeed(speed);

  // Doppler often stays 0 at walk/drive start — recover from pin movement.
  // Dense fused/iOS samples arrive every ~2–4s; requiring 6s blocked Driving
  // even while the pin moved 50–100m per hop.
  // Short trail/park hops (20–40m in a few seconds) invent ~30 km/h — require
  // a larger hop before displacement alone means Driving.
  if (
    (presence === "stationary" || presence === "unknown") &&
    opts.movedM != null &&
    opts.dtSec != null &&
    opts.dtSec >= 1.5 &&
    opts.dtSec <= 120 &&
    opts.movedM >= 20
  ) {
    const dispKmh = opts.movedM / 1000 / (opts.dtSec / 3600);
    if (Number.isFinite(dispKmh) && dispKmh >= 1.4 && dispKmh < 9) {
      presence = "moving";
    } else if (
      Number.isFinite(dispKmh) &&
      dispKmh >= 12 &&
      (opts.movedM >= 55 || (opts.dtSec >= 6 && opts.movedM >= 40))
    ) {
      presence = "driving";
    } else if (Number.isFinite(dispKmh) && dispKmh >= 9) {
      presence = "moving";
    }
  }

  // Hysteresis: keep Walking through brief GPS zeros mid-walk — but only with
  // meaningful movement (4m was matching sitting jitter after login).
  if (
    presence === "stationary" &&
    opts.previousPresence === "moving" &&
    (speed == null || speed < 12) &&
    activity !== "stationary" &&
    activity !== "driving"
  ) {
    if (opts.movedM != null && opts.movedM >= 12) {
      presence = "moving";
    }
  }

  // Keep Driving through brief Doppler zeros mid-drive — but NOT parking-lot
  // multipath (8–25 m hops) which blocked "arrived Home".
  if (
    presence === "stationary" &&
    opts.previousPresence === "driving" &&
    activity !== "stationary"
  ) {
    const stillMoving =
      opts.movedM != null &&
      opts.movedM >= 40 &&
      opts.dtSec != null &&
      opts.dtSec <= 18 &&
      (speed == null || speed < 12);
    const notParked = (speed != null && speed >= 8) || stillMoving;
    if (notParked) {
      presence = "driving";
    }
  }

  return presence;
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
