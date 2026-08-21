import type {
  KashuItemFrequency,
  KashuPriority,
  KashuStatementParseResult,
  KashuTxClassification,
} from "@forward/shared";
import { detectBankTemplate } from "@/lib/kashu/bank-templates";

const MONTHS: Record<string, number> = {
  JAN: 0,
  FEB: 1,
  MAR: 2,
  APR: 3,
  MAY: 4,
  JUN: 5,
  JUL: 6,
  AUG: 7,
  SEP: 8,
  OCT: 9,
  NOV: 10,
  DEC: 11,
};

/** True for TD Canada / similar jammed statement text. */
export function looksLikeTdCanadaStatement(text: string): boolean {
  const t = text.slice(0, 2500).toUpperCase();
  return (
    (t.includes("STATEMENT OF ACCOUNT") || t.includes("STATEMENTOFACCOUNT")) &&
    (t.includes("WITHDRAWALS") || t.includes("DESCRIPTIONWITHDRAWALS")) &&
    (/\b(MSP|MTG|BPY|APY)\b/.test(t) || t.includes("STARTING BALANCE") || t.includes("STARTINGBALANCE"))
  );
}

function compactKey(s: string): string {
  return s.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function statementYearHints(text: string): number[] {
  const years = new Set<number>();
  // Spaced: "MAY 29/26 - JUN 30/26"  or jammed: "AUG29/25-SEP29/25"
  const patterns = [
    /\b([A-Z]{3})\s+(\d{1,2})\/(\d{2})\s*[-–]\s*([A-Z]{3})\s+(\d{1,2})\/(\d{2})\b/gi,
    /\b([A-Z]{3})(\d{1,2})\/(\d{2})\s*[-–]\s*([A-Z]{3})(\d{1,2})\/(\d{2})\b/gi,
  ];
  for (const re of patterns) {
    for (const m of text.matchAll(re)) {
      const a = Number(m[3]);
      const b = Number(m[6]);
      if (a >= 20 && a <= 40) years.add(2000 + a);
      if (b >= 20 && b <= 40) years.add(2000 + b);
    }
  }
  if (!years.size) {
    for (const m of text.matchAll(/\b([A-Z]{3})\s*(\d{1,2})\/(\d{2})\b/g)) {
      const yy = Number(m[3]);
      if (yy >= 20 && yy <= 40) years.add(2000 + yy);
    }
  }
  if (!years.size) years.add(new Date().getFullYear());
  return [...years].sort((a, b) => a - b);
}

function resolvePostedAt(
  mon: string,
  day: number,
  years: number[],
  prevMon: number | null
): string {
  const mi = MONTHS[mon.toUpperCase()] ?? 0;
  let year = years[years.length - 1] ?? new Date().getFullYear();
  if (years.length >= 2) {
    const lo = years[0]!;
    const hi = years[years.length - 1]!;
    // Dec→Jan wrap across statement years
    if (prevMon != null && prevMon >= 10 && mi <= 2) year = hi;
    else if (mi >= 10) year = lo;
    else year = hi;
  }
  const d = new Date(Date.UTC(year, mi, day));
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  return d.toISOString().slice(0, 10);
}

export function friendlyMerchantTitle(raw: string): string {
  const u = raw.toUpperCase().replace(/\s+/g, " ").trim();
  const c = compactKey(raw);
  if (/COX\s*AUTOMOTIVE/.test(u) || c.includes("COXAUTOMOTIVE")) return "Cox Automotive";
  if ((/RBC/.test(u) || c.includes("RBC")) && (/MTG|MORTGAGE/.test(u) || c.includes("MTG"))) {
    return "RBC Mortgage";
  }
  if (/AVIVA/.test(u) || c.includes("AVIVA")) return "Aviva Home/Auto";
  if (/BELL\s*CANADA/.test(u) || c.includes("BELLCANADA")) return "Bell Canada";
  if (/LINCOLN/.test(u) || c.includes("LINCOLN")) return "Lincoln Auto";
  if (/SANDPIPER/.test(u) || c.includes("SANDPIPER")) return "Sandpiper Energy";
  if (/ENWIN/.test(u) || c.includes("ENWIN")) return "Enwin Utilities";
  if (/ENBRIDGE/.test(u) || c.includes("ENBRIDGE")) return "Enbridge Gas";
  if (/NETFLIX/.test(u) || c.includes("NETFLIX")) return "Netflix";
  if (/PLANET\s*FITNESS/.test(u) || c.includes("PLANETFITNESS")) return "Planet Fitness";
  if (/CITY\s*OF\s*WINDSOR/.test(u) || c.includes("CITYOFWINDSOR")) return "Windsor Property Tax";
  if (/CANADA\s*LIFE/.test(u) || c.includes("CANADALIFE")) return "Canada Life";
  if (/AMEX/.test(u) || c.includes("AMEX")) return "Amex payment";
  // Strip PAD codes / trailing markers
  return raw
    .replace(/\b(BPY|APY|MSP|MTG|INS|FEE|LOAN|_F|_V)\b/gi, " ")
    .replace(/\*+[A-Za-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

function normalizeMerchantKey(raw: string): string {
  const title = friendlyMerchantTitle(raw).toUpperCase();
  return title.replace(/[^A-Z0-9 ]/g, "").replace(/\s+/g, " ").trim().slice(0, 80);
}

/**
 * Concept calendar noise: coffee, groceries, e-transfers, ATM, retail.
 * Matches both spaced and jammed TD text (TIMHORTONS / SENDE-TFR).
 */
function isNoise(desc: string): boolean {
  const c = compactKey(desc);
  const noiseCompact = [
    "TIMHORTONS",
    "SKIPTHEDISHES",
    "DOMINO",
    "COSTCO",
    "PETROCANADA",
    "7ELEVEN",
    "PODPFEE",
    "ATMW",
    "PTSTO",
    "TFRTO",
    "TFRFR",
    "SENDETFR",
    "SENDETRANSFER",
    "OPENAI",
    "PAYPAL",
    "WALMART",
    "REXALL",
    "SUBWAY",
    "LOVISA",
    "SOFTMOC",
    "BARBAR",
    "RONA",
    "MACSCONV",
    "DISTROKID",
    "FYIDOCTOR",
    "SHOPPERS",
    "CANADIANTIRE",
    "CANTIRE",
    "ALYUSER",
    "GIGLIOS",
    "ANTONINO",
    "CALDWELLGAS",
    "PERFORMANCEFOR",
    "NESTLECANADA",
    "BASKIN",
    "METRO",
    "NIZAM",
    "FAYMART",
    "COMOSPIZZA",
    "MOORESCLOTHING",
    "RAMZI",
    "BLOOMEX",
    "COLUMBIASPORTS",
    "SQCAF",
    "407ETR",
    "CASHWITHDRA",
    "CREDITCARDPAYMENT",
    "FAIRSTONE",
    "MBNA",
    "FLEXITI",
    "OVERDRAFTINTEREST",
    "CHQRETURN",
    "MONTHLYACCOUNTFEE",
    "NONTDATM",
    "TDATM",
    "GOOGLEPAYMENT",
    "GCASHWITHDRA",
  ];
  if (noiseCompact.some((n) => c.includes(n))) return true;
  // Card / POS junk codes like JO1234, LB99
  if (/^(JO|LB|LR|IZ|JZ|JQ|LW|IY|IB|GC)\d+/i.test(c)) return true;
  return false;
}

function classifyTd(desc: string): {
  direction: "debit" | "credit";
  classification: KashuTxClassification;
  isTransfer: boolean;
  isOneOff: boolean;
  priority?: KashuPriority;
} {
  const d = desc.toUpperCase();
  const c = compactKey(desc);
  const bank = detectBankTemplate(`TD ${desc}`);

  // Internal transfers / e-transfers out
  if (
    /SENDETFR|SENDETRANSFER|TFRTO|PTSTO|CREDITCARDPAYMENT/.test(c) ||
    /SEND E-TFR|TFR-TO|PTS TO:|CREDIT CARD PAYMENT|AMEX\s*BILL/.test(d) ||
    (bank.transfer.test(desc) && /SEND|TO:|PMT|PAYMENT/.test(d))
  ) {
    return {
      direction: "debit",
      classification: "transfer",
      isTransfer: true,
      isOneOff: true,
    };
  }
  if (
    ((/TFRFR|ETRANSFER/.test(c) || /TFR-FR|E-TRANSFER \*\*\*/.test(d)) && !/SENDETFR/.test(c)) ||
    (bank.transfer.test(desc) && /FROM|RECEIVED|INCOMING/.test(d))
  ) {
    return {
      direction: "credit",
      classification: "transfer",
      isTransfer: true,
      isOneOff: true,
    };
  }

  // Payroll — bank template + Cox Automotive MSP
  if (/COXAUTOMOTIVE/.test(c) && /MSP/.test(c)) {
    return {
      direction: "credit",
      classification: "income",
      isTransfer: false,
      isOneOff: false,
      priority: "MANDATORY",
    };
  }
  if (
    (bank.payroll.test(desc) || (/\bMSP\b/.test(d) && !/AMEX|BILL PYMT|GOOGLE/.test(d) && !/GOOGLE/.test(c))) &&
    !bank.transfer.test(desc)
  ) {
    return {
      direction: "credit",
      classification: "income",
      isTransfer: false,
      isOneOff: false,
      priority: "MANDATORY",
    };
  }

  // Hard commitments (calendar anchors)
  if (
    /MTG|MORTGAGE|AVIVA|BELLCANADA|LINCOLN|ENWIN|ENBRIDGE|SANDPIPER|CANADALIFE|CITYOFWINDSOR|NETFLIX|PLANETFITNESS|NBCLINE|RBCLOAN|LOANINSURANCE/.test(
      c
    ) ||
    /MTG|MORTGAGE|AVIVA|BELL\s*CANADA|LINCOLN|ENWIN|ENBRIDGE|SANDPIPER|CANADA\s*LIFE|CITY\s*OF\s*WINDSOR|NETFLIX|PLANET\s*FITNESS|NBC\/LINE|RBC\s*LOAN|LOAN INSURANCE/.test(
      d
    )
  ) {
    const lifestyle = /NETFLIX|PLANETFITNESS/.test(c);
    return {
      direction: "debit",
      classification: lifestyle ? "lifestyle" : "obligation",
      isTransfer: false,
      isOneOff: false,
      priority: lifestyle ? "LIFESTYLE" : "MANDATORY",
    };
  }

  if (/BPY|APY|\bINS\b|\bFEE\b|\bLOAN\b|\bTAX\b/.test(d) || /BPY|APY/.test(c)) {
    return {
      direction: "debit",
      classification: "obligation",
      isTransfer: false,
      isOneOff: false,
      priority: "NECESSARY",
    };
  }

  return {
    direction: "debit",
    classification: "discretionary",
    isTransfer: false,
    isOneOff: true,
    priority: "DISCRETIONARY",
  };
}

/**
 * TD line shape:
 *   DESCRIPTION + AMOUNT + MON + DD + [running balance] + [OD]
 * Examples:
 *   `2600550RBC PYT   MTG3,888.61JUN02`
 *   `2600718RBC PYT   MTG3,888.61MAY04712.81OD`
 */
const TD_LINE_RE =
  /^(.*?)(\d{1,3}(?:,\d{3})*\.\d{2})(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)(\d{2})(?:\d{1,3}(?:,\d{3})*\.\d{2})?(?:\s*OD)?$/i;

/**
 * Parse TD Canada Unlimited statements where columns are jammed.
 */
export function parseTdCanadaStatement(text: string): KashuStatementParseResult {
  const transactions: KashuStatementParseResult["transactions"] = [];
  let endingBalance: number | null = null;

  // Parse per statement section so year hints stay accurate across a multi-file batch.
  const sections = text.includes("=====")
    ? text.split(/=====.*?=====/).filter((s) => s.trim().length > 80)
    : [text];

  for (const section of sections.length ? sections : [text]) {
    const years = statementYearHints(section);
    const lines = section
      .split(/\r?\n/)
      .map((l) => l.replace(/\s+/g, " ").trim())
      .filter(Boolean);
    let prevMon: number | null = null;

    const closing = section.match(
      /CLOSING\s*BALANCE[A-Z]*\s*[A-Z]{3}\s*\d{1,2}\s*([\d,]+\.\d{2})/i
    );
    if (closing) endingBalance = Number(closing[1]!.replace(/,/g, ""));

    for (const line of lines) {
      if (
        /^(PAGE|PLEASE ENSURE|OUELLETTE|MR |BRANCH|ACCOUNT|STATEMENT|DESCRIPTION|TOTAL|BALANCE FORWARD|STARTING BALANCE|CLOSING BALANCE)/i.test(
          line
        )
      ) {
        const balOnly = line.match(
          /CLOSING\s*BALANCE[A-Z\s]*[A-Z]{3}\d{0,2}\s*([\d,]+\.\d{2})/i
        );
        if (balOnly) endingBalance = Number(balOnly[1]!.replace(/,/g, ""));
        continue;
      }

      const m = line.match(TD_LINE_RE);
      if (!m) continue;

      let desc = m[1]!.trim().replace(/^\d{5,}\s*/, "").trim();
      // Amount sometimes glued to end of description token (MTG3,888.61 → strip trailing digits)
      desc = desc.replace(/\d{1,3}(?:,\d{3})*\.\d{2}$/, "").trim();
      if (desc.length < 3) continue;

      const amount = Number(m[2]!.replace(/,/g, ""));
      if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) continue;

      const mon = m[3]!.toUpperCase();
      const day = Number(m[4]);
      if (day < 1 || day > 31) continue;

      const postedAt = resolvePostedAt(mon, day, years, prevMon);
      prevMon = MONTHS[mon] ?? prevMon;

      if (isNoise(desc)) continue;

      const meta = classifyTd(desc);
      if (meta.isTransfer) continue;
      // Drop retail / one-off noise — concept calendar is income + commitments only
      if (meta.classification === "discretionary" || meta.isOneOff) continue;
      // Tiny "MSP" / payment credits that aren't payroll
      if (meta.classification === "income" && amount < 200) continue;

      const title = friendlyMerchantTitle(desc);
      transactions.push({
        postedAt,
        description: title,
        merchantNorm: normalizeMerchantKey(desc),
        amount,
        direction: meta.direction,
        classification: meta.classification,
        isTransfer: false,
        isOneOff: false,
      });
    }
  }

  // Deduplicate
  const seen = new Set<string>();
  const deduped = transactions.filter((t) => {
    const key = `${t.postedAt}|${t.direction}|${t.amount}|${t.merchantNorm}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const recurring = detectTdRecurring(deduped);

  // Payday guess from latest Cox deposit
  const pays = deduped
    .filter((t) => t.classification === "income" && /COX/i.test(t.merchantNorm))
    .sort((a, b) => a.postedAt.localeCompare(b.postedAt));
  const lastPay = pays[pays.length - 1];

  return {
    endingBalance,
    accountLabel: "TD Unlimited",
    paydayGuess: lastPay?.postedAt ?? null,
    payFrequencyGuess: pays.length >= 1 ? "BIWEEKLY" : null,
    transactions: deduped.slice(0, 500),
    recurring,
    incomeRhythmNotes: pays.length
      ? `Cox Automotive payroll detected (${pays.length} deposits).`
      : null,
    summary: `TD statement scan · ${deduped.length} calendar moves · ${recurring.length} commitments spotted.`,
  };
}

function dominantAmountBand<T extends { amount: number; postedAt: string }>(
  sorted: T[]
): T[] {
  if (sorted.length < 3) return sorted;
  const amounts = sorted.map((t) => t.amount);
  const avg = amounts.reduce((s, n) => s + n, 0) / amounts.length;
  const min = Math.min(...amounts);
  const max = Math.max(...amounts);
  if (max - min <= Math.max(80, avg * 0.45)) return sorted;

  // Aviva-style: main premium + small top-ups — keep the high band when it appears ≥2 times
  if (max >= min * 2.5) {
    const highBand = sorted.filter((t) => t.amount >= max * 0.95);
    if (highBand.length >= 2) return highBand;
    const looseHigh = sorted.filter((t) => t.amount >= max * 0.85);
    if (looseHigh.length >= 2) return looseHigh;
  }

  // Otherwise prefer the most common dollar cluster (tie-break: higher amount)
  const freqMap = new Map<number, number>();
  for (const a of amounts) {
    const r = Math.round(a);
    freqMap.set(r, (freqMap.get(r) ?? 0) + 1);
  }
  const dominant = [...freqMap.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0];
  if (!dominant || dominant[1] < 2) return sorted;
  const band = sorted.filter((t) => Math.abs(t.amount - dominant[0]) < 25);
  return band.length >= 2 ? band : sorted;
}

function detectTdRecurring(
  txs: KashuStatementParseResult["transactions"]
): KashuStatementParseResult["recurring"] {
  const pool = txs.filter(
    (t) =>
      !t.isTransfer &&
      (t.classification === "obligation" ||
        t.classification === "lifestyle" ||
        t.classification === "income")
  );

  const byMerchant = new Map<string, typeof pool>();
  for (const t of pool) {
    const key = t.merchantNorm || t.description.toUpperCase();
    const list = byMerchant.get(key) ?? [];
    list.push(t);
    byMerchant.set(key, list);
  }

  const out: KashuStatementParseResult["recurring"] = [];
  for (const [merchant, list] of byMerchant) {
    const isIncome = list.every((t) => t.direction === "credit");
    // Skip income from recurring obligations — payday lives on the profile
    if (isIncome) continue;
    // Credit-line / loan noise — not concept calendar anchors
    if (
      /NBC|LINE OF CR|RBC ?LOAN|LOAN ?INSURANCE|^INSURANCE$|^RBC PYMT$/i.test(merchant) ||
      /LOANINSURANCE/i.test(compactKey(merchant))
    ) {
      continue;
    }

    if (list.length < 2) continue;

    let sorted = [...list].sort((a, b) => a.postedAt.localeCompare(b.postedAt));
    sorted = dominantAmountBand(sorted);

    const amounts = sorted.map((t) => t.amount);
    const avgFinal = amounts.reduce((s, n) => s + n, 0) / amounts.length;
    const minF = Math.min(...amounts);
    const maxF = Math.max(...amounts);

    let frequency: KashuItemFrequency = "MONTHLY";
    let intervalDays = 30;
    if (sorted.length >= 2) {
      const gaps: number[] = [];
      for (let i = 1; i < sorted.length; i++) {
        const a = new Date(sorted[i - 1]!.postedAt + "T12:00:00Z").getTime();
        const b = new Date(sorted[i]!.postedAt + "T12:00:00Z").getTime();
        gaps.push(Math.round((b - a) / 86400000));
      }
      const avgGap = gaps.reduce((s, n) => s + n, 0) / gaps.length;
      if (avgGap >= 5 && avgGap <= 9) {
        frequency = "WEEKLY";
        intervalDays = 7;
      } else if (avgGap >= 11 && avgGap <= 18) {
        frequency = "BIWEEKLY";
        intervalDays = 14;
      } else if (avgGap >= 25 && avgGap <= 36) {
        frequency = "MONTHLY";
        intervalDays = 30;
      } else if (avgGap >= 55 && avgGap <= 70) {
        // Semi-monthly-ish / every other bill cycle — still treat as monthly for calendar
        frequency = "MONTHLY";
        intervalDays = 30;
      } else if (avgGap >= 80 && avgGap <= 100) {
        frequency = "MONTHLY";
        intervalDays = 90;
      }
    }

    const last = sorted[sorted.length - 1]!;
    // Prefer calendar-day recurrence for monthly bills (mortgage on the 2nd/3rd/4th)
    const next = new Date(last.postedAt + "T12:00:00Z");
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    if (frequency === "MONTHLY" && intervalDays === 30) {
      const dueDay = Math.min(28, Math.max(1, next.getUTCDate()));
      next.setUTCDate(1);
      // Start from the month after last posting if last is already past
      if (next.getTime() <= today.getTime() || last.postedAt <= today.toISOString().slice(0, 10)) {
        // Move to current month same due day, then advance while <= today
        next.setUTCFullYear(today.getUTCFullYear());
        next.setUTCMonth(today.getUTCMonth());
        next.setUTCDate(dueDay);
        while (next.getTime() <= today.getTime()) {
          next.setUTCMonth(next.getUTCMonth() + 1);
          next.setUTCDate(dueDay);
        }
      } else {
        next.setUTCDate(dueDay);
        while (next.getTime() <= today.getTime()) {
          next.setUTCMonth(next.getUTCMonth() + 1);
          next.setUTCDate(dueDay);
        }
      }
    } else {
      while (next.getTime() <= today.getTime()) {
        next.setUTCDate(next.getUTCDate() + intervalDays);
      }
    }

    const priority: KashuPriority =
      last.classification === "lifestyle"
        ? "LIFESTYLE"
        : /MORTGAGE|AVIVA|LINCOLN|ENWIN|ENBRIDGE|BELL|WINDSOR|CANADA LIFE|SANDPIPER/i.test(
              merchant
            )
          ? "MANDATORY"
          : "NECESSARY";

    // Canada Life lump withdrawals vary wildly — only keep if mid-range recurring premium
    if (/CANADA LIFE/i.test(merchant) && (avgFinal < 200 || avgFinal > 2000)) continue;

    const confidence = Math.min(
      0.98,
      0.55 +
        sorted.length * 0.06 +
        (/MORTGAGE|AVIVA|BELL|LINCOLN|ENWIN|ENBRIDGE|SANDPIPER|NETFLIX|PLANET|WINDSOR/i.test(
          merchant
        )
          ? 0.12
          : 0)
    );

    out.push({
      title: last.description.slice(0, 80) || merchant,
      merchantNorm: merchant,
      amount: Math.round(avgFinal * 100) / 100,
      amountMin: minF,
      amountMax: maxF,
      frequency,
      intervalDays,
      nextDueDate: next.toISOString().slice(0, 10),
      priority,
      confidence,
      autoPay: true,
    });
  }

  return out.sort((a, b) => b.confidence - a.confidence || b.amount - a.amount).slice(0, 40);
}

/** High-confidence TD commitments safe to auto-pin on the calendar. */
export function shouldAutoConfirmRecurring(
  title: string,
  amount: number,
  confidence: number
): boolean {
  if (confidence < 0.72 || amount < 15) return false;
  // Skip credit-line noise / one-off insurance lumps that aren't calendar anchors
  if (/nbc|line of cr|rbc ?loan|loan ?insurance|^insurance$|^rbc pymt$/i.test(title)) {
    return false;
  }
  if (/canada life/i.test(title) && (amount < 200 || amount > 2000)) return false;
  return /mortgage|aviva|bell canada|lincoln|enwin|enbridge|sandpiper|netflix|planet fitness|windsor property|canada life|rbc mortgage/i.test(
    title
  );
}
