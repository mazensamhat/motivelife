/** Digital Twin profile, onboarding options, and engine helpers — shared */

export const TWIN_ACCURACY_LADDER = [18, 35, 62, 81, 96] as const;

export function twinAccuracyForStep(step: number, totalSteps: number): number {
  if (totalSteps <= 1) return TWIN_ACCURACY_LADDER[0];
  const t = Math.min(1, Math.max(0, (step - 1) / (totalSteps - 1)));
  const idx = Math.round(t * (TWIN_ACCURACY_LADDER.length - 1));
  return TWIN_ACCURACY_LADDER[idx] ?? TWIN_ACCURACY_LADDER[0];
}

export const DIGITAL_TWIN_STORAGE_VERSION = 1 as const;

export type AgeRangeId =
  | "under_25"
  | "25_34"
  | "35_44"
  | "45_54"
  | "55_64"
  | "65_plus";

export type RelationshipStatusId =
  | "single"
  | "relationship"
  | "married"
  | "partnered"
  | "divorced"
  | "widowed"
  | "prefer_not";

export type EmploymentTypeId =
  | "salary"
  | "hourly"
  | "commission"
  | "self_employed"
  | "business_owner"
  | "contractor"
  | "retired"
  | "unemployed"
  | "student";

export type WorkModeId = "remote" | "hybrid" | "office";

export type FutureGoalId =
  | "retire_early"
  | "buy_home"
  | "vacation_property"
  | "travel_more"
  | "start_business"
  | "marriage"
  | "children"
  | "lose_weight"
  | "pay_off_debt"
  | "career_change"
  | "financial_freedom"
  | "education"
  | "health";

export interface TwinIdentity {
  country?: string;
  region?: string;
  city?: string;
  ageRange?: AgeRangeId;
  relationshipStatus?: RelationshipStatusId;
  children?: number;
  languages?: string[];
  education?: string;
  homeOwnership?: "own" | "rent" | "family" | "other";
}

export interface TwinCareer {
  occupation?: string;
  industry?: string;
  employmentType?: EmploymentTypeId;
  employer?: string;
  yearsExperience?: number;
  typicalHours?: number;
  workMode?: WorkModeId;
  commuteMinutes?: number;
  grossIncomeBand?: string;
}

export interface TwinFinance {
  hasBudget?: boolean;
  hasEmergencyFund?: boolean;
  hasDebt?: boolean;
  hasInvestments?: boolean;
  notes?: string;
}

export interface TwinLifestyle {
  wakeTime?: string;
  sleepHours?: number;
  exerciseDaysPerWeek?: number;
  stressLevel?: number;
  meditation?: boolean;
  socialFrequency?: "low" | "medium" | "high";
  hobbies?: string[];
}

export interface TwinPersonality {
  riskTolerance?: "low" | "medium" | "high";
  planningStyle?: "planner" | "flexible" | "spontaneous";
  decisionMaking?: "analytical" | "intuitive" | "consultative";
  motivation?: "goals" | "habits" | "accountability" | "curiosity";
  financialBehaviour?: "saver" | "spender" | "investor" | "avoider";
}

export interface TwinTimelineEvent {
  id: string;
  year?: number;
  label: string;
}

export interface TwinConnected {
  wantsCalendar?: boolean;
  wantsHealth?: boolean;
  wantsBanking?: boolean;
  acknowledgedAutomation?: boolean;
}

export interface DigitalTwinProfile {
  version: typeof DIGITAL_TWIN_STORAGE_VERSION;
  updatedAt: string;
  onboardingCompletedAt?: string;
  identity?: TwinIdentity;
  career?: TwinCareer;
  finance?: TwinFinance;
  futures?: FutureGoalId[];
  lifestyle?: TwinLifestyle;
  personality?: TwinPersonality;
  timeline?: TwinTimelineEvent[];
  connected?: TwinConnected;
}

