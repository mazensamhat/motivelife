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
];
export const FAMILY_SUPPORTING_LINE = "See where your family is, understand how they move, discover the patterns shaping their lives, and let AI help everyone stay one step ahead.";
export const FAMILY_INTERNAL_PRINCIPLE = "Life360 maps where your family goes. MyMotiveFamily understands how your family lives.";
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
export const FAMILY_PLANS = [
    {
        id: "life_pro",
        name: "MyMotiveLife Pro",
        priceCad: LIFE_PRO_PRICE_CAD,
        priceLabel: LIFE_PRO_PRICE_LABEL,
        summary: "14-day free trial · includes free Family Map · no card",
        includes: [
            "Digital Twin™ + Places + Movement",
            "Life Probability Engine™ + Future Simulator™",
            "Daily Life Brief™ + Invisible Patterns",
            "Free Family Map + speed included",
            "Then $14.99 CAD/mo via Stripe",
        ],
    },
    {
        id: "family",
        name: "MyMotiveFamily",
        priceCad: FAMILY_PRICE_CAD,
        priceLabel: FAMILY_PRICE_LABEL,
        summary: "Owner Pro + Family for up to 6 · members included free",
        includes: [
            "Free forever: live Family Map + driving speed",
            "Family Intelligence: history, Drive Score, Inbox, AI",
            "Full MyMotiveLife Pro for the household owner",
            `Up to ${FAMILY_MAX_MEMBERS} members — Family experience included`,
            "Family Flow™ + Something’s Different™",
        ],
    },
    {
        id: "family_member_pro",
        name: "Family Pro Upgrade",
        priceCad: FAMILY_MEMBER_PRO_UPGRADE_CAD,
        priceLabel: FAMILY_MEMBER_PRO_UPGRADE_LABEL,
        summary: "Full personal Pro for active Family members · household discount",
        includes: [
            "Full private MyMotiveLife Pro (Digital Twin + Life OS)",
            `Household price vs ${LIFE_PRO_PRICE_LABEL} standalone`,
            "Requires an active MyMotiveFamily household",
            "Personal Twin data stays private — owner never owns it",
            "No free trial — Family Map is already free",
        ],
    },
];
/** Free Family Map tier — product freemium (not a Stripe SKU). */
export const FAMILY_FREE_MAP = {
    name: "Family Map Free",
    priceCad: 0,
    priceLabel: "$0 forever",
    summary: "Live household location + speed. No card. Upgrade when you want intelligence.",
    includes: [
        "Live Family Intelligence Map (location + speed)",
        `Up to ${FAMILY_MAX_MEMBERS} members`,
        "Share when you choose — privacy levels included",
    ],
};
/** Location sharing granularity — member-controlled. */
export const LOCATION_SHARING_LEVELS = [
    "precise",
    "approximate",
    "destination_only",
    "eta_only",
    "driving_status_only",
    "off",
];
export const LOCATION_SHARING_LABELS = {
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
];
/** Separate consent dimensions beyond live location. */
export const FAMILY_DATA_CONSENTS = [
    "driving_data",
    "place_history",
    "routine_learning",
    "family_insights",
    "digital_twin_integration",
];
export const FAMILY_DATA_CONSENT_LABELS = {
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
];
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
];
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
];
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
];
export function driveScoreBand(score) {
    if (score >= 85)
        return "safe";
    if (score >= 70)
        return "caution";
    return "review";
}
export function estimateHouseholdMrrCad(opts) {
    if (!opts.ownerFamily)
        return 0;
    const upgrades = Math.max(0, Math.min(FAMILY_MAX_MEMBERS - 1, opts.memberProUpgrades));
    return FAMILY_PRICE_CAD + upgrades * FAMILY_MEMBER_PRO_UPGRADE_CAD;
}
export const FAMILY_FREE_LIMITS_COPY = "Free Family Map shows who’s where and how fast they’re going. Upgrade for history, Drive Score, alerts, and Family Intelligence.";
export function familyEntitlementsForOwnerPlan(opts) {
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
export function computeDriveScore(input) {
    let score = 100;
    score -= input.hardBraking * 4;
    score -= input.rapidAcceleration * 3;
    score -= input.unusualRouteEvents * 5;
    const capped = sanitizeSpeedKmh(input.maxSpeedKmh) ?? 0;
    if (capped > 110)
        score -= Math.min(20, (capped - 110) * 0.4);
    return Math.max(0, Math.min(100, Math.round(score)));
}
/**
 * GPS sometimes reports absurd speeds (thousands of km/h). Cap to a
 * road-realistic ceiling so reports never show "1636 km/h".
 */
export const FAMILY_MAX_PLAUSIBLE_SPEED_KMH = 200;
export function sanitizeSpeedKmh(speed) {
    if (speed == null || !Number.isFinite(speed) || speed < 0)
        return null;
    if (speed > FAMILY_MAX_PLAUSIBLE_SPEED_KMH)
        return null;
    return Math.round(speed * 10) / 10;
}
/** Human explanations for drive-event tiles (Household Event Mix). */
export const DRIVE_EVENT_EXPLAINERS = {
    topSpeed: {
        title: "Top speed",
        short: "Highest GPS speed on a drive this period (capped at realistic road speeds).",
        detail: "We take the peak speed from completed trips and ignore GPS glitches above 200 km/h. A high number isn’t automatically unsafe — highways and brief merges count too.",
    },
    hardBraking: {
        title: "Hard braking",
        short: "Sudden slowdowns (about 18+ km/h drop between location fixes).",
        detail: "Counted when speed drops sharply between two GPS samples. Can mean traffic, a light, a hazard, or an abrupt stop — not always “bad driving.”",
    },
    rapidAccel: {
        title: "Rapid acceleration",
        short: "Quick speed-ups (about 16+ km/h jump between location fixes).",
        detail: "Counted when speed rises sharply between samples — merging onto a highway or a hard launch from a light. Occasional spikes are normal; clusters are worth a calm check-in.",
    },
    unusual: {
        title: "Unusual route events",
        short: "Sudden-stop / hazard-style signals we flag during a drive.",
        detail: "Triggered when braking looks like a sudden stop or a cluster of hard brakes — the same family of signals that can create a road-hazard heads-up. Unusual ≠ emergency; it’s a nudge to glance at the map.",
    },
    phone: {
        title: "Phone usage",
        short: "Distracted-driving detection is coming soon.",
        detail: "We’re not estimating phone use from GPS alone. When this lands, it will use on-device signals — not guesswork — and stay open on MyMotiveFamily (no Silver lock).",
    },
};
export function presenceFromSpeed(speedKmh) {
    if (speedKmh == null || Number.isNaN(speedKmh))
        return "unknown";
    if (speedKmh >= 20)
        return "driving";
    // Slightly above GPS crawl / indoor Doppler noise so sitting still doesn't
    // flip to "Walking" on a leftover 3–5 km/h reading.
    if (speedKmh >= 4.5)
        return "moving";
    return "stationary";
}
/** Haversine distance in kilometres */
export function haversineKm(lat1, lng1, lat2, lng2) {
    const toRad = (d) => (d * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
export function formatEtaClock(from, etaMinutes) {
    const arrival = new Date(from.getTime() + etaMinutes * 60_000);
    return arrival.toLocaleTimeString("en-CA", {
        hour: "numeric",
        minute: "2-digit",
    });
}
export function approximateCoordinate(lat, lng) {
    // ~1.1 km fuzz
    const fuzz = 0.01;
    const seed = Math.abs(Math.sin(lat * 12.9898 + lng * 78.233) * 43758.5453);
    const frac = seed - Math.floor(seed);
    return {
        lat: lat + (frac - 0.5) * fuzz,
        lng: lng + (frac - 0.5) * fuzz * 1.2,
    };
}
