/**
 * MyMotiveFamily™ — Family Intelligence platform primitives.
 * Canonical pricing, privacy, engines, and MVP scope for product + marketing.
 */
export declare const FAMILY_PRODUCT_NAME = "MyMotiveFamily";
export declare const FAMILY_CATEGORY = "Family Intelligence";
export declare const FAMILY_POWERED_BY = "MyMotiveLife";
export declare const FAMILY_HERO_LINES: readonly ["Your Family.", "Connected. Understood. One Step Ahead."];
export declare const FAMILY_SUPPORTING_LINE = "See where your family is, understand how they move, discover the patterns shaping their lives, and let AI help everyone stay one step ahead.";
export declare const FAMILY_INTERNAL_PRINCIPLE = "Life360 maps where your family goes. MyMotiveFamily understands how your family lives.";
/**
 * CAD monthly list prices — keep marketing + ops analytics in sync.
 *
 * Anti-arbitrage: invited members get Family free, but full standalone Pro is
 * never $5. Household discount is $9.99 vs $14.99 list — still a real family
 * benefit without making stranger “fake families” economically attractive.
 */
export declare const LIFE_PRO_PRICE_CAD = 14.99;
export declare const FAMILY_PRICE_CAD = 19.99;
export declare const FAMILY_MEMBER_PRO_UPGRADE_CAD = 9.99;
export declare const LIFE_PRO_PRICE_LABEL = "$14.99 CAD / month";
export declare const FAMILY_PRICE_LABEL = "$19.99 CAD / month";
export declare const FAMILY_MEMBER_PRO_UPGRADE_LABEL = "$9.99 CAD / month";
/** Soft cap for invited household seats at launch. */
export declare const FAMILY_MAX_MEMBERS = 6;
export type FamilyPlanId = "life_pro" | "family" | "family_member_pro";
export type FamilyPlanDefinition = {
    id: FamilyPlanId;
    name: string;
    priceCad: number;
    priceLabel: string;
    summary: string;
    includes: string[];
};
export declare const FAMILY_PLANS: FamilyPlanDefinition[];
/** Free Family Map tier — product freemium (not a Stripe SKU). */
export declare const FAMILY_FREE_MAP: {
    readonly name: "Family Map Free";
    readonly priceCad: 0;
    readonly priceLabel: "$0 forever";
    readonly summary: "Live household location + speed. No card. Upgrade when you want intelligence.";
    readonly includes: readonly ["Live Family Intelligence Map (location + speed)", "Up to 6 members", "Share when you choose — privacy levels included"];
};
/** Location sharing granularity — member-controlled. */
export declare const LOCATION_SHARING_LEVELS: readonly ["precise", "approximate", "destination_only", "eta_only", "driving_status_only", "off"];
export type LocationSharingLevel = (typeof LOCATION_SHARING_LEVELS)[number];
export declare const LOCATION_SHARING_LABELS: Record<LocationSharingLevel, string>;
/** Household relationship labels shown on Family Map pins / member sheets. */
export declare const FAMILY_RELATIONSHIP_PRESETS: readonly ["Wife", "Husband", "Partner", "Mom", "Dad", "Son", "Daughter", "Brother", "Sister", "Grandmother", "Grandfather", "Granddaughter", "Grandson", "Aunt", "Uncle", "Cousin", "Mother-in-law", "Father-in-law", "Other"];
export type FamilyRelationshipPreset = (typeof FAMILY_RELATIONSHIP_PRESETS)[number];
/** Separate consent dimensions beyond live location. */
export declare const FAMILY_DATA_CONSENTS: readonly ["driving_data", "place_history", "routine_learning", "family_insights", "digital_twin_integration"];
export type FamilyDataConsent = (typeof FAMILY_DATA_CONSENTS)[number];
export declare const FAMILY_DATA_CONSENT_LABELS: Record<FamilyDataConsent, string>;
export declare const FAMILY_INTELLIGENCE_ENGINES: readonly [{
    readonly id: "location";
    readonly name: "Location Engine™";
    readonly role: "Understands where people are and where they’ve been.";
}, {
    readonly id: "place";
    readonly name: "Place Intelligence™";
    readonly role: "Understands what locations mean and how they’re used.";
}, {
    readonly id: "drive";
    readonly name: "Drive Intelligence™";
    readonly role: "Understands movement and driving behavior.";
}, {
    readonly id: "destination";
    readonly name: "Destination Prediction™";
    readonly role: "Estimates where someone is heading.";
}, {
    readonly id: "normal_life";
    readonly name: "Normal Life Model™";
    readonly role: "Learns ordinary behavior for each consenting member.";
}, {
    readonly id: "pattern";
    readonly name: "Pattern Intelligence™";
    readonly role: "Identifies meaningful changes and relationships.";
}, {
    readonly id: "family_flow";
    readonly name: "Family Flow™";
    readonly role: "Understands the household as a coordinated system.";
}, {
    readonly id: "life_impact";
    readonly name: "Life Impact Engine™";
    readonly role: "Connects location and movement back to the individual’s Digital Twin.";
}];
export type FamilyEngineId = (typeof FAMILY_INTELLIGENCE_ENGINES)[number]["id"];
/** Features intentionally deferred — operational/compliance complexity. */
export declare const FAMILY_OUT_OF_SCOPE_V1: readonly ["Roadside assistance", "Insurance products", "Identity theft reimbursement", "Towing", "Emergency dispatch infrastructure", "Hardware trackers", "Travel insurance", "Stolen phone reimbursement"];
export declare const FAMILY_MVP_FEATURES: readonly ["Intelligent Family Map™", "Live location & history", "Places, arrival/departure, speed", "Trip history & Drive Score", "Place Intelligence™", "Who’s Going There?™", "Family Flow™", "Destination Prediction™", "Normal Life Model™", "Something’s Different™", "Smart Departure™", "Family logistics AI", "Family Time Intelligence™", "Weekly Family Intelligence", "MyMotiveLife Digital Twin integration"];
export declare const FAMILY_PHASE_TWO_FEATURES: readonly ["Family Future™", "Schedule optimization", "Advanced Family Patterns", "Life Impact depth", "Household spending/location correlations", "Shared shopping intelligence", "AI trip consolidation", "Predictive traffic behavior", "Advanced driving intelligence"];
export type FamilyMemberPresenceStatus = "stationary" | "moving" | "driving" | "unknown";
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
export type FamilyHistoryItem = {
    kind: "drive";
    id: string;
    at: string;
    trip: DriveTripSummary;
} | {
    kind: "stay";
    id: string;
    at: string;
    visit: FamilyPlaceVisitView & {
        placeLat?: number | null;
        placeLng?: number | null;
        placeRadiusM?: number | null;
    };
};
export declare function driveScoreBand(score: number): DriveScoreBand;
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
    riskyEvents: number;
    topSpeedKmh: number;
    avgDriveScore: number | null;
};
export type DrivingReportTotals = {
    drives: number;
    distanceKm: number;
    hardBraking: number;
    rapidAcceleration: number;
    unusualRouteEvents: number;
    riskyEvents: number;
    topSpeedKmh: number;
    topSpeedMemberName: string | null;
    avgDriveScore: number | null;
};
export type DrivingReportDelta = {
    hardBraking: number;
    rapidAcceleration: number;
    unusualRouteEvents: number;
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
};
export declare function estimateHouseholdMrrCad(opts: {
    ownerFamily: boolean;
    memberProUpgrades: number;
}): number;
/** Map / presence API payload shapes */
export type FamilyMemberRole = "OWNER" | "MEMBER";
export type FamilyPlaceCategory = "home" | "work" | "school" | "shop" | "sports" | "other";
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
/** Live drive-impact event kinds shown as Route Orbs on Family Map. */
export type FamilyDriveEventKind = "weather" | "traffic" | "construction" | "accident" | "hazard" | "police" | "closure" | "other";
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
    traffic: {
        level: "clear" | "slow" | "unknown";
        summary: string;
    };
    alerts: FamilyAreaAlert[];
    /** Active-drive Route Orbs + ETA impact (null when nobody is driving with signals). */
    driveImpact?: FamilyDriveImpact | null;
    center: {
        lat: number;
        lng: number;
    } | null;
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
    /** circle = radius; square = half-side length from center */
    shape: FamilyPlaceShape;
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
        /** Alerts you want about the rest of the household */
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
    somethingDifferent: {
        memberName: string;
        title: string;
        body: string;
        tone: string;
    } | null;
    /** Viewer-scoped leave-by recommendation (calendar + ETA + traffic). */
    smartDeparture: FamilySmartDeparture | null;
    /** Viewer-scoped commute vs family-at-home signal. */
    familyTime: FamilyTimeIntel | null;
    areaIntel: FamilyAreaIntel;
    updatedAt: string;
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
export declare const FAMILY_FREE_LIMITS_COPY = "Free Family Map shows who\u2019s where and how fast they\u2019re going. Upgrade for history, Drive Score, alerts, and Family Intelligence.";
export declare function familyEntitlementsForOwnerPlan(opts: {
    ownerHasFamilyPlan: boolean;
    viewerIsOwner: boolean;
}): FamilyEntitlements;
export declare function computeDriveScore(input: {
    hardBraking: number;
    rapidAcceleration: number;
    unusualRouteEvents: number;
    maxSpeedKmh: number;
}): number;
/**
 * GPS sometimes reports absurd speeds (thousands of km/h). Cap to a
 * road-realistic ceiling so reports never show "1636 km/h".
 */