export const AGE_RANGE_OPTIONS: { id: AgeRangeId; label: string }[] = [
  { id: "under_25", label: "Under 25" },
  { id: "25_34", label: "25–34" },
  { id: "35_44", label: "35–44" },
  { id: "45_54", label: "45–54" },
  { id: "55_64", label: "55–64" },
  { id: "65_plus", label: "65+" },
];

export const RELATIONSHIP_OPTIONS: { id: RelationshipStatusId; label: string }[] = [
  { id: "single", label: "Single" },
  { id: "relationship", label: "In a relationship" },
  { id: "married", label: "Married" },
  { id: "partnered", label: "Partnered" },
  { id: "divorced", label: "Divorced" },
  { id: "widowed", label: "Widowed" },
  { id: "prefer_not", label: "Prefer not to say" },
];

export const EMPLOYMENT_OPTIONS: { id: EmploymentTypeId; label: string }[] = [
  { id: "salary", label: "Salary" },
  { id: "hourly", label: "Hourly" },
  { id: "commission", label: "Commission" },
  { id: "self_employed", label: "Self-employed" },
  { id: "business_owner", label: "Business owner" },
  { id: "contractor", label: "Contractor" },
  { id: "student", label: "Student" },
  { id: "retired", label: "Retired" },
  { id: "unemployed", label: "Between roles" },
];

export const FUTURE_GOAL_OPTIONS: { id: FutureGoalId; label: string; emoji: string }[] = [
  { id: "retire_early", label: "Retire early", emoji: "🌅" },
  { id: "buy_home", label: "Buy a home", emoji: "🏠" },
  { id: "vacation_property", label: "Vacation property", emoji: "🏝️" },
  { id: "travel_more", label: "Travel more", emoji: "✈️" },
  { id: "start_business", label: "Start a business", emoji: "🚀" },
  { id: "marriage", label: "Marriage", emoji: "💍" },
  { id: "children", label: "Children", emoji: "👶" },
  { id: "lose_weight", label: "Lose weight", emoji: "💪" },
  { id: "pay_off_debt", label: "Pay off debt", emoji: "💳" },
  { id: "career_change", label: "Career change", emoji: "🔄" },
  { id: "financial_freedom", label: "Financial freedom", emoji: "🗽" },
  { id: "education", label: "Education", emoji: "🎓" },
  { id: "health", label: "Better health", emoji: "❤️" },
];

export const TWIN_PHASE_IDS = [
  "focus",
  "identity",
  "career",
  "finance",
  "futures",
  "lifestyle",
  "personality",
  "timeline",
  "connected",
] as const;

export type TwinPhaseId = (typeof TWIN_PHASE_IDS)[number];

export function emptyDigitalTwin(): DigitalTwinProfile {
  return {
    version: DIGITAL_TWIN_STORAGE_VERSION,
    updatedAt: new Date().toISOString(),
  };
}

export function parseDigitalTwin(raw: unknown): DigitalTwinProfile | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (obj.version !== 1) return null;
  return raw as DigitalTwinProfile;
}

/** Extract twin from preferences JSON blob (nested under digitalTwin). */
export function twinFromPreferencesJson(preferencesJson: string | null | undefined): DigitalTwinProfile | null {
  if (!preferencesJson) return null;
  try {
    const prefs = JSON.parse(preferencesJson) as Record<string, unknown>;
    return parseDigitalTwin(prefs.digitalTwin);
  } catch {
    return null;
  }
}

