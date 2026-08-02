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
/** CAD monthly list prices — keep marketing + ops analytics in sync. */
export declare const LIFE_PRO_PRICE_CAD = 14.99;
export declare const FAMILY_PRICE_CAD = 19.99;
export declare const FAMILY_MEMBER_PRO_UPGRADE_CAD = 5;
export declare const LIFE_PRO_PRICE_LABEL = "$14.99 CAD/month";
export declare const FAMILY_PRICE_LABEL = "$19.99 CAD/month";
export declare const FAMILY_MEMBER_PRO_UPGRADE_LABEL = "+$5 CAD/month";
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
/** Location sharing granularity — member-controlled. */
export declare const LOCATION_SHARING_LEVELS: readonly ["precise", "approximate", "destination_only", "eta_only", "driving_status_only", "off"];
export type LocationSharingLevel = (typeof LOCATION_SHARING_LEVELS)[number];
export declare const LOCATION_SHARING_LABELS: Record<LocationSharingLevel, string>;
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
export declare const FAMILY_MVP_FEATURES: readonly ["Intelligent Family Map™", "Live location & history", "Places, arrival/departure, speed", "Trip history & Drive Score", "Place Intelligence™", "Who’s Going There?™", "Family Flow™", "Destination Prediction™", "Normal Life Model™", "Something’s Different™", "Smart Departure™", "Weekly Family Intelligence", "MyMotiveLife Digital Twin integration"];
export declare const FAMILY_PHASE_TWO_FEATURES: readonly ["Family Future™", "Schedule optimization", "Advanced Family Patterns", "Family Time Intelligence™", "Life Impact depth", "Household spending/location correlations", "Shared shopping intelligence", "AI trip consolidation", "Predictive traffic behavior", "Advanced driving intelligence"];
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
export declare function driveScoreBand(score: number): DriveScoreBand;
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
    phoneNumber: string | null;
    /** Profile photo from User.avatarUrl — initials fallback when null */
    avatarUrl: string | null;
};
export type FamilyAreaAlert = {
    id: string;
    title: string;
    body: string;
    severity: "info" | "watch" | "warning";
    kind: "weather" | "traffic" | "emergency" | "road";
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
    traffic: {
        level: "clear" | "slow" | "unknown";
        summary: string;
    };
    alerts: FamilyAreaAlert[];
    center: {
        lat: number;
        lng: number;
    } | null;
    updatedAt: string;
};
export type FamilyPlaceView = {
    id: string;
    name: string;
    lat: number;
    lng: number;
    radiusM: number;
    category: FamilyPlaceCategory;
    visitCount: number;
    averageVisitMinutes: number;
    lastVisitedAt: string | null;
    mostCommonVisitorName: string | null;
    membersHeadingThere: number;
    insight: string | null;
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
        memberKind: "ADULT" | "TEEN" | "CHILD";
    };
    members: FamilyMapMemberView[];
    places: FamilyPlaceView[];
    recentTrips: DriveTripSummary[];
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
export declare function computeDriveScore(input: {
    hardBraking: number;
    rapidAcceleration: number;
    unusualRouteEvents: number;
    maxSpeedKmh: number;
}): number;
export declare function presenceFromSpeed(speedKmh: number | null | undefined): FamilyMemberPresenceStatus;
/** Haversine distance in kilometres */
export declare function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number;
export declare function formatEtaClock(from: Date, etaMinutes: number): string;
export declare function approximateCoordinate(lat: number, lng: number): {
    lat: number;
    lng: number;
};
