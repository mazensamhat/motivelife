import type {
  KashuItemFrequency,
  KashuPayFrequency,
  KashuPriority,
  KashuStatementParseResult,
  KashuTxClassification,
} from "@forward/shared";

const MAX_CHARS = 80_000;
const MAX_FILE_BYTES = 8 * 1024 * 1024;

export async function extractStatementText(
  buffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<string> {
  if (buffer.byteLength > MAX_FILE_BYTES) {
    throw new Error("Statement must be 8 MB or smaller.");
  }

  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";

  if (
    mimeType.startsWith("text/") ||
    ext === "txt" ||
    ext === "csv" ||
    ext === "md" ||
    mimeType === "text/csv" ||
    mimeType === "application/csv"
  ) {
    return buffer.toString("utf-8").slice(0, MAX_CHARS);
  }

  if (ext === "pdf" || mimeType === "application/pdf") {
    const pdfParse = (await import("pdf-parse")).default;
    const parsed = await pdfParse(buffer);
    return String(parsed.text ?? "").slice(0, MAX_CHARS);
  }

  throw new Error("Unsupported file type. Upload PDF, CSV, or TXT.");
}

function normalizeMerchant(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/\s+/g, " ")
    .replace(/[^A-Z0-9 #&'.-]/g, "")
    .replace(/\b(PAD|PREAUTHORIZED|PAYMENT|BILL PAYMENT|PURCHASE|POS)\b/g, "")
    .trim()
    .slice(0, 80);
}

/** Heuristic CSV / line parser when OpenAI is unavailable. */
export function parseStatementRules(text: string): KashuStatementParseResult {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const transactions: KashuStatementParseResult["transactions"] = [];
  let endingBalance: number | null = null;

  const dateRe = /(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/;
  const amountRe = /-?\$?\d{1,3}(?:,\d{3})*(?:\.\d{2})?|-?\d+\.\d{2}/;

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower.includes("closing balance") || lower.includes("ending balance") || lower.includes("current balance")) {
      const m = line.match(amountRe);
      if (m) endingBalance = Math.abs(parseAmount(m[0]!));
    }

    const dm = line.match(dateRe);
    const amounts = line.match(new RegExp(amountRe.source, "g"));
    if (!dm || !amounts?.length) continue;

    const amountRaw = amounts[amounts.length - 1]!;
    const amount = Math.abs(parseAmount(amountRaw));
    if (!amount || amount > 1_000_000) continue;

    const desc = line
      .replace(dm[0]!, "")
      .replace(amountRaw, "")
      .replace(/,/g, " ")
      .trim()
      .slice(0, 120);
    if (desc.length < 2) continue;

    const isCredit =
      lower.includes("deposit") ||
      lower.includes("payroll") ||
      lower.includes("salary") ||
      lower.includes("e-transfer received") ||
      amountRaw.startsWith("+");
    const isDebit = !isCredit;

    transactions.push({
      postedAt: toIsoDate(dm[0]!),
      description: desc || "Transaction",
      merchantNorm: normalizeMerchant(desc),
      amount,
      direction: isDebit ? "debit" : "credit",
      classification: classifyHeuristic(desc, isCredit),
      isTransfer: /transfer|xfer|own account/i.test(desc),
    });
  }

  const recurring = detectRecurringFromTransactions(transactions);

  return {
    endingBalance,
    transactions: transactions.slice(0, 400),
    recurring,
    summary: `Parsed ${transactions.length} transactions with rule-based extraction.`,
  };
}

function parseAmount(s: string): number {
  return Number(s.replace(/[$,\s]/g, ""));
}

function toIsoDate(raw: string): string {
  const cleaned = raw.replace(/\//g, "-");
  const parts = cleaned.split("-").map((p) => Number(p));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
    return new Date().toISOString().slice(0, 10);
  }
  let y: number, m: number, d: number;
  if (parts[0]! > 31) {
    [y, m, d] = parts as [number, number, number];
  } else if (parts[2]! > 31) {
    [m, d, y] = parts as [number, number, number];
    if (y < 100) y += 2000;
  } else {
    [d, m, y] = parts as [number, number, number];
    if (y < 100) y += 2000;
  }
  const dt = new Date(y, m - 1, d);
  if (Number.isNaN(dt.getTime())) return new Date().toISOString().slice(0, 10);
  return dt.toISOString().slice(0, 10);
}

function classifyHeuristic(desc: string, isCredit: boolean): KashuTxClassification {
  const d = desc.toLowerCase();
  if (isCredit) {
    if (/payroll|salary|direct deposit|wage/.test(d)) return "income";
    if (/refund/.test(d)) return "refund";
    if (/reimburse/.test(d)) return "reimbursement";
    if (/transfer|xfer/.test(d)) return "transfer";
    return "other";
  }
  if (/mortgage|rent|insurance|hydro|electric|property tax|loan|lincoln|auto/.test(d)) {
    return "obligation";
  }
  if (/grocery|fuel|gas|pharmacy|transit/.test(d)) return "necessary";
  if (/coffee|restaurant|tim hortons|starbucks|netflix|spotify|shopping/.test(d)) {
    return "lifestyle";
  }
  if (/transfer|xfer|savings/.test(d)) return "transfer";
  return "other";
}

export function detectRecurringFromTransactions(
  txs: KashuStatementParseResult["transactions"]
): KashuStatementParseResult["recurring"] {
  const debits = txs.filter((t) => t.direction === "debit" && !t.isTransfer);
  const byMerchant = new Map<string, typeof debits>();
  for (const t of debits) {
    const key = t.merchantNorm || normalizeMerchant(t.description);
    if (!key) continue;
    const list = byMerchant.get(key) ?? [];
    list.push(t);
    byMerchant.set(key, list);
  }

  const out: KashuStatementParseResult["recurring"] = [];
  for (const [merchant, list] of byMerchant) {
    if (list.length < 2) continue;
    const sorted = [...list].sort((a, b) => a.postedAt.localeCompare(b.postedAt));
    const amounts = sorted.map((t) => t.amount);
    const avg = amounts.reduce((s, n) => s + n, 0) / amounts.length;
    const min = Math.min(...amounts);
    const max = Math.max(...amounts);
    if (max - min > Math.max(25, avg * 0.35)) continue;

    const gaps: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const a = new Date(sorted[i - 1]!.postedAt).getTime();
      const b = new Date(sorted[i]!.postedAt).getTime();
      gaps.push(Math.round((b - a) / 86400000));
    }
    const avgGap = gaps.reduce((s, n) => s + n, 0) / gaps.length;
    let frequency: KashuItemFrequency = "MONTHLY";
    let intervalDays = 30;
    if (avgGap >= 5 && avgGap <= 9) {
      frequency = "WEEKLY";
      intervalDays = 7;
    } else if (avgGap >= 12 && avgGap <= 17) {
      frequency = "BIWEEKLY";
      intervalDays = 14;
    } else if (avgGap >= 27 && avgGap <= 35) {
      frequency = "MONTHLY";
      intervalDays = 30;
    } else if (avgGap >= 350) {
      frequency = "ANNUAL";
      intervalDays = 365;
    } else {
      continue;
    }

    const last = sorted[sorted.length - 1]!;
    const next = new Date(last.postedAt);
    next.setDate(next.getDate() + intervalDays);
    const priority: KashuPriority =
      last.classification === "obligation"
        ? "MANDATORY"
        : last.classification === "necessary"
          ? "NECESSARY"
          : last.classification === "lifestyle"
            ? "LIFESTYLE"
            : "DISCRETIONARY";

    const confidence = Math.min(0.98, 0.55 + list.length * 0.12);

    out.push({
      title: last.description.slice(0, 80) || merchant,
      merchantNorm: merchant,
      amount: Math.round(avg * 100) / 100,
      amountMin: min,
      amountMax: max,
      frequency,
      intervalDays,
      nextDueDate: next.toISOString().slice(0, 10),
      priority,
      confidence,
      autoPay: true,
    });
  }

  return out.sort((a, b) => b.confidence - a.confidence).slice(0, 40);
}

