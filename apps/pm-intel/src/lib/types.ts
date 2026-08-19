export const NOTES_REQUIRED_FROM = "2026-03-01";
export const DEFAULT_AS_OF = "2026-08-18";

export type ActivityType =
  | "Quarterly Business Review"
  | "Performance Review"
  | "Follow-Up Visit"
  | "Onsite Training"
  | "Demo"
  | "General"
  | "Unspecified"
  | "Risk & Retention VAE Proactive"
  | "Risk and Retention VAE Save"
  | string;

export type RawEngagement = {
  account: string;
  caId?: string;
  date: string;
  year?: number;
  month?: number;
  monthKey?: string;
  quarter?: string;
  completed?: string;
  end?: string;
  lastModified?: string;
  subject: string;
  activityType: ActivityType;
  status?: string;
  comments?: string;
  createdBy: string;
  assignedPmId?: string;
  assignedPmName?: string;
};

export type RecapFile = {
  sourceFile: string;
  exportedAt?: string;
  timezone?: string;
  assignedPm: {
    id: string;
    name: string;
    role?: string;
    region?: string;
    teamId?: string;
  };
  notesRequiredFrom?: string;
  records: RawEngagement[];
};

export type AttributionKind = "store" | "group" | "relationship" | "unmapped";

export type StoreAttribution = {
  storeKey: string;
  storeName: string;
  dealerGroup: string | null;
  kind: AttributionKind;
  match: "exact" | "alias" | "fuzzy" | "title" | "unresolved";
};

export type TemperatureLabel = "Hot" | "Warm" | "Mixed" | "Cool" | "Cold";
export type TemperatureStatus = "scored" | "legacy_unscored" | "missing_notes" | "empty";

export type TemperatureReading = {
  status: TemperatureStatus;
  score: number | null;
  label: TemperatureLabel | "Not captured (legacy)" | "Notes not captured" | "No notes";
  impression: string | null;
  positiveHits: string[];
  riskHits: string[];
  topics: string[];
  notesRequired: boolean;
};

export type NormalizedEngagement = RawEngagement & {
  id: string;
  pmId: string;
  pmName: string;
  hasNotes: boolean;
  temperature: TemperatureReading;
  attributions: StoreAttribution[];
  primary: StoreAttribution;
};

export type HealthLabel = "Healthy" | "Watch" | "At Risk";

export type ScoreBreakdown = {
  recency: { points: number; max: number; daysSince: number | null; lastDate: string | null };
  cadence: { points: number; max: number; last90: number; last180: number; expected90: number };
  mix: { points: number; max: number; weightedQuality: number; types: Record<string, number> };
  temperature: {
    points: number | null;
    max: number;
    applied: boolean;
    average: number | null;
    readings: number;
    reason: string;
  };
};

export type StoreScore = {
  storeKey: string;
  storeName: string;
  dealerGroup: string | null;
  kind: AttributionKind;
  pmId: string;
  pmName: string;
  score: number;
  label: HealthLabel;
  temperature: {
    average: number | null;
    label: TemperatureReading["label"];
    status: TemperatureStatus;
    readings: number;
  };
  lastEngagement: {
    date: string | null;
    daysSince: number | null;
    type: string | null;
    subject: string | null;
    createdBy: string | null;
  };
  counts: {
    total: number;
    last30: number;
    last90: number;
    last180: number;
    withNotes: number;
    withNotesAfterCutoff: number;
    afterCutoff: number;
  };
  breakdown: ScoreBreakdown;
  nextAction: string;
  engagements: NormalizedEngagement[];
};

export type PmScore = {
  pmId: string;
  pmName: string;
  teamId: string;
  teamName: string;
  storeCount: number;
  avgStoreScore: number;
  medianStoreScore: number;
  atRisk: number;
  watch: number;
  healthy: number;
  coverage30: number;
  coverage90: number;
  noteCaptureAfterCutoff: number;
  mixQuality: number;
  lastActivity: string | null;
  score: number;
  label: HealthLabel;
};

export type TeamScore = {
  teamId: string;
  teamName: string;
  directorId: string;
  directorName: string;
  pms: PmScore[];
  storeCount: number;
  avgPmScore: number;
  avgStoreScore: number;
  atRisk: number;
  coverage90: number;
  score: number;
  label: HealthLabel;
};

export type OrgPm = {
  id: string;
  name: string;
  teamId: string;
  region?: string;
  isSample?: boolean;
};

export type OrgTeam = {
  id: string;
  name: string;
  directorId: string;
};

export type OrgDirector = {
  id: string;
  name: string;
};

export type OrgChart = {
  company: string;
  directors: OrgDirector[];
  teams: OrgTeam[];
  pms: OrgPm[];
};

export type AssistantCitation = {
  storeKey?: string;
  storeName?: string;
  date?: string;
  subject?: string;
  activityType?: string;
  excerpt?: string;
};

export type AssistantAnswer = {
  question: string;
  intent: string;
  headline: string;
  answer: string;
  bullets: string[];
  citations: AssistantCitation[];
  suggestedFollowups: string[];
};
