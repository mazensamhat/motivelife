import type {
  KashuBalanceSnapshot,
  KashuForecast,
  KashuLearningSummary,
} from "@forward/shared";

export type KashuLearningState = {
  snapshots: KashuBalanceSnapshot[];
  lastForecast: {
    asOf: string;
    projectedLow: number;
    lifestyleBurnDaily: number;
    days: Array<{ date: string; endingBalance: number }>;
  } | null;
  accuracy: number | null;
  lessons: string[];
  updatedAt: string | null;
};

const MAX_SNAPSHOTS = 12;

export function emptyLearning(): KashuLearningState {
  return {
    snapshots: [],
    lastForecast: null,
    accuracy: null,
    lessons: [],
    updatedAt: null,
  };
}

export function parseLearningJson(raw: string | null | undefined): KashuLearningState {
  if (!raw) return emptyLearning();
  try {
    const parsed = JSON.parse(raw) as Partial<KashuLearningState>;
    return {
      snapshots: Array.isArray(parsed.snapshots) ? parsed.snapshots.slice(-MAX_SNAPSHOTS) : [],
      lastForecast: parsed.lastForecast ?? null,
      accuracy: typeof parsed.accuracy === "number" ? parsed.accuracy : null,
      lessons: Array.isArray(parsed.lessons) ? parsed.lessons.slice(0, 8) : [],
      updatedAt: parsed.updatedAt ?? null,
    };
  } catch {
    return emptyLearning();
  }
}

export function predictedBalanceOn(state: KashuLearningState, dateYmd: string): number | null {
  const day = state.lastForecast?.days.find((d) => d.date === dateYmd);
  return day?.endingBalance ?? null;
}

/** Median absolute percentage error vs a $250 floor so small balances don't explode the score. */
export function accuracyFromSnapshots(snapshots: KashuBalanceSnapshot[]): number | null {
  const usable = snapshots.filter((s) => s.predictedBalance != null && s.error != null);
  if (usable.length < 2) return null;
  const ratios = usable.map((s) => {
    const predicted = Math.abs(s.predictedBalance ?? 0);
    const denom = Math.max(250, predicted);
    return Math.min(1, Math.abs(s.error ?? 0) / denom);
  });
  ratios.sort((a, b) => a - b);
  const mid = ratios[Math.floor(ratios.length / 2)] ?? 1;
  return Math.round((1 - mid) * 100) / 100;
}

export function applyObservation(
  state: KashuLearningState,
  actualBalance: number,
  source: KashuBalanceSnapshot["source"],
  at = new Date()
): KashuLearningState {
  const dateYmd = at.toISOString().slice(0, 10);
  const predicted = predictedBalanceOn(state, dateYmd);
  const error = predicted == null ? null : Math.round(actualBalance - predicted);
  const next: KashuLearningState = {
    ...state,
    snapshots: [
      ...state.snapshots,
      {
        at: at.toISOString(),
        predictedBalance: predicted,
        actualBalance: Math.round(actualBalance),
        error,
        source,
      },
    ].slice(-MAX_SNAPSHOTS),
    updatedAt: at.toISOString(),
  };
  next.accuracy = accuracyFromSnapshots(next.snapshots);
  return next;
}

export function rememberForecast(state: KashuLearningState, forecast: KashuForecast): KashuLearningState {
  return {
    ...state,
    lastForecast: {
      asOf: forecast.asOf,
      projectedLow: forecast.projectedLow,
      lifestyleBurnDaily: forecast.days.reduce((s, d) => s + d.lifestyleBurn, 0) / Math.max(1, forecast.days.length),
      days: forecast.days.map((d) => ({ date: d.date, endingBalance: d.endingBalance })),
    },
    updatedAt: new Date().toISOString(),
  };
}

export function blendConfidence(completeness: number, accuracy: number | null): number {
  if (accuracy == null) return Math.min(1, Math.round(completeness * 100) / 100);
  return Math.min(1, Math.round((completeness * 0.55 + accuracy * 0.45) * 100) / 100);
}

export function toLearningSummary(state: KashuLearningState): KashuLearningSummary {
  const last = state.snapshots[state.snapshots.length - 1] ?? null;
  return {
    accuracy: state.accuracy,
    observationCount: state.snapshots.length,
    lastError: last?.error ?? null,
    lessons: state.lessons,
  };
}

type TxLike = {
  postedAt: string | Date;
  amount: number;
  direction: string;
  classification: string | null;
  isTransfer?: boolean;
  description?: string;
};

/** Statement / ledger teaching: lifestyle drift, bill amount drift, missing expected bills. */
export function teachFromTransactions(
  transactions: TxLike[],
  bills: Array<{ title: string; currentAmount: number }>,
  modeledLifestyleDaily: number
): string[] {
  const lessons: string[] = [];
  const real = transactions.filter((t) => !t.isTransfer);
  if (real.length < 3) return lessons;

  const dates = new Set(
    real.map((t) => (typeof t.postedAt === "string" ? t.postedAt.slice(0, 10) : t.postedAt.toISOString().slice(0, 10)))
  );
  const dayCount = Math.max(1, dates.size);
  const lifestyleDebits = real.filter(
    (t) =>
      t.direction === "debit" &&
      (t.classification === "lifestyle" || t.classification === "discretionary" || t.classification === "necessary")
  );
  const lifestyleTotal = lifestyleDebits.reduce((s, t) => s + t.amount, 0);
  const actualDaily = lifestyleTotal / dayCount;
  if (actualDaily >= 5) {
    if (modeledLifestyleDaily <= 0) {
      lessons.push(
        `Statements show about $${Math.round(actualDaily)}/day in living spend. Set daily lifestyle burn so Safe to Spend isn't optimistic.`
      );
    } else if (Math.abs(actualDaily - modeledLifestyleDaily) / modeledLifestyleDaily > 0.25) {
      const dir = actualDaily > modeledLifestyleDaily ? "higher" : "lower";
      lessons.push(
        `Lifestyle spend is ${dir} than modeled ($${Math.round(actualDaily)}/day vs $${Math.round(modeledLifestyleDaily)}/day).`
      );
    }
  }

  for (const bill of bills) {
    const needle = bill.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const token = needle.split(" ").find((w) => w.length >= 4);
    if (!token) continue;
    const hits = real.filter(
      (t) => t.direction === "debit" && (t.description ?? "").toLowerCase().includes(token)
    );
    if (hits.length === 0) continue;
    const avg = hits.reduce((s, t) => s + t.amount, 0) / hits.length;
    if (bill.currentAmount > 0 && Math.abs(avg - bill.currentAmount) / bill.currentAmount > 0.12) {
      lessons.push(
        `${bill.title} looks like it drifted (modeled $${Math.round(bill.currentAmount)} vs recent ~$${Math.round(avg)}).`
      );
    }
  }

  return lessons.slice(0, 6);
}