export async function parseStatementWithAi(
  text: string,
  apiKey?: string | null
): Promise<KashuStatementParseResult> {
  const rules = parseStatementRules(text);
  if (!apiKey) return rules;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        temperature: 0.1,
        messages: [
          {
            role: "system",
            content: `You are Kashu, MyMotiveLife cash-flow intelligence. Parse bank/credit statements into structured JSON.
Rules:
- Never treat transfers between own accounts as income.
- Never treat emergency-fund injections as recurring payroll.
- Classify each transaction.
- Detect recurring obligations with frequency WEEKLY|BIWEEKLY|SEMI_MONTHLY|MONTHLY|ANNUAL.
- Guess payFrequency WEEKLY|BIWEEKLY|SEMI_MONTHLY|MONTHLY|IRREGULAR when possible.
- endingBalance is the latest known operating balance if present.
Output JSON only matching the schema.`,
          },
          {
            role: "user",
            content: `Statement text:\n"""${text.slice(0, 60_000)}"""\n\nSchema:
{
  "endingBalance": number|null,
  "accountLabel": string|null,
  "paydayGuess": "YYYY-MM-DD"|null,
  "payFrequencyGuess": "WEEKLY"|"BIWEEKLY"|"SEMI_MONTHLY"|"MONTHLY"|"IRREGULAR"|null,
  "transactions": [{
    "postedAt": "YYYY-MM-DD",
    "description": string,
    "merchantNorm": string,
    "amount": number,
    "direction": "debit"|"credit",
    "balanceAfter": number|null,
    "classification": "income"|"obligation"|"necessary"|"lifestyle"|"discretionary"|"transfer"|"refund"|"reimbursement"|"emergency"|"other",
    "isTransfer": boolean,
    "isOneOff": boolean
  }],
  "recurring": [{
    "title": string,
    "merchantNorm": string,
    "amount": number,
    "amountMin": number,
    "amountMax": number,
    "frequency": "WEEKLY"|"BIWEEKLY"|"SEMI_MONTHLY"|"MONTHLY"|"ANNUAL",
    "intervalDays": number,
    "nextDueDate": "YYYY-MM-DD"|null,
    "priority": "MANDATORY"|"NECESSARY"|"DISCRETIONARY"|"LIFESTYLE",
    "confidence": number,
    "autoPay": boolean
  }],
  "incomeRhythmNotes": string|null,
  "summary": string
}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      console.warn("[kashu-parse] openai", response.status);
      return rules;
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return rules;
    const parsed = JSON.parse(content) as KashuStatementParseResult;
    if (!Array.isArray(parsed.transactions)) return rules;

    // Prefer AI recurring if present; else fall back to detection
    if (!parsed.recurring?.length) {
      parsed.recurring = detectRecurringFromTransactions(parsed.transactions);
    }
    if (parsed.endingBalance == null && rules.endingBalance != null) {
      parsed.endingBalance = rules.endingBalance;
    }
    return parsed;
  } catch (error) {
    console.warn("[kashu-parse] fallback to rules", error);
    return rules;
  }
}

export function payFrequencyFromGuess(
  raw: string | null | undefined
): KashuPayFrequency | null {
  if (!raw) return null;
  const v = raw.toUpperCase();
  if (
    v === "WEEKLY" ||
    v === "BIWEEKLY" ||
    v === "SEMI_MONTHLY" ||
    v === "MONTHLY" ||
    v === "IRREGULAR"
  ) {
    return v;
  }
  return null;
}
