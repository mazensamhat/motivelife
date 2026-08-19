import type {
  AssistantAnswer,
  AssistantCitation,
  NormalizedEngagement,
  OrgChart,
  PmScore,
  StoreScore,
  TeamScore,
} from "./types";
import { tokenize } from "./normalize";

export type AssistantContext = {
  asOf?: string;
  org: OrgChart;
  engagements: NormalizedEngagement[];
  stores: StoreScore[];
  pms: PmScore[];
  teams: TeamScore[];
};

type Intent =
  | "last_engagement"
  | "temperature"
  | "score"
  | "at_risk"
  | "cadence"
  | "briefing"
  | "compare"
  | "notes"
  | "pm_score"
  | "team_compare"
  | "search";

function detectIntent(question: string): Intent {
  const q = question.toLowerCase();
  if (/last (engagement|visit|call|touch|seen|review)|when did|when was/.test(q)) return "last_engagement";
  if (/temperature|sentiment|impression|feel|hot|cold|warm/.test(q)) return "temperature";
  if (/at risk|overdue|stale|haven'?t seen|neglected|who needs/.test(q)) return "at_risk";
  if (/how often|cadence|frequency|how many times/.test(q)) return "cadence";
  if (/this week|briefing|who should i (call|see|visit)|priorit/.test(q)) return "briefing";
  if (/team|director|vs the other|compared to team/.test(q)) return "team_compare";
  if (/compare|versus| vs /.test(q)) return "compare";
  if (/notes|discuss|talked about|topics/.test(q)) return "notes";
  if (/pm score|my score|performance manager score|how am i doing/.test(q)) return "pm_score";
  if (/score|health|rating/.test(q)) return "score";
  return "search";
}

function uniqueStores(stores: StoreScore[]): StoreScore[] {
  const seen = new Set<string>();
  return stores.filter((store) => {
    const key = `${store.pmId}:${store.storeKey}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function resolveStores(question: string, stores: StoreScore[]): StoreScore[] {
  const q = question.toLowerCase();
  const ranked = stores
    .map((store) => {
      const name = store.storeName.toLowerCase();
      const tokens = tokenize(store.storeName);
      let score = 0;
      if (q.includes(name.toLowerCase())) score += 10;
      for (const token of tokens) {
        if (token.length > 3 && q.includes(token.toLowerCase())) score += 2;
      }
      return { store, score };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score);
  return uniqueStores(ranked.slice(0, 6).map((row) => row.store));
}

function searchEngagements(question: string, engagements: NormalizedEngagement[], limit = 8): NormalizedEngagement[] {
  const terms = tokenize(question).map((t) => t.toLowerCase());
  if (!terms.length) return [];
  const scored = engagements
    .map((row) => {
      const blob = `${row.primary.storeName} ${row.subject} ${row.comments || ""}`.toLowerCase();
      const hits = terms.filter((term) => blob.includes(term)).length;
      return { row, hits };
    })
    .filter((row) => row.hits > 0)
    .sort((a, b) => b.hits - a.hits || b.row.date.localeCompare(a.row.date));
  return scored.slice(0, limit).map((row) => row.row);
}

function citeStore(store: StoreScore): AssistantCitation {
  return {
    storeKey: store.storeKey,
    storeName: store.storeName,
    date: store.lastEngagement.date || undefined,
    subject: store.lastEngagement.subject || undefined,
    activityType: store.lastEngagement.type || undefined,
  };
}

function citeEngagement(row: NormalizedEngagement): AssistantCitation {
  const excerpt = row.temperature.impression || (row.hasNotes ? (row.comments || "").slice(0, 180) : undefined);
  return {
    storeKey: row.primary.storeKey,
    storeName: row.primary.storeName,
    date: row.date,
    subject: row.subject,
    activityType: row.activityType,
    excerpt,
  };
}

function followups(intent: Intent, stores: StoreScore[]): string[] {
  const name = stores[0]?.storeName;
  const base = [
    name ? `When was the last engagement with ${name}?` : "Which stores are at risk?",
    name ? `What is the temperature at ${name}?` : "Who should I call this week?",
    "How is my PM score calculated?",
  ];
  if (intent === "briefing") return ["Which stores are at risk?", "What is my note capture rate after March 2026?"];
  return base;
}

function lastEngagementAnswer(stores: StoreScore[]): AssistantAnswer {
  if (!stores.length) {
    return {
      question: "",
      intent: "last_engagement",
      headline: "I need a store name",
      answer: "Ask with a dealer name, for example: “When was the last engagement with Ajax Nissan?”",
      bullets: [],
      citations: [],
      suggestedFollowups: ["Which stores are at risk?", "Who should I call this week?"],
    };
  }
  const store = stores[0];
  const last = store.lastEngagement;
  return {
    question: "",
    intent: "last_engagement",
    headline: last.date ? `${store.storeName} — ${last.date}` : `${store.storeName} has no dated activity`,
    answer: last.date
      ? `Last completed engagement with ${store.storeName} was ${last.date} (${last.daysSince} days before the recap date) — ${last.type}. ${last.createdBy === "Automated Process" ? "Logged by the automated recap process." : `Logged by ${last.createdBy}.`} Missing comments on older visits are not treated as a poor visit.`
      : `No completed activity is attached to ${store.storeName} in this recap.`,
    bullets: [
      `Health ${store.score} (${store.label})`,
      `Temperature: ${store.temperature.label}`,
      store.nextAction,
    ],
    citations: [citeStore(store)],
    suggestedFollowups: followups("last_engagement", stores),
  };
}

function temperatureAnswer(stores: StoreScore[]): AssistantAnswer {
  const store = stores[0];
  if (!store) {
    return {
      question: "",
      intent: "temperature",
      headline: "Temperature needs a store",
      answer: "Temperature is only scored when a Customer Impression exists. Before March 2026, notes were not required, so blank comments do not mean a cold account.",
      bullets: [],
      citations: [],
      suggestedFollowups: ["Which stores have cold temperature?", "Who should I call this week?"],
    };
  }
  const latestScored = store.engagements.find((row) => row.temperature.status === "scored");
  const answer =
    store.temperature.status === "scored"
      ? `${store.storeName} temperature is ${store.temperature.label}${store.temperature.average != null ? ` (${store.temperature.average}/100)` : ""} from ${store.temperature.readings} scored impression(s).`
      : store.temperature.status === "legacy_unscored"
        ? `${store.storeName} has no Customer Impression notes. Those visits predate the notes requirement (March 2026), so temperature is unknown — not cold.`
        : `${store.storeName} has recent activity without captured notes, so temperature is unknown. Capture impression on the next call.`;
  return {
    question: "",
    intent: "temperature",
    headline: `${store.storeName} — ${store.temperature.label}`,
    answer,
    bullets: [
      latestScored?.temperature.impression || "No impression paragraph on file.",
      latestScored ? `Topics: ${latestScored.temperature.topics.join(", ") || "none tagged"}` : "No scored notes yet.",
      store.nextAction,
    ],
    citations: latestScored ? [citeEngagement(latestScored)] : [citeStore(store)],
    suggestedFollowups: followups("temperature", stores),
  };
}

function scoreAnswer(stores: StoreScore[]): AssistantAnswer {
  const store = stores[0];
  if (!store) {
    return {
      question: "",
      intent: "score",
      headline: "Score a store or ask for at-risk",
      answer: "Store health is recency + cadence + engagement type. Temperature is added only when notes exist.",
      bullets: [],
      citations: [],
      suggestedFollowups: ["Which stores are at risk?"],
    };
  }
  const b = store.breakdown;
  return {
    question: "",
    intent: "score",
    headline: `${store.storeName} is ${store.label} (${store.score})`,
    answer: `${store.storeName} scores ${store.score}/100. Recency ${b.recency.points}/${b.recency.max}, cadence ${b.cadence.points}/${b.cadence.max}, type mix ${b.mix.points}/${b.mix.max}. ${b.temperature.reason}`,
    bullets: [
      `Last visit: ${store.lastEngagement.date || "n/a"} (${store.lastEngagement.daysSince ?? "—"} days)`,
      `Last 90 days: ${store.counts.last90} engagements (target 3)`,
      store.nextAction,
    ],
    citations: [citeStore(store)],
    suggestedFollowups: followups("score", stores),
  };
}

function atRiskAnswer(stores: StoreScore[]): AssistantAnswer {
  const risk = [...stores].filter((s) => s.label === "At Risk").sort((a, b) => a.score - b.score);
  const stale = [...stores].sort((a, b) => (b.lastEngagement.daysSince || 0) - (a.lastEngagement.daysSince || 0));
  const focus = (risk.length ? risk : stale).slice(0, 8);
  return {
    question: "",
    intent: "at_risk",
    headline: risk.length ? `${risk.length} stores at risk` : "No stores below the At Risk line",
    answer: risk.length
      ? "These stores have weak recency or cadence. Blank historical notes did not put them here by themselves."
      : "No store is below 55. The longest-gap accounts are still worth a look this week.",
    bullets: focus.map(
      (store) =>
        `${store.storeName}: ${store.score} ${store.label}, last ${store.lastEngagement.date || "n/a"} (${store.lastEngagement.daysSince ?? "—"}d)`,
    ),
    citations: focus.slice(0, 5).map(citeStore),
    suggestedFollowups: ["Who should I call this week?", "How is cadence scored?"],
  };
}

function cadenceAnswer(stores: StoreScore[]): AssistantAnswer {
  const store = stores[0];
  if (!store) return atRiskAnswer(stores);
  return {
    question: "",
    intent: "cadence",
    headline: `${store.storeName} cadence`,
    answer: `${store.storeName} has ${store.counts.last90} engagements in the last 90 days (target 3) and ${store.counts.total} in the loaded recap. Type quality is ${store.breakdown.mix.weightedQuality}/100, so QBRs and Performance Reviews count more than unspecified or general tasks.`,
    bullets: Object.entries(store.breakdown.mix.types)
      .sort((a, b) => b[1] - a[1])
      .map(([type, n]) => `${type}: ${n}`),
    citations: [citeStore(store)],
    suggestedFollowups: followups("cadence", stores),
  };
}

function briefingAnswer(stores: StoreScore[], pms: PmScore[]): AssistantAnswer {
  const pm = pms[0];
  const call = [...stores]
    .filter((s) => s.kind === "store")
    .sort((a, b) => {
      const risk = Number(a.label === "At Risk") - Number(b.label === "At Risk");
      if (risk) return risk > 0 ? -1 : 1;
      return (b.lastEngagement.daysSince || 0) - (a.lastEngagement.daysSince || 0);
    })
    .slice(0, 8);
  return {
    question: "",
    intent: "briefing",
    headline: pm ? `${pm.pmName} weekly focus` : "Weekly focus",
    answer: pm
      ? `${pm.pmName} book: ${pm.storeCount} stores, PM score ${pm.score}, ${pm.coverage90}% touched in 90 days, ${pm.atRisk} at risk. Note capture after March 2026 is ${pm.noteCaptureAfterCutoff}% — that metric ignores the legacy blank-comment period.`
      : "Load a recap to build the weekly briefing.",
    bullets: call.map((store) => `${store.storeName}: ${store.nextAction}`),
    citations: call.slice(0, 5).map(citeStore),
    suggestedFollowups: ["Which stores are at risk?", "What is the temperature on the first one?"],
  };
}

function compareAnswer(stores: StoreScore[]): AssistantAnswer {
  if (stores.length < 2) {
    return {
      question: "",
      intent: "compare",
      headline: "Name two stores to compare",
      answer: "Try: “Compare Ajax Nissan vs Pickering Honda”.",
      bullets: [],
      citations: [],
      suggestedFollowups: ["Which stores are at risk?"],
    };
  }
  const [a, b] = stores;
  return {
    question: "",
    intent: "compare",
    headline: `${a.storeName} vs ${b.storeName}`,
    answer: `${a.storeName} is ${a.score} ${a.label} (last ${a.lastEngagement.date}, temp ${a.temperature.label}). ${b.storeName} is ${b.score} ${b.label} (last ${b.lastEngagement.date}, temp ${b.temperature.label}).`,
    bullets: [
      `${a.storeName} last 90 days: ${a.counts.last90}`,
      `${b.storeName} last 90 days: ${b.counts.last90}`,
    ],
    citations: [citeStore(a), citeStore(b)],
    suggestedFollowups: followups("compare", stores),
  };
}

function notesAnswer(stores: StoreScore[], engagements: NormalizedEngagement[], question: string): AssistantAnswer {
  const pool = stores.length
    ? stores[0].engagements.filter((row) => row.hasNotes)
    : searchEngagements(question, engagements).filter((row) => row.hasNotes);
  const rows = pool.slice(0, 5);
  if (!rows.length) {
    return {
      question: "",
      intent: "notes",
      headline: "No captured notes for that ask",
      answer: "Most 2025–Feb 2026 recap lines have no comments because notes were not required. That is not a negative engagement.",
      bullets: [],
      citations: [],
      suggestedFollowups: ["Which stores have scored temperature?"],
    };
  }
  return {
    question: "",
    intent: "notes",
    headline: `Notes (${rows.length})`,
    answer: "Grounded in Customer Impression / comments from the Salesforce recap. Legacy blank rows are skipped.",
    bullets: rows.map((row) => `${row.date} ${row.primary.storeName}: ${(row.temperature.impression || row.comments || "").slice(0, 160)}`),
    citations: rows.map(citeEngagement),
    suggestedFollowups: followups("notes", stores),
  };
}

function pmAnswer(pms: PmScore[]): AssistantAnswer {
  const pm = pms[0];
  if (!pm) {
    return {
      question: "",
      intent: "pm_score",
      headline: "No PM scored yet",
      answer: "Import a recap to score a performance manager.",
      bullets: [],
      citations: [],
      suggestedFollowups: [],
    };
  }
  return {
    question: "",
    intent: "pm_score",
    headline: `${pm.pmName} scores ${pm.score} (${pm.label})`,
    answer: `PM score blends portfolio store health (${pm.avgStoreScore}), 90-day coverage (${pm.coverage90}%), 30-day coverage (${pm.coverage30}%), and engagement-type quality (${pm.mixQuality}). Note capture after the March 2026 requirement is ${pm.noteCaptureAfterCutoff}% and is reported separately so pre-requirement blanks cannot drag the PM down.`,
    bullets: [
      `${pm.storeCount} stores · ${pm.healthy} healthy · ${pm.watch} watch · ${pm.atRisk} at risk`,
      `Last activity in book: ${pm.lastActivity || "n/a"}`,
    ],
    citations: [],
    suggestedFollowups: ["Which stores are at risk?", "Compare Team Canada A vs Team Canada B"],
  };
}

function teamAnswer(teams: TeamScore[]): AssistantAnswer {
  const live = teams.filter((team) => team.pms.length);
  if (live.length < 1) {
    return {
      question: "",
      intent: "team_compare",
      headline: "Director view needs PM recaps",
      answer: "Mazen’s book is Team Canada A. Import another PM recap onto Team Canada B to compare teams.",
      bullets: [],
      citations: [],
      suggestedFollowups: ["Who should I call this week?"],
    };
  }
  return {
    question: "",
    intent: "team_compare",
    headline: live.map((t) => `${t.teamName} ${t.score}`).join(" vs "),
    answer: "Director score is the average of PM scores on that team. Store health still excludes legacy missing notes.",
    bullets: live.map(
      (team) =>
        `${team.teamName}: ${team.pms.length} PM(s), ${team.storeCount} stores, ${team.coverage90}% 90-day coverage, ${team.atRisk} at risk`,
    ),
    citations: [],
    suggestedFollowups: ["Which stores are at risk?", "How is my PM score calculated?"],
  };
}

export function askLocalAssistant(question: string, ctx: AssistantContext): AssistantAnswer {
  const intent = detectIntent(question);
  const stores = resolveStores(question, ctx.stores);
  let result: AssistantAnswer;
  switch (intent) {
    case "last_engagement":
      result = lastEngagementAnswer(stores);
      break;
    case "temperature":
      result = temperatureAnswer(stores.length ? stores : ctx.stores.filter((s) => s.temperature.status === "scored").slice(0, 1));
      break;
    case "score":
      result = scoreAnswer(stores);
      break;
    case "at_risk":
      result = atRiskAnswer(ctx.stores);
      break;
    case "cadence":
      result = cadenceAnswer(stores);
      break;
    case "briefing":
      result = briefingAnswer(ctx.stores, ctx.pms);
      break;
    case "compare":
      result = compareAnswer(stores);
      break;
    case "notes":
      result = notesAnswer(stores, ctx.engagements, question);
      break;
    case "pm_score":
      result = pmAnswer(ctx.pms);
      break;
    case "team_compare":
      result = teamAnswer(ctx.teams);
      break;
    default: {
      const found = stores.length ? stores : [];
      const searchHits = searchEngagements(question, ctx.engagements);
      if (found.length === 1 && /last|when|temp|score/.test(question.toLowerCase())) {
        result = lastEngagementAnswer(found);
      } else if (searchHits.length) {
        result = {
          question,
          intent: "search",
          headline: "From the recap",
          answer: `I matched ${searchHits.length} engagement(s) in the local book. Nothing left this machine.`,
          bullets: searchHits.map(
            (row) => `${row.date} ${row.primary.storeName}: ${row.activityType} — ${row.subject}`,
          ),
          citations: searchHits.map(citeEngagement),
          suggestedFollowups: followups("search", found),
        };
      } else {
        result = briefingAnswer(ctx.stores, ctx.pms);
      }
    }
  }
  result.question = question;
  if (!result.suggestedFollowups.length) result.suggestedFollowups = followups(intent, stores);
  return result;
}

export const STARTER_QUESTIONS = [
  "When was the last engagement with Ajax Nissan?",
  "What is the temperature at Steele Subaru?",
  "Which stores are at risk?",
  "Who should I call this week?",
  "How often am I seeing Jim Pattison Toyota Surrey?",
  "How is my PM score calculated?",
  "Compare Team Canada A vs Team Canada B",
];