export declare const FAMILY_MAX_PLAUSIBLE_SPEED_KMH = 200;
export declare function sanitizeSpeedKmh(speed: number | null | undefined): number | null;
/** Human explanations for drive-event tiles (Household Event Mix). */
export declare const DRIVE_EVENT_EXPLAINERS: {
    readonly topSpeed: {
        readonly title: "Top speed";
        readonly short: "Highest GPS speed on a drive this period (capped at realistic road speeds).";
        readonly detail: "We take the peak speed from completed trips and ignore GPS glitches above 200 km/h. A high number isn’t automatically unsafe — highways and brief merges count too.";
    };
    readonly hardBraking: {
        readonly title: "Hard braking";
        readonly short: "Sharp slowdowns from road speed (~40+ km/h drop at ~0.5g, not normal light stops).";
        readonly detail: "Counted only when GPS shows a large, fast drop from ~50+ km/h with decent accuracy. Everyday traffic lights and gentle slowing usually won’t count — we bias toward fewer false alarms.";
    };
    readonly rapidAccel: {
        readonly title: "Rapid acceleration";
        readonly short: "Hard launches / merges (~42+ km/h jump to 55+, ~0.5g) — not every green light.";
        readonly detail: "Counted when speed rises sharply into real road speed with good GPS accuracy. Ordinary neighborhood starts are ignored so Drive Score stays calm.";
    };
    readonly unusual: {
        readonly title: "Unusual route events";
        readonly short: "Sudden-stop / hazard-style signals we flag during a drive.";
        readonly detail: "Triggered only for highway-class sudden stops or a long cluster of hard brakes. Unusual ≠ emergency; it’s a calm nudge to glance at the map — not a freak-out.";
    };
    readonly phone: {
        readonly title: "Phone usage";
        readonly short: "Distracted-driving detection is coming soon.";
        readonly detail: "We’re not estimating phone use from GPS alone. When this lands, it will use on-device signals — not guesswork — and stay open on MyMotiveFamily (no Silver lock).";
    };
};
export declare function presenceFromSpeed(speedKmh: number | null | undefined): FamilyMemberPresenceStatus;
/** True walking pace for UI copy — bikes/jogs use "On the move". */
export declare function isWalkingPaceKmh(speedKmh: number | null | undefined): boolean;
export type MotionActivityHint = "stationary" | "walking" | "driving" | "unknown";
/**
 * Resolve presence for Family Map pins.
 * Prefers phone motion (steps) when available, then Doppler speed, then
 * displacement pace so the first steps of a walk still read as Walking
 * even when GPS speed is stuck at 0.
 */
export declare function resolvePresence(opts: {
    speedKmh: number | null | undefined;
    /** Distance moved since last sample (metres). */
    movedM?: number | null;
    /** Seconds since last sample. */
    dtSec?: number | null;
    /** Core Motion / Activity Recognition hint from the native shell. */
    activity?: MotionActivityHint | null;
    previousPresence?: FamilyMemberPresenceStatus | null;
}): FamilyMemberPresenceStatus;
/** Haversine distance in kilometres */
export declare function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number;
export declare function formatEtaClock(from: Date, etaMinutes: number): string;
export declare function approximateCoordinate(lat: number, lng: number): {
    lat: number;
    lng: number;
};