export function computeTwinCompleteness(twin: DigitalTwinProfile | null | undefined): {
  percent: number;
  filledPhases: TwinPhaseId[];
  nextPhase: TwinPhaseId | null;
  nextHint: string;
} {
  const filled: TwinPhaseId[] = [];
  if (!twin) {
    return {
      percent: 18,
      filledPhases: [],
      nextPhase: "focus",
      nextHint: "Start Build My Digital Twin to raise prediction accuracy.",
    };
  }

  if (twin.futures?.length) filled.push("futures");
  if (twin.identity && (twin.identity.country || twin.identity.ageRange)) filled.push("identity");
  if (twin.career && (twin.career.occupation || twin.career.employmentType)) filled.push("career");
  if (twin.finance && (twin.finance.hasBudget != null || twin.finance.hasDebt != null)) filled.push("finance");
  if (twin.lifestyle && (twin.lifestyle.sleepHours != null || twin.lifestyle.stressLevel != null)) {
    filled.push("lifestyle");
  }
  if (twin.personality && (twin.personality.riskTolerance || twin.personality.planningStyle)) {
    filled.push("personality");
  }
  if (twin.timeline && twin.timeline.length > 0) filled.push("timeline");
  if (twin.connected?.acknowledgedAutomation) filled.push("connected");

  const ladder = [18, 35, 48, 62, 71, 81, 88, 93, 96];
  const percent = ladder[Math.min(filled.length, ladder.length - 1)] ?? 18;

  const order: TwinPhaseId[] = [
    "identity",
    "career",
    "finance",
    "futures",
    "lifestyle",
    "personality",
    "timeline",
    "connected",
  ];
  const nextPhase = order.find((p) => !filled.includes(p)) ?? null;
  const hints: Record<TwinPhaseId, string> = {
    focus: "Choose a life focus to begin.",
    identity: "Add where you live and your life stage.",
    career: "Add career intelligence for income and burnout predictions.",
    finance: "Tell your Twin about budget, debt, and investments.",
    futures: "What future are you trying to create?",
    lifestyle: "Add sleep, stress, and movement baselines.",
    personality: "How you decide shapes better guidance.",
    timeline: "Major life events explain behavioural shifts.",
    connected: "Connect calendar and health so automation can take over.",
  };

  return {
    percent,
    filledPhases: filled,
    nextPhase,
    nextHint: nextPhase ? hints[nextPhase] : "Your Digital Twin is highly complete — keep syncing daily signals.",
  };
}

export interface TwinOpportunity {
  id: string;
  title: string;
  detail: string;
  domain: "money" | "career" | "health" | "life";
  href?: string;
}

export function generateTwinOpportunities(twin: DigitalTwinProfile | null): TwinOpportunity[] {
  const out: TwinOpportunity[] = [];
  if (!twin) {
    return [
      {
        id: "start-twin",
        title: "Awaken your Digital Twin",
        detail: "Complete Build My Digital Twin so MotiveLife can find opportunities across money, career, and health.",
        domain: "life",
        href: "/dashboard",
      },
    ];
  }

  if (twin.finance?.hasDebt) {
    out.push({
      id: "debt-plan",
      title: "Debt payoff path",
      detail:
        "Your Twin sees debt on the profile. Mapping minimums vs extras in Money could shorten your payoff timeline.",
      domain: "money",
      href: "/kashu",
    });
  }
  if (twin.finance?.hasInvestments === false && twin.futures?.includes("retire_early")) {
    out.push({
      id: "invest-retire",
      title: "Retirement acceleration",
      detail:
        "Early retirement is a stated future, but investments aren’t marked yet. Even a small monthly amount compounds in your Twin’s projections.",
      domain: "money",
      href: "/kashu",
    });
  }
  if (twin.career?.typicalHours && twin.career.typicalHours >= 50) {
    out.push({
      id: "burnout",
      title: "Burnout risk watch",
      detail: `You reported ~${twin.career.typicalHours}h/week. Relationship Engine will watch sleep and stress for overload patterns.`,
      domain: "career",
      href: "/vitalu",
    });
  }
  if (twin.lifestyle?.stressLevel && twin.lifestyle.stressLevel >= 7) {
    out.push({
      id: "stress",
      title: "Stress recovery window",
      detail: "High baseline stress — protecting sleep and one recovery block this week can lift Mental Energy.",
      domain: "health",
      href: "/vitalu",
    });
  }
  if (twin.futures?.includes("buy_home")) {
    out.push({
      id: "home",
      title: "Home-buy readiness",
      detail: "Buying a home is on your future list. Keep savings rate and debt signals updated for sharper simulations.",
      domain: "money",
      href: "/goals",
    });
  }
  if (out.length === 0) {
    out.push({
      id: "daily",
      title: "Today’s compounding move",
      detail: "Your Twin is listening. Complete today’s mission — small daily signals raise Life Momentum.",
      domain: "life",
      href: "/dashboard#mission",
    });
  }
  return out.slice(0, 4);
}

