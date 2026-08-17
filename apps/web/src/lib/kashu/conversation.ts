import type {
  KashuBillDraft,
  KashuChatTurn,
  KashuForecast,
  KashuItemFrequency,
  KashuPayFrequency,
  KashuPriority,
  KashuProfileFields,
  KashuProfilePatch,
  KashuProposal,
} from "@forward/shared";
import { getOpenAiApiKey, OPENAI_MODEL } from "../openai-config";

export type KashuKnownBill = {
  id: string;
  title: string;
  currentAmount: number;
  type: string;
  frequency: string | null;
  dueDay: number | null;
};

const MONTHS: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
};

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function moneyLabel(n: number) {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function nextWeekday(from: Date, weekday: number): Date {
  const cur = startOfDay(from);
  const delta = (weekday - cur.getDay() + 7) % 7;
  return addDays(cur, delta);
}

export function parseMoneyAmount(raw: string): number | null {
  const cleaned = raw.replace(/[$,\s]/g, "").replace(/k$/i, "");
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (/k$/i.test(raw.trim())) return Math.round(n * 1000);
  return n;
}

function normalizeTitle(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(the|my|our|a|an|payment|bill|fee)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titlesMatch(a: string, b: string): boolean {
  const na = normalizeTitle(a);
  const nb = normalizeTitle(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

export function extractSpendAmount(question: string): number | null {
  const m =
    question.match(
      /(?:can i (?:afford|spend)|spend|afford|buy)\s*\$?\s*([\d,]+(?:\.\d+)?)/i
    ) ?? question.match(/\$\s*([\d,]+(?:\.\d+)?)/);
  if (!m?.[1]) return null;
  const n = Number(m[1].replace(/,/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseFrequency(chunk: string): {
  frequency: KashuItemFrequency | KashuPayFrequency;
  intervalDays: number | null;
} | null {
  const t = chunk.toLowerCase();
  if (/every\s*14\s*days|bi-?weekly|every\s+two\s+weeks|every\s+other\s+week/.test(t)) {
    return { frequency: "BIWEEKLY", intervalDays: 14 };
  }
  if (/twice\s+(a|per)\s+month|semi-?monthly|15th\s+and\s+(30|31|1st|last)/.test(t)) {
    return { frequency: "SEMI_MONTHLY", intervalDays: 15 };
  }
  if (/every\s+week|weekly|each\s+week/.test(t)) {
    return { frequency: "WEEKLY", intervalDays: 7 };
  }
  if (/once\s+a\s+year|annual|yearly/.test(t)) {
    return { frequency: "ANNUAL", intervalDays: 365 };
  }
  if (/\/mo\b|a\s+month|per\s+month|monthly|each\s+month/.test(t)) {
    return { frequency: "MONTHLY", intervalDays: null };
  }
  if (/irregular|whenever|varies/.test(t)) {
    return { frequency: "IRREGULAR", intervalDays: null };
  }
  return null;
}

function parseDueDay(chunk: string): number | null {
  const ordinal = chunk.match(/\bon\s+the\s+(\d{1,2})(?:st|nd|rd|th)?\b/i);
  if (ordinal) {
    const d = Number(ordinal[1]);
    if (d >= 1 && d <= 31) return d;
  }
  const dayOf = chunk.match(/\b(?:due|on)\s+(\d{1,2})(?:st|nd|rd|th)?\b/i);
  if (dayOf) {
    const d = Number(dayOf[1]);
    if (d >= 1 && d <= 31) return d;
  }
  return null;
}

function parseNextPayday(text: string, asOf: Date): string | null {
  const iso = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (iso) return iso[1];

  const named = text.match(
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?\b/i
  );
  if (named) {
    const month = MONTHS[named[1]!.toLowerCase()];
    const day = Number(named[2]);
    if (month != null && day >= 1 && day <= 31) {
      let d = new Date(asOf.getFullYear(), month, day);
      if (d < startOfDay(asOf)) d = new Date(asOf.getFullYear() + 1, month, day);
      return ymd(d);
    }
  }

  const paydayClause =
    text.match(
      /(?:next\s+payday|payday|get\s+paid(?:\s+next)?|paid\s+(?:next|on))\s+(?:is\s+|on\s+)?(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i
    ) ?? text.match(/\b(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i);

  if (paydayClause && /payday|get paid|paid/i.test(text)) {
    const token = paydayClause[1]!.toLowerCase();
    if (token === "today") return ymd(asOf);
    if (token === "tomorrow") return ymd(addDays(asOf, 1));
    const wd = WEEKDAYS.indexOf(token);
    if (wd >= 0) return ymd(nextWeekday(asOf, wd));
  }
  return null;
}

function classifyBill(title: string): {
  type: KashuBillDraft["type"];
  priority: KashuPriority;
} {
  const t = title.toLowerCase();
  if (/rent|mortgage|housing|landlord|lease/.test(t)) return { type: "HOUSING", priority: "MANDATORY" };
  if (/netflix|spotify|prime|disney|apple\s*tv|youtube|hulu|subscription/.test(t)) {
    return { type: "SUBSCRIPTION", priority: "DISCRETIONARY" };
  }
  if (/phone|internet|hydro|electric|gas bill|utility|insurance|water|property tax/.test(t)) {
    return { type: "BILL", priority: "MANDATORY" };
  }
  if (/car loan|auto loan|credit card|student loan|debt/.test(t)) {
    return { type: "DEBT", priority: "MANDATORY" };
  }
  if (/car|vehicle|lincoln|honda|toyota|ford/.test(t)) return { type: "COMMITMENT", priority: "MANDATORY" };
  if (/dad|mom|family|child support|alimony|transfer/.test(t)) {
    return { type: "COMMITMENT", priority: "MANDATORY" };
  }
  if (/groc|fuel|gas\b|coffee|food|dining|restaurant/.test(t)) {
    return { type: "LIVING_EXPENSE", priority: "NECESSARY" };
  }
  return { type: "BILL", priority: "MANDATORY" };
}

const BILL_NAME =
  /\b(rent|mortgage|phone|internet|hydro|electric|insurance|car(?:\s+payment)?|vehicle|netflix|spotify|child support|groceries|fuel|gas|utilities|water|daycare|tuition|storage|gym)\b/i;

function extractBills(text: string): KashuBillDraft[] {
  const bills: KashuBillDraft[] = [];
  const seen = new Set<string>();

  const sentences = text.split(/[.;\n]+/);
  for (const sentence of sentences) {
    const s = sentence.trim();
    if (!s || /make|earn|take-?home|paycheck|salary|balance|checking|floor|emergency|spend about/i.test(s) && !BILL_NAME.test(s)) {
      if (!BILL_NAME.test(s)) continue;
    }

    const named = [
      ...s.matchAll(
        /(?:my\s+|the\s+)?(rent|mortgage|phone|internet|hydro|electric(?:ity)?|home insurance|car insurance|insurance|car(?:\s+payment)?|vehicle|netflix|spotify|child support|groceries|fuel|daycare|gym|storage|utilities|water|property tax)(?:\s+payment)?\s*(?:is|of|:)?\s*\$?\s*([\d,]+(?:\.\d+)?)/gi
      ),
      ...s.matchAll(
        /\$?\s*([\d,]+(?:\.\d+)?)\s+(?:for\s+|on\s+)?(?:my\s+|the\s+)?(rent|mortgage|phone|internet|hydro|electric(?:ity)?|insurance|car(?:\s+payment)?|netflix|spotify|child support|groceries|fuel|daycare|gym)/gi
      ),
    ];

    for (const m of named) {
      let title: string;
      let amountRaw: string;
      if (/^\d/.test(m[1] ?? "") || (m[1] ?? "").includes(",")) {
        amountRaw = m[1]!;
        title = m[2]!;
      } else {
        title = m[1]!;
        amountRaw = m[2]!;
      }
      const amount = parseMoneyAmount(amountRaw);
      if (!amount) continue;
      const key = normalizeTitle(title);
      if (seen.has(key)) continue;
      seen.add(key);
      const freq = parseFrequency(s) ?? { frequency: "MONTHLY" as const, intervalDays: null };
      const { type, priority } = classifyBill(title);
      const dueDay = parseDueDay(s);
      bills.push({
        title: title.replace(/\b\w/g, (c) => c.toUpperCase()),
        amount,
        type,
        frequency: (freq.frequency === "IRREGULAR" ? "MONTHLY" : freq.frequency) as KashuItemFrequency,
        intervalDays: freq.intervalDays,
        dueDay,
        priority,
        autoPay: /auto[- ]?pay/i.test(s),
      });
    }
  }

  // "every 14 days · $380 Lincoln" style leftover: amount near a title word
  if (bills.length === 0) {
    for (const m of text.matchAll(
      /([A-Za-z][A-Za-z0-9 &'-]{2,28})\s+[—\-:]?\s*\$?\s*([\d,]+)(?:\s*(?:every\s+\d+\s+days|biweekly|monthly|weekly))?/g
    )) {
      const title = m[1]!.trim();
      if (/^(i|my|we|the|and|next|checking|balance|floor|income|payday)$/i.test(title)) continue;
      const amount = parseMoneyAmount(m[2]!);
      if (!amount || amount < 15) continue;
      const around = text.slice(Math.max(0, (m.index ?? 0) - 24), (m.index ?? 0) + m[0].length + 24);
      const freq = parseFrequency(around) ?? { frequency: "MONTHLY" as const, intervalDays: null };
      const { type, priority } = classifyBill(title);
      bills.push({
        title,
        amount,
        type,
        frequency: (freq.frequency === "IRREGULAR" ? "MONTHLY" : freq.frequency) as KashuItemFrequency,
        intervalDays: freq.intervalDays,
        dueDay: parseDueDay(around),
        priority,
      });
    }
  }

  return bills;
}

function extractProfile(text: string, asOf: Date): KashuProfilePatch {
  const patch: KashuProfilePatch = {};
  const t = text.toLowerCase();

  const incomeMatch =
    text.match(
      /(?:i\s+(?:make|earn|net|take\s*home|get\s+paid)|take-?home|paycheck|salary|income(?:\s+is)?)\s*(?:about\s+|around\s+|roughly\s+)?\$?\s*([\d,]+(?:\.\d+)?)\s*(k)?/i
    ) ?? text.match(/\$?\s*([\d,]+)\s*(k)?\s*(?:net\s+)?(?:every|a|per|\/)\s*(two\s+weeks|bi-?week|week|month)/i);

  const freq = parseFrequency(text);
  if (freq && /pay|income|make|earn|salary|paycheck|biweekly|weekly|monthly/i.test(text)) {
    if (
      freq.frequency === "WEEKLY" ||
      freq.frequency === "BIWEEKLY" ||
      freq.frequency === "SEMI_MONTHLY" ||
      freq.frequency === "MONTHLY" ||
      freq.frequency === "IRREGULAR"
    ) {
      patch.payFrequency = freq.frequency;
    }
  }

  if (incomeMatch) {
    let amount = parseMoneyAmount(`${incomeMatch[1]}${incomeMatch[2] ?? ""}`);
    if (amount != null) {
      const window = text.slice(
        Math.max(0, (incomeMatch.index ?? 0) - 10),
        (incomeMatch.index ?? 0) + incomeMatch[0].length + 40
      );
      const per = parseFrequency(window) ?? freq;
      if (per?.frequency === "WEEKLY") amount = Math.round(amount * 4.33);
      else if (per?.frequency === "BIWEEKLY") amount = Math.round(amount * 2.17);
      else if (per?.frequency === "SEMI_MONTHLY") amount = Math.round(amount * 2);
      patch.monthlyTakeHome = amount;
    }
  }

  if (/variable|commission|tips|gig|overtime|irregular income/.test(t)) {
    patch.incomeKind = "VARIABLE";
    const between = text.match(/between\s+\$?\s*([\d,]+)\s*(?:and|–|-)\s*\$?\s*([\d,]+)/i);
    if (between) {
      const a = parseMoneyAmount(between[1]!);
      const b = parseMoneyAmount(between[2]!);
      if (a != null && b != null) {
        patch.incomeConservative = Math.min(a, b);
        patch.incomeHigh = Math.max(a, b);
        patch.monthlyTakeHome = patch.monthlyTakeHome ?? Math.round((a + b) / 2);
      }
    }
  }

  const balance = text.match(
    /(?:checking(?:\s+balance)?|operating\s+balance|(?:current\s+)?balance|in checking|i have|currently have)\s*(?:is\s+|of\s+)?\$?\s*([\d,]+(?:\.\d+)?)/i
  );
  if (balance) patch.liquidBalance = parseMoneyAmount(balance[1]!);

  const floor = text.match(
    /(?:safety\s+floor|always\s+leave|never\s+go\s+below|untouched|leave\s+untouched)\s*(?:of\s+|at\s+)?\$?\s*([\d,]+)/i
  );
  if (floor) patch.safetyFloor = parseMoneyAmount(floor[1]!);

  const emergency = text.match(
    /emergency\s+(?:fund|reserve|savings|money)\s*(?:is\s+|of\s+)?\$?\s*([\d,]+)/i
  );
  if (emergency) patch.emergencyReserve = parseMoneyAmount(emergency[1]!);

  const daily = text.match(
    /(?:spend|burn|lifestyle)\s+(?:about\s+|around\s+)?\$?\s*([\d,]+)\s*(?:a|per|\/)\s*day/i
  );
  if (daily) patch.lifestyleBurnDaily = parseMoneyAmount(daily[1]!);

  const monthlyLife = text.match(
    /(?:spend|burn)\s+(?:about\s+)?\$?\s*([\d,]+)\s*(?:a|per|\/)\s*month\s+(?:on\s+)?(?:food|groc|gas|lifestyle|living)/i
  );
  if (monthlyLife && patch.lifestyleBurnDaily == null) {
    const n = parseMoneyAmount(monthlyLife[1]!);
    if (n) patch.lifestyleBurnDaily = Math.round(n / 30);
  }

  const payday = parseNextPayday(text, asOf);
  if (payday && /pay|income|make|earn|salary/i.test(text)) patch.nextPayday = new Date(`${payday}T12:00:00`).toISOString();

  const anchor = parseDueDay(text);
  if (anchor && patch.payFrequency === "MONTHLY") patch.paydayAnchorDay = anchor;

  return patch;
}

function profileHasValues(patch: KashuProfilePatch): boolean {
  return Object.values(patch).some((v) => v != null);
}

function profileLabel(patch: KashuProfilePatch): string {
  const bits: string[] = [];
  if (patch.monthlyTakeHome != null) bits.push(`take-home ${moneyLabel(patch.monthlyTakeHome)}/mo`);
  if (patch.payFrequency) bits.push(patch.payFrequency.toLowerCase().replace("_", " "));
  if (patch.nextPayday) bits.push(`next payday ${patch.nextPayday.slice(0, 10)}`);
  if (patch.liquidBalance != null) bits.push(`balance ${moneyLabel(patch.liquidBalance)}`);
  if (patch.safetyFloor != null) bits.push(`floor ${moneyLabel(patch.safetyFloor)}`);
  if (patch.emergencyReserve != null) bits.push(`emergency ${moneyLabel(patch.emergencyReserve)}`);
  if (patch.incomeKind === "VARIABLE") bits.push("variable income");
  if (patch.lifestyleBurnDaily != null) bits.push(`daily burn ${moneyLabel(patch.lifestyleBurnDaily)}`);
  return `Set ${bits.join(" · ") || "income & buffers"}`;
}

function billLabel(kind: "add_bill" | "update_bill", bill: KashuBillDraft): string {
  const verb = kind === "update_bill" ? "Update" : "Add";
  const freq =
    bill.frequency === "BIWEEKLY"
      ? "every 14 days"
      : bill.frequency === "WEEKLY"
        ? "weekly"
        : bill.frequency === "ANNUAL"
          ? "yearly"
          : "monthly";
  const due = bill.dueDay ? ` on the ${bill.dueDay}` : "";
  return `${verb} ${bill.title} · ${moneyLabel(bill.amount)} ${freq}${due}`;
}

function slugId(prefix: string, seed: string, i: number): string {
  const s = normalizeTitle(seed).replace(/\s+/g, "-").slice(0, 24) || "x";
  return `${prefix}-${s}-${i}`;
}

export function parseKashuUtterance(
  text: string,
  opts?: { asOf?: Date; existingBills?: KashuKnownBill[] }
): KashuProposal[] {
  const asOf = opts?.asOf ?? new Date();
  const existing = opts?.existingBills ?? [];
  const proposals: KashuProposal[] = [];
  const patch = extractProfile(text, asOf);
  if (profileHasValues(patch)) {
    proposals.push({
      kind: "profile",
      id: "p-profile",
      label: profileLabel(patch),
      patch,
    });
  }

  const bills = extractBills(text);
  bills.forEach((bill, i) => {
    const match = existing.find((e) => titlesMatch(e.title, bill.title));
    const kind = match ? "update_bill" : "add_bill";
    proposals.push({
      kind,
      id: slugId(kind === "update_bill" ? "u" : "b", bill.title, i),
      label: billLabel(kind, bill),
      existingId: match?.id,
      bill,
    });
  });

  return proposals;
}

export function isConfirmUtterance(text: string): boolean {
  const t = text.trim().toLowerCase();
  return /^(yes|yep|yeah|ok|okay|sure|do it|add (them|those|it)|confirm|looks good|apply|save( them)?|go ahead)[\s!.]*$/.test(
    t
  );
}

export function isRejectUtterance(text: string): boolean {
  const t = text.trim().toLowerCase();
  return /^(no|nope|skip|don't|dont|cancel|never ?mind|not yet)[\s!.]*$/.test(t);
}

export function buildFollowUps(
  profile: KashuProfileFields,
  forecast: KashuForecast,
  billCount: number
): string[] {
  const out: string[] = [];
  if (!(profile.monthlyTakeHome ?? 0) || !profile.nextPayday) {
    out.push("I make $3,700 every two weeks. Next payday is Friday.");
  }
  if (profile.liquidBalance == null) {
    out.push("My checking balance is $4,200. Safety floor $500.");
  }
  if (billCount < 1) {
    out.push("Rent is $1,800 on the 1st. Car is $380 every 14 days.");
  }
  if (forecast.safeToSpend > 0) {
    out.push(`Can I spend $400 this weekend?`);
  }
  if (forecast.collisions.length > 0) {
    out.push("Which payment is creating the problem?");
  }
  return out.slice(0, 4);
}

export function answerFromForecast(
  question: string,
  forecast: KashuForecast,
  whatIfExplanation?: string | null
): string {
  const q = question.toLowerCase();
  if (whatIfExplanation) return whatIfExplanation;

  if (/safe to spend|can i spend|how much.*(spend|use)|afford/.test(q)) {
    return `Safe to Spend is ${moneyLabel(forecast.safeToSpend)} after ${moneyLabel(forecast.reservedObligations)} reserved and a ${moneyLabel(forecast.safetyFloor)} safety floor. ${forecast.message}`;
  }
  if (/projected low|lowest|short before|before payday/.test(q)) {
    return `Projected low is ${moneyLabel(forecast.projectedLow)}${forecast.projectedLowDate ? ` on ${forecast.projectedLowDate}` : ""}. Next payday: ${forecast.nextPayday ?? "not set"}.`;
  }
  if (/collision|shortfall|problem|tight/.test(q)) {
    if (!forecast.collisions.length) {
      return "No cash-flow collisions in the next 30 days above your safety floor.";
    }
    return forecast.collisions
      .slice(0, 3)
      .map((c) => `${c.date}: ${c.title} creates a ${moneyLabel(c.shortfall)} shortfall.`)
      .join(" ");
  }
  if (/timing|move|optimizer/.test(q) && forecast.timingScenarios.length) {
    return forecast.timingScenarios.map((s) => s.note).join(" ");
  }
  if (/emergency|reserve|buffer|floor/.test(q)) {
    return (
      forecast.emergencyInsight?.message ??
      `Safety floor ${moneyLabel(forecast.safetyFloor)} is excluded from Safe to Spend. Emergency reserve ${moneyLabel(forecast.emergencyReserve)} is protected.`
    );
  }
  if (/payday|next pay|paycheque|paycheck/.test(q)) {
    return `Next payday is ${forecast.nextPayday ?? "not set"} (${forecast.daysUntilPayday ?? "?"} days). Frequency: ${forecast.payFrequency ?? "unknown"}.`;
  }
  return forecast.message;
}

export function composeProposalAnswer(proposals: KashuProposal[], forecast: KashuForecast): string {
  if (!proposals.length) return forecast.message;
  const lines = proposals.map((p) => `• ${p.label}`);
  return `I can add this to your Kashu model — confirm if it looks right:\n${lines.join("\n")}\n\nNothing is saved until you confirm.`;
}

type LlmExtraction = {
  patch?: KashuProfilePatch;
  bills?: KashuBillDraft[];
  reply?: string;
};

function mergePatches(base: KashuProfilePatch, extra?: KashuProfilePatch): KashuProfilePatch {
  if (!extra) return base;
  return {
    monthlyTakeHome: base.monthlyTakeHome ?? extra.monthlyTakeHome,
    payFrequency: base.payFrequency ?? extra.payFrequency,
    nextPayday: base.nextPayday ?? extra.nextPayday,
    paydayAnchorDay: base.paydayAnchorDay ?? extra.paydayAnchorDay,
    liquidBalance: base.liquidBalance ?? extra.liquidBalance,
    safetyFloor: base.safetyFloor ?? extra.safetyFloor,
    emergencyReserve: base.emergencyReserve ?? extra.emergencyReserve,
    lifestyleBurnDaily: base.lifestyleBurnDaily ?? extra.lifestyleBurnDaily,
    incomeKind: base.incomeKind ?? extra.incomeKind,
    incomeConservative: base.incomeConservative ?? extra.incomeConservative,
    incomeHigh: base.incomeHigh ?? extra.incomeHigh,
  };
}

function mergeBills(ruleBills: KashuBillDraft[], llmBills: KashuBillDraft[] | undefined): KashuBillDraft[] {
  const out = [...ruleBills];
  for (const b of llmBills ?? []) {
    if (!b.title || !(b.amount > 0)) continue;
    if (out.some((x) => titlesMatch(x.title, b.title))) continue;
    out.push(b);
  }
  return out;
}

export async function extractWithLlm(input: {
  message: string;
  history: KashuChatTurn[];
  profile: KashuProfileFields;
  bills: KashuKnownBill[];
  forecast: Pick<
    KashuForecast,
    | "safeToSpend"
    | "projectedLow"
    | "projectedLowDate"
    | "nextPayday"
    | "collisions"
    | "message"
    | "reservedObligations"
    | "safetyFloor"
    | "emergencyReserve"
  >;
}): Promise<LlmExtraction | null> {
  const apiKey = getOpenAiApiKey();
  if (!apiKey) return null;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        temperature: 0.15,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You are Kashu, MotiveLife cash-flow intelligence. The user talks in plain language about money.
Extract structured updates for their model. Never invent bills or amounts they did not mention.
If they are asking a question (afford, payday, collision), leave patch/bills empty and write a short reply using ONLY the forecast JSON.
If they are teaching you income/bills/balance, fill patch and bills and write a short confirm-style reply.
Convert per-paycheck amounts to monthlyTakeHome (weekly ×4.33, biweekly ×2.17, semi-monthly ×2).
nextPayday must be ISO datetime if you can resolve a date.
Output JSON only.`,
          },
          {
            role: "user",
            content: JSON.stringify({
              message: input.message,
              history: input.history.slice(-8),
              existingProfile: {
                monthlyTakeHome: input.profile.monthlyTakeHome,
                payFrequency: input.profile.payFrequency,
                nextPayday: input.profile.nextPayday,
                liquidBalance: input.profile.liquidBalance,
                safetyFloor: input.profile.safetyFloor,
                emergencyReserve: input.profile.emergencyReserve,
                incomeKind: input.profile.incomeKind,
              },
              existingBills: input.bills.map((b) => ({
                id: b.id,
                title: b.title,
                amount: b.currentAmount,
                type: b.type,
                frequency: b.frequency,
                dueDay: b.dueDay,
              })),
              forecast: input.forecast,
              schema: {
                reply: "string",
                patch: {
                  monthlyTakeHome: "number|null",
                  payFrequency: "WEEKLY|BIWEEKLY|SEMI_MONTHLY|MONTHLY|IRREGULAR|null",
                  nextPayday: "ISO|null",
                  liquidBalance: "number|null",
                  safetyFloor: "number|null",
                  emergencyReserve: "number|null",
                  lifestyleBurnDaily: "number|null",
                  incomeKind: "FIXED|VARIABLE|null",
                  incomeConservative: "number|null",
                  incomeHigh: "number|null",
                },
                bills: [
                  {
                    title: "string",
                    amount: "number",
                    type: "HOUSING|SUBSCRIPTION|BILL|LIVING_EXPENSE|COMMITMENT|DEBT",
                    frequency: "WEEKLY|BIWEEKLY|SEMI_MONTHLY|MONTHLY|ANNUAL|ONE_OFF",
                    intervalDays: "number|null",
                    dueDay: "1-31|null",
                    priority: "MANDATORY|NECESSARY|DISCRETIONARY|LIFESTYLE",
                    autoPay: "boolean",
                  },
                ],
              },
            }),
          },
        ],
      }),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = data.choices?.[0]?.message?.content?.trim();
    if (!raw) return null;
    return JSON.parse(raw) as LlmExtraction;
  } catch (error) {
    console.warn("[kashu/conversation] llm extract failed", error);
    return null;
  }
}

export async function interpretKashuMessage(input: {
  message: string;
  history: KashuChatTurn[];
  profile: KashuProfileFields;
  bills: KashuKnownBill[];
  forecast: KashuForecast;
  asOf?: Date;
}): Promise<{ proposals: KashuProposal[]; llmReply: string | null }> {
  const rule = parseKashuUtterance(input.message, {
    asOf: input.asOf,
    existingBills: input.bills,
  });
  const llm = await extractWithLlm({
    message: input.message,
    history: input.history,
    profile: input.profile,
    bills: input.bills,
    forecast: input.forecast,
  });

  const ruleProfile = rule.find((p) => p.kind === "profile");
  const mergedPatch = mergePatches(
    ruleProfile && ruleProfile.kind === "profile" ? ruleProfile.patch : {},
    llm?.patch
  );
  const bills = mergeBills(
    rule
      .filter((p): p is Extract<KashuProposal, { kind: "add_bill" | "update_bill" }> => p.kind !== "profile")
      .map((p) => p.bill),
    llm?.bills
  );

  const proposals: KashuProposal[] = [];
  if (profileHasValues(mergedPatch)) {
    proposals.push({
      kind: "profile",
      id: "p-profile",
      label: profileLabel(mergedPatch),
      patch: mergedPatch,
    });
  }
  bills.forEach((bill, i) => {
    const match = input.bills.find((e) => titlesMatch(e.title, bill.title));
    const kind = match ? "update_bill" : "add_bill";
    proposals.push({
      kind,
      id: slugId(kind === "update_bill" ? "u" : "b", bill.title, i),
      label: billLabel(kind, bill),
      existingId: match?.id,
      bill,
    });
  });

  return { proposals, llmReply: llm?.reply?.trim() || null };
}

export { titlesMatch };
