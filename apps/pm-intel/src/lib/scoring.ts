import { attributeEngagement, buildCatalog, kindRank } from "./normalize";
import { readTemperature, hasCapturedNotes } from "./temperature";
import type {
  HealthLabel,
  NormalizedEngagement,
  OrgChart,
  PmScore,
  RawEngagement,
  RecapFile,
  ScoreBreakdown,
  StoreScore,
  TeamScore,
} from "./types";
import { DEFAULT_AS_OF, NOTES_REQUIRED_FROM } from "./types";

export const ACTIVITY_WEIGHT: Record<string, number> = {
  "Quarterly Business Review": 1,
  "Performance Review": 0.85,
  "Risk and Retention VAE Save": 0.95,
  "Risk & Retention VAE Proactive": 0.9,
  "Onsite Training": 0.8,
  "Follow-Up Visit": 0.7,
  Demo: 0.6,
  General: 0.45,
  Unspecified: 0.35,
};

export function activityWeight(type: string): number {
  return ACTIVITY_WEIGHT[type] ?? 0.4;
}

export function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00`);
  const b = Date.parse(`${to}T00:00:00`);
  return Math.round((b - a) / 86400000);
}

export function healthLabel(score: number): HealthLabel {
  if (score >= 75) return "Healthy";
  if (score >= 55) return "Watch";
  return "At Risk";
}

function recencyPoints(days: number | null): number {
  if (days == null) return 0;
  if (days <= 14) return 30;
  if (days <= 30) return 26;
  if (days <= 45) return 20;
  if (days <= 60) return 14;
  if (days <= 90) return 8;
  if (days <= 120) return 4;
  return 2;
}

function cadencePoints(last90: number, last180: number): { points: number; expected90: number } {
  const expected90 = 3;
  const coverage = Math.min(1, last90 / expected90);
  const depth = Math.min(1, last180 / 6);
  return { points: Math.round(18 * coverage + 12 * depth), expected90 };
}

function mixPoints(engagements: NormalizedEngagement[]): { points: number; weightedQuality: number; types: Record<string, number> } {
  const types: Record<string, number> = {};
  let weighted = 0;
  for (const row of engagements) {
    types[row.activityType] = (types[row.activityType] || 0) + 1;
    weighted += activityWeight(row.activityType);
  }
  const quality = engagements.length ? weighted / engagements.length : 0;
  return { points: Math.round(quality * 25), weightedQuality: Math.round(quality * 100), types };
}

export function nextActionFor(store: Pick<StoreScore, "label" | "temperature" | "lastEngagement" | "counts">): string {
  if (!store.lastEngagement.date) return "No completed activity in this book — schedule an introduction.";
  const days = store.lastEngagement.daysSince ?? 999;
  if (store.label === "At Risk" || days > 60) {
    return "Book a Performance Review this week. Cadence has slipped.";
  }
  if (store.temperature.status === "scored" && (store.temperature.label === "Cool" || store.temperature.label === "Cold")) {
    return "Temperature is cool — follow up on the last concern before the next QBR.";
  }
  if (store.temperature.status === "missing_notes") {
    return "Last visit has no notes. Capture Customer Impression on the next call so temperature can be scored.";
  }
  if (days > 30) return "Schedule the monthly touch. Last visit is over 30 days ago.";
  if (store.counts.last90 < 3) return "Add one more structured review this quarter to keep cadence healthy.";
  return "Keep the monthly cadence. Account is in good shape.";
}

export function normalizeRecaps(files: RecapFile[], notesRequiredFrom = NOTES_REQUIRED_FROM): NormalizedEngagement[] {
  const catalog = buildCatalog(files.flatMap((file) => file.records.map((row) => row.account || row.subject)));
  const out: NormalizedEngagement[] = [];
  files.forEach((file, fileIndex) => {
    file.records.forEach((row, index) => {
      const attributions = attributeEngagement(row.account, row.subject, catalog);
      const primary = [...attributions].sort((a, b) => kindRank(b.kind) - kindRank(a.kind))[0];
      out.push({
        ...row,
        id: `${file.assignedPm.id}-${fileIndex}-${index}`,
        pmId: row.assignedPmId || file.assignedPm.id,
        pmName: row.assignedPmName || file.assignedPm.name,
        hasNotes: hasCapturedNotes(row.comments),
        temperature: readTemperature(row.comments, row.date, file.notesRequiredFrom || notesRequiredFrom),
        attributions,
        primary,
      });
    });
  });
  return out;
}

export function scoreStore(
  storeKey: string,
  engagements: NormalizedEngagement[],
  asOf = DEFAULT_AS_OF,
): StoreScore {
  const sorted = [...engagements].sort((a, b) => b.date.localeCompare(a.date));
  const latest = sorted[0];
  const daysSince = latest ? daysBetween(latest.date, asOf) : null;
  const last90 = sorted.filter((row) => daysBetween(row.date, asOf) <= 90).length;
  const last180 = sorted.filter((row) => daysBetween(row.date, asOf) <= 180).length;
  const last30 = sorted.filter((row) => daysBetween(row.date, asOf) <= 30).length;
  const scoredTemps = sorted.filter((row) => row.temperature.status === "scored" && row.temperature.score != null);
  const mix = mixPoints(sorted);
  const cadence = cadencePoints(last90, last180);
  const recency = recencyPoints(daysSince);

  const tempAverage = scoredTemps.length
    ? Math.round(scoredTemps.reduce((sum, row) => sum + (row.temperature.score || 0), 0) / scoredTemps.length)
    : null;

  let tempPoints: number | null = null;
  let applied = false;
  let reason = "No Customer Impression notes — temperature excluded from the score (not treated as a bad engagement).";
  if (tempAverage != null) {
    tempPoints = Math.round((tempAverage / 100) * 15);
    applied = true;
    reason = `Temperature uses ${scoredTemps.length} scored note(s). Missing historical notes are ignored.`;
  }

  const earned = recency + cadence.points + mix.points + (applied ? tempPoints || 0 : 0);
  const max = 30 + 30 + 25 + (applied ? 15 : 0);
  const score = Math.max(0, Math.min(100, Math.round((earned / Math.max(max, 1)) * 100)));

  const afterCutoff = sorted.filter((row) => row.temperature.notesRequired).length;
  const withNotesAfterCutoff = sorted.filter((row) => row.temperature.notesRequired && row.hasNotes).length;

  const latestTemp = scoredTemps[0]?.temperature;
  const temperature = {
    average: tempAverage,
    label: latestTemp?.label || sorted[0]?.temperature.label || "No notes",
    status: latestTemp?.status || sorted[0]?.temperature.status || "empty",
    readings: scoredTemps.length,
  };

  const breakdown: ScoreBreakdown = {
    recency: { points: recency, max: 30, daysSince, lastDate: latest?.date || null },
    cadence: { points: cadence.points, max: 30, last90, last180, expected90: cadence.expected90 },
    mix: { points: mix.points, max: 25, weightedQuality: mix.weightedQuality, types: mix.types },
    temperature: {
      points: tempPoints,
      max: 15,
      applied,
      average: tempAverage,
      readings: scoredTemps.length,
      reason,
    },
  };

  const store: StoreScore = {
    storeKey,
    storeName: latest?.primary.storeName || storeKey,
    dealerGroup: latest?.primary.dealerGroup || null,
    kind: latest?.primary.kind || "store",
    pmId: latest?.pmId || "",
    pmName: latest?.pmName || "",
    score,
    label: healthLabel(score),
    temperature,
    lastEngagement: {
      date: latest?.date || null,
      daysSince,
      type: latest?.activityType || null,
      subject: latest?.subject || null,
      createdBy: latest?.createdBy || null,
    },
    counts: {
      total: sorted.length,
      last30,
      last90,
      last180,
      withNotes: sorted.filter((row) => row.hasNotes).length,
      withNotesAfterCutoff,
      afterCutoff,
    },
    breakdown,
    nextAction: "",
    engagements: sorted,
  };
  store.nextAction = nextActionFor(store);
  return store;
}

export function scoreBook(
  engagements: NormalizedEngagement[],
  asOf = DEFAULT_AS_OF,
  kinds: Array<StoreScore["kind"]> = ["store", "group"],
): StoreScore[] {
  const buckets = new Map<string, NormalizedEngagement[]>();
  for (const row of engagements) {
    for (const attr of row.attributions) {
      if (!kinds.includes(attr.kind)) continue;
      const key = `${row.pmId}::${attr.storeKey}`;
      const clone: NormalizedEngagement = { ...row, primary: attr };
      buckets.set(key, [...(buckets.get(key) || []), clone]);
    }
  }
  return [...buckets.entries()]
    .map(([, rows]) => scoreStore(rows[0].primary.storeKey, rows, asOf))
    .sort((a, b) => a.score - b.score || (b.lastEngagement.daysSince || 0) - (a.lastEngagement.daysSince || 0));
}

export function scorePm(stores: StoreScore[], org: OrgChart): PmScore | null {
  if (!stores.length) return null;
  const pmId = stores[0].pmId;
  const pm = org.pms.find((item) => item.id === pmId);
  const team = org.teams.find((item) => item.id === (pm?.teamId || ""));
  const scores = [...stores.map((store) => store.score)].sort((a, b) => a - b);
  const avg = Math.round(scores.reduce((sum, n) => sum + n, 0) / scores.length);
  const median = scores[Math.floor(scores.length / 2)];
  const coverage30 = stores.filter((store) => (store.lastEngagement.daysSince ?? 999) <= 30).length / stores.length;
  const coverage90 = stores.filter((store) => (store.lastEngagement.daysSince ?? 999) <= 90).length / stores.length;
  const after = stores.reduce((sum, store) => sum + store.counts.afterCutoff, 0);
  const notes = stores.reduce((sum, store) => sum + store.counts.withNotesAfterCutoff, 0);
  const mixQuality =
    stores.reduce((sum, store) => sum + store.breakdown.mix.weightedQuality, 0) / Math.max(stores.length, 1);
  const lastActivity = stores
    .map((store) => store.lastEngagement.date)
    .filter(Boolean)
    .sort()
    .at(-1) || null;

  const score = Math.round(
    avg * 0.45 + coverage90 * 100 * 0.25 + coverage30 * 100 * 0.15 + mixQuality * 0.15,
  );

  return {
    pmId,
    pmName: stores[0].pmName,
    teamId: team?.id || "unassigned",
    teamName: team?.name || "Unassigned",
    storeCount: stores.length,
    avgStoreScore: avg,
    medianStoreScore: median,
    atRisk: stores.filter((store) => store.label === "At Risk").length,
    watch: stores.filter((store) => store.label === "Watch").length,
    healthy: stores.filter((store) => store.label === "Healthy").length,
    coverage30: Math.round(coverage30 * 100),
    coverage90: Math.round(coverage90 * 100),
    noteCaptureAfterCutoff: after ? Math.round((notes / after) * 100) : 0,
    mixQuality: Math.round(mixQuality),
    lastActivity,
    score: Math.max(0, Math.min(100, score)),
    label: healthLabel(score),
  };
}

export function scoreTeams(pms: PmScore[], org: OrgChart): TeamScore[] {
  return org.teams.map((team) => {
    const members = pms.filter((pm) => pm.teamId === team.id);
    const director = org.directors.find((item) => item.id === team.directorId);
    const storeCount = members.reduce((sum, pm) => sum + pm.storeCount, 0);
    const avgPmScore = members.length
      ? Math.round(members.reduce((sum, pm) => sum + pm.score, 0) / members.length)
      : 0;
    const avgStoreScore = members.length
      ? Math.round(members.reduce((sum, pm) => sum + pm.avgStoreScore, 0) / members.length)
      : 0;
    const atRisk = members.reduce((sum, pm) => sum + pm.atRisk, 0);
    const coverage90 = members.length
      ? Math.round(members.reduce((sum, pm) => sum + pm.coverage90, 0) / members.length)
      : 0;
    const score = avgPmScore;
    return {
      teamId: team.id,
      teamName: team.name,
      directorId: team.directorId,
      directorName: director?.name || "Director",
      pms: members,
      storeCount,
      avgPmScore,
      avgStoreScore,
      atRisk,
      coverage90,
      score,
      label: healthLabel(score),
    };
  });
}

export function seedOrgFromFiles(files: RecapFile[]): OrgChart {
  const pms = files.map((file, index) => ({
    id: file.assignedPm.id,
    name: file.assignedPm.name,
    teamId: file.assignedPm.teamId || (index === 0 ? "team-canada-a" : `team-${file.assignedPm.id}`),
    region: file.assignedPm.region,
  }));
  return {
    company: "vAuto / Cox Automotive — Performance",
    directors: [{ id: "dir-canada", name: "Canada Performance Director" }],
    teams: [
      { id: "team-canada-a", name: "Team Canada A", directorId: "dir-canada" },
      { id: "team-canada-b", name: "Team Canada B", directorId: "dir-canada" },
    ],
    pms,
  };
}

export function emptyPeerPm(): RecapFile {
  return {
    sourceFile: "Awaiting recap import",
    assignedPm: {
      id: "pm-peer-unassigned",
      name: "Open PM seat",
      role: "Performance Manager",
      region: "Canada",
      teamId: "team-canada-b",
    },
    records: [],
  };
}

export function makeSamplePeerBook(source: RawEngagement[], asOf = DEFAULT_AS_OF): RecapFile {
  const records: RawEngagement[] = source.slice(0, 180).map((row, index) => {
    const shift = index % 3 === 0 ? 12 : index % 3 === 1 ? -8 : 4;
    const base = Date.parse(`${row.date}T00:00:00`);
    const next = new Date(base + shift * 86400000);
    const iso = next.toISOString().slice(0, 10);
    return {
      ...row,
      date: iso > asOf ? row.date : iso,
      account: row.account.replace(/JIM PATTISON/g, "SAMPLE WEST").replace(/STEELE/g, "SAMPLE EAST"),
      subject: `[SAMPLE] ${row.subject}`,
      comments: index % 4 === 0 ? row.comments : "No comments captured in the exported report.",
      createdBy: index % 5 === 0 ? "Automated Process" : "Sample PM — West",
      assignedPmId: "pm-sample-west",
      assignedPmName: "Sample PM — West",
    };
  });
  return {
    sourceFile: "Illustration peer recap (not live Salesforce)",
    assignedPm: {
      id: "pm-sample-west",
      name: "Sample PM — West",
      role: "Performance Manager",
      region: "West",
      teamId: "team-canada-b",
    },
    records,
  };
}