export interface TwinPatternInsight {
  id: string;
  title: string;
  detail: string;
}

export function generateTwinPatterns(twin: DigitalTwinProfile | null): TwinPatternInsight[] {
  if (!twin) {
    return [
      {
        id: "need-data",
        title: "Invisible patterns need signal",
        detail: "Once sleep, hours, and spending sync, Signal Engine can surface patterns humans miss.",
      },
    ];
  }
  const patterns: TwinPatternInsight[] = [];
  if (twin.career?.typicalHours && twin.career.typicalHours >= 55) {
    patterns.push({
      id: "overwork-illness",
      title: "Overwork → recovery lag",
      detail:
        "Profiles with 55h+ weeks often show health dips 7–10 days later. Your Twin will watch that correlation as Health Connect and habits fill in.",
    });
  }
  if (twin.lifestyle?.sleepHours != null && twin.lifestyle.sleepHours < 6.5) {
    patterns.push({
      id: "sleep-productivity",
      title: "Short sleep → productivity tax",
      detail:
        "Sub-6.5h sleep baselines usually reduce deep-work capacity the next day. Probability Engine will weight calendar load accordingly.",
    });
  }
  if (twin.personality?.financialBehaviour === "spender") {
    patterns.push({
      id: "seasonal-spend",
      title: "Spending personality",
      detail:
        "Spender profiles often spike in high-stress or holiday windows. Opportunity Engine will flag savings slips early.",
    });
  }
  if (patterns.length === 0) {
    patterns.push({
      id: "watching",
      title: "Pattern detection armed",
      detail:
        "Signal Engine is ready. As calendar, health, and money data accumulate, invisible patterns will appear here.",
    });
  }
  return patterns;
}

export interface TwinSimulationResult {
  id: string;
  scenario: string;
  summary: string;
  impacts: { label: string; effect: string }[];
}

export function simulateTwinScenario(
  twin: DigitalTwinProfile | null,
  scenario: "move_province" | "invest_more" | "sleep_better" | "cut_hours"
): TwinSimulationResult {
  const country = twin?.identity?.country ?? "your region";
  switch (scenario) {
    case "move_province":
      return {
        id: "move",
        scenario: "What if I move?",
        summary: `Your Twin would recalculate taxes, housing, healthcare, and commute for a move from ${country}.`,
        impacts: [
          { label: "Cost of living", effect: "Re-indexed to destination" },
          { label: "Career network", effect: "May reset local opportunities" },
          { label: "Stress", effect: "Short-term up, long-term depends on fit" },
          { label: "Retirement", effect: "Shift with after-tax savings rate" },
        ],
      };
    case "invest_more":
      return {
        id: "invest",
        scenario: "What if I invest more?",
        summary:
          "Raising monthly investments typically pulls retirement and freedom goals forward — if cash-flow stays healthy.",
        impacts: [
          { label: "Retirement horizon", effect: "Likely earlier" },
          { label: "Near-term cash", effect: "Tighter buffer" },
          { label: "Risk", effect: "Depends on your risk tolerance setting" },
        ],
      };
    case "sleep_better":
      return {
        id: "sleep",
        scenario: "What if I sleep better?",
        summary: "Improving sleep usually lifts Mental Energy, career performance, and reduces burnout probability.",
        impacts: [
          { label: "Mental Energy", effect: "Trending up" },
          { label: "Career", effect: "Higher deep-work odds" },
          { label: "Health", effect: "Lower illness correlation" },
        ],
      };
    case "cut_hours":
      return {
        id: "hours",
        scenario: "What if I cut work hours?",
        summary: "Fewer hours can lower burnout risk and raise relationships/health — with possible income tradeoffs.",
        impacts: [
          { label: "Burnout risk", effect: "Down" },
          { label: "Income", effect: "May decline unless rate rises" },
          { label: "Relationships", effect: "More capacity" },
        ],
      };
  }
}
