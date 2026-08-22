import { NOTES_REQUIRED_FROM, type TemperatureReading, type TemperatureStatus } from "./types";

const POSITIVE = [
  "appreciation",
  "appreciated",
  "grateful",
  "gratitude",
  "willingness to learn",
  "willing to learn",
  "engaged",
  "engagement",
  "proactive",
  "cooperative",
  "receptive",
  "positive",
  "confident",
  "confidence",
  "excited",
  "100%",
  "thank",
  "helpful",
  "committed",
  "collaboration",
  "collaborate",
];

const RISK = [
  "frustration",
  "frustrated",
  "frustrating",
  "concern",
  "concerned",
  "dissatisfaction",
  "dissatisfied",
  "angry",
  "upset",
  "stupid",
  "glitch",
  "glitches",
  "issue",
  "problem",
  "delay",
  "cancelled",
  "cancellation",
  "risk",
  "inactive",
  "confusion",
  "confused",
  "mandated",
  "technical difficulties",
];

const TOPIC_MAP: Record<string, string[]> = {
  Inventory: ["inventory", "stock", "aged", "aging", "units", "days supply", "turn"],
  Pricing: ["pricing", "price", "gross", "discount", "market", "pbs"],
  Appraisals: ["appraisal", "trade", "look-to-book", "look to book", "ltb", "cim"],
  Reconditioning: ["reconditioning", "recon", "repair", "obd2"],
  Training: ["training", "coach", "demo", "onboard", "learn"],
  Photos: ["photo", "vdp", "merchandising", "description"],
  System: ["system", "glitch", "login", "profit time", "v auto", "vauto"],
  Leads: ["lead", "bdc", "appointment", "customer"],
};

export function hasCapturedNotes(comments?: string | null): boolean {
  const text = (comments || "").trim();
  if (!text) return false;
  if (text.startsWith("No comments captured")) return false;
  if (/no summary found/i.test(text)) return false;
  if (text === "null") return false;
  return true;
}

export function extractImpression(comments?: string | null): string | null {
  if (!hasCapturedNotes(comments)) return null;
  const text = comments || "";
  const match = text.match(/\*\*Customer Impression\*\*\s*([\s\S]*?)(?:\*\*|$)/i);
  if (match) return match[1].replace(/^null\s*/i, "").trim() || null;
  return text.replace(/^null\s*/i, "").trim() || null;
}

function hits(text: string, lexicon: string[]): string[] {
  const lower = text.toLowerCase();
  return lexicon.filter((word) => lower.includes(word));
}

function topicsFrom(text: string): string[] {
  const lower = text.toLowerCase();
  return Object.entries(TOPIC_MAP)
    .filter(([, words]) => words.some((word) => lower.includes(word)))
    .map(([topic]) => topic);
}

export function temperatureLabel(score: number): TemperatureReading["label"] {
  if (score >= 80) return "Hot";
  if (score >= 65) return "Warm";
  if (score >= 45) return "Mixed";
  if (score >= 30) return "Cool";
  return "Cold";
}

export function readTemperature(
  comments: string | undefined,
  date: string,
  notesRequiredFrom = NOTES_REQUIRED_FROM,
): TemperatureReading {
  const notesRequired = date >= notesRequiredFrom;
  if (!hasCapturedNotes(comments)) {
    const status: TemperatureStatus = notesRequired ? "missing_notes" : "legacy_unscored";
    return {
      status,
      score: null,
      label: notesRequired ? "Notes not captured" : "Not captured (legacy)",
      impression: null,
      positiveHits: [],
      riskHits: [],
      topics: [],
      notesRequired,
    };
  }

  const impression = extractImpression(comments);
  const source = impression || comments || "";
  const positiveHits = hits(source, POSITIVE);
  const riskHits = hits(source, RISK);
  const topics = topicsFrom(source);
  const mixedCue = /mix of|however|but also|despite/i.test(source);

  let score = 58 + positiveHits.length * 6 - riskHits.length * 8;
  if (mixedCue) score -= 6;
  if (/100%/.test(source)) score += 8;
  if (/\bstupid\b/i.test(source)) score -= 12;
  score = Math.max(5, Math.min(97, Math.round(score)));

  return {
    status: "scored",
    score,
    label: temperatureLabel(score),
    impression,
    positiveHits,
    riskHits,
    topics,
    notesRequired,
  };
}
