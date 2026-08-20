import type {
  KashuItemFrequency,
  KashuPayFrequency,
  KashuPriority,
  KashuStatementParseResult,
  KashuTxClassification,
} from "@forward/shared";
import { OPENAI_MODEL } from "@/lib/openai-config";
import {
  looksLikeTdCanadaStatement,
  parseTdCanadaStatement,
  shouldAutoConfirmRecurring,
} from "@/lib/kashu/td-statement";

export { shouldAutoConfirmRecurring };

const MAX_CHARS = 80_000;
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_FILES = 12;
const MAX_IMAGES = 8;
const MAX_TOTAL_BYTES = 32 * 1024 * 1024;

export type StatementFileKind = "pdf" | "csv" | "text" | "image" | "paste";

export type StatementSourceInput = {
  fileName: string;
  mimeType: string;
  kind: StatementFileKind;
  text?: string;
  /** Raw base64 (no data: prefix) for images */
  base64?: string;
};

export function getMaxStatementFiles() {
  return MAX_FILES;
}

export function classifyStatementFile(
  fileName: string,
  mimeType: string
): StatementFileKind | "unsupported" {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  const mime = (mimeType || "").toLowerCase();

  if (
    mime.startsWith("image/") ||
    ["png", "jpg", "jpeg", "webp", "gif", "heic", "heif"].includes(ext)
  ) {
    return "image";
  }
  if (ext === "pdf" || mime === "application/pdf") return "pdf";
  if (ext === "csv" || mime === "text/csv" || mime === "application/csv") return "csv";
  if (mime.startsWith("text/") || ext === "txt" || ext === "md" || ext === "tsv") {
    return "text";
  }
  return "unsupported";
}

export async function extractStatementText(
  buffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<string> {
  if (buffer.byteLength > MAX_FILE_BYTES) {
    throw new Error(`"${fileName}" must be 8 MB or smaller.`);
  }

  const kind = classifyStatementFile(fileName, mimeType);
  if (kind === "image") {
    throw new Error("Images are read by Kashu vision — use the multi-source scanner.");
  }
  if (kind === "unsupported") {
    throw new Error(
      `Unsupported file "${fileName}". Upload PDF, CSV, TXT, or screenshots (PNG/JPG/WEBP).`
    );
  }

  if (kind === "csv" || kind === "text") {
    return buffer.toString("utf-8").slice(0, MAX_CHARS);
  }

  const pdfParse = (await import("pdf-parse")).default;
  const parsed = await pdfParse(buffer);
  return String(parsed.text ?? "").slice(0, MAX_CHARS);
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

function txKey(t: KashuStatementParseResult["transactions"][number]): string {
  return [
    t.postedAt?.slice(0, 10) ?? "",
    t.direction,
    Number(t.amount).toFixed(2),
    (t.merchantNorm || normalizeMerchant(t.description)).slice(0, 40),
  ].join("|");
}

export function dedupeTransactions(
  txs: KashuStatementParseResult["transactions"]
): KashuStatementParseResult["transactions"] {
  const seen = new Set<string>();
  const out: typeof txs = [];
  for (const t of txs) {
    const key = txKey(t);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

export function dedupeRecurring(
  items: KashuStatementParseResult["recurring"]
): KashuStatementParseResult["recurring"] {
  const byMerchant = new Map<string, (typeof items)[number]>();
  for (const r of items) {
    const key = (r.merchantNorm || normalizeMerchant(r.title)).toUpperCase();
    const prev = byMerchant.get(key);
    if (!prev || (r.confidence ?? 0) > (prev.confidence ?? 0)) {
      byMerchant.set(key, r);
    }
  }
  return [...byMerchant.values()].sort((a, b) => b.confidence - a.confidence);
}

/** Heuristic CSV / line parser when OpenAI is unavailable. */
export function parseStatementRules(text: string): KashuStatementParseResult {
  if (looksLikeTdCanadaStatement(text)) {
    return parseTdCanadaStatement(text);
  }

  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const transactions: KashuStatementParseResult["transactions"] = [];
  let endingBalance: number | null = null;

  const dateRe = /(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/;
  const amountRe = /-?\$?\d{1,3}(?:,\d{3})*(?:\.\d{2})?|-?\d+\.\d{2}/;

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (
      lower.includes("closing balance") ||
      lower.includes("ending balance") ||
      lower.includes("current balance")
    ) {
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

    transactions.push({
      postedAt: toIsoDate(dm[0]!),
      description: desc || "Transaction",
      merchantNorm: normalizeMerchant(desc),
      amount,
      direction: isCredit ? "credit" : "debit",
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

const SYSTEM_PROMPT = `You are Kashu cash-flow parser. Merge all attached bank docs/screenshots into ONE JSON model.
Dedupe same date+amount+merchant. Transfers ≠ income. Detect recurrings. Guess payday/frequency when clear.
Read screenshot rows carefully. JSON only.`;

const PARSE_SCHEMA_COMPACT = `{"endingBalance":number|null,"accountLabel":string|null,"paydayGuess":"YYYY-MM-DD"|null,"payFrequencyGuess":"WEEKLY"|"BIWEEKLY"|"SEMI_MONTHLY"|"MONTHLY"|"IRREGULAR"|null,"transactions":[{"postedAt":"YYYY-MM-DD","description":string,"merchantNorm":string,"amount":number,"direction":"debit"|"credit","balanceAfter":number|null,"classification":"income"|"obligation"|"necessary"|"lifestyle"|"discretionary"|"transfer"|"refund"|"reimbursement"|"emergency"|"other","isTransfer":boolean,"isOneOff":boolean}],"recurring":[{"title":string,"merchantNorm":string,"amount":number,"amountMin":number,"amountMax":number,"frequency":"WEEKLY"|"BIWEEKLY"|"SEMI_MONTHLY"|"MONTHLY"|"ANNUAL","intervalDays":number,"nextDueDate":"YYYY-MM-DD"|null,"priority":"MANDATORY"|"NECESSARY"|"DISCRETIONARY"|"LIFESTYLE","confidence":number,"autoPay":boolean}],"incomeRhythmNotes":string|null,"summary":string}`;

function normalizeAiResult(
  parsed: KashuStatementParseResult,
  rulesFallback: KashuStatementParseResult | null
): KashuStatementParseResult {
  if (!Array.isArray(parsed.transactions)) {
    return (
      rulesFallback ?? { transactions: [], recurring: [], summary: "No transactions found." }
    );
  }
  parsed.transactions = dedupeTransactions(parsed.transactions).slice(0, 500);
  if (!parsed.recurring?.length) {
    parsed.recurring = detectRecurringFromTransactions(parsed.transactions);
  } else {
    parsed.recurring = dedupeRecurring(parsed.recurring).slice(0, 40);
  }
  if (parsed.endingBalance == null && rulesFallback?.endingBalance != null) {
    parsed.endingBalance = rulesFallback.endingBalance;
  }
  return parsed;
}

export async function parseStatementWithAi(
  text: string,
  apiKey?: string | null
): Promise<KashuStatementParseResult> {
  return parseStatementSourcesWithAi(
    [{ fileName: "statement.txt", mimeType: "text/plain", kind: "text", text }],
    apiKey
  );
}

/**
 * Consolidate multiple statement sources (PDF/CSV/TXT/paste + screenshots) into one model.
 */
export async function parseStatementSourcesWithAi(
  sources: StatementSourceInput[],
  apiKey?: string | null
): Promise<KashuStatementParseResult> {
  if (!sources.length) {
    throw new Error("Add at least one statement, CSV, or screenshot.");
  }

  const textSources = sources.filter((s) => s.text?.trim());
  const imageSources = sources.filter((s) => s.kind === "image" && s.base64);
  const combinedText = textSources
    .map((s) => `===== SOURCE: ${s.fileName} (${s.kind}) =====\n${s.text!.trim()}`)
    .join("\n\n")
    .slice(0, MAX_CHARS);

  const rules = combinedText ? parseStatementRules(combinedText) : null;

  // Fast path: TD / text with solid rules extract — skip the OpenAI round-trip.
  const FAST_TX_MIN = 8;
  const isTd = textSources.some((s) => looksLikeTdCanadaStatement(s.text || ""));
  if (
    (!imageSources.length && rules && rules.transactions.length >= FAST_TX_MIN) ||
    (isTd && rules && rules.transactions.length >= 5)
  ) {
    if (!rules.recurring?.length) {
      rules.recurring = detectRecurringFromTransactions(rules.transactions);
    }
    return {
      ...rules,
      transactions: dedupeTransactions(rules.transactions).slice(0, 500),
      recurring: dedupeRecurring(rules.recurring ?? []).slice(0, 40),
      summary: `Fast scan · ${rules.transactions.length} txs from ${sources.length} file${sources.length === 1 ? "" : "s"} (rules).`,
    };
  }

  if (!apiKey) {
    if (imageSources.length && !combinedText) {
      throw new Error(
        "Screenshots need Kashu AI enabled (OPENAI_API_KEY). Upload a PDF/CSV, or enable AI to read images."
      );
    }
    if (!rules) {
      throw new Error("Could not read any text from those files.");
    }
    return {
      ...rules,
      summary: `${rules.summary ?? "Parsed."} Consolidated ${sources.length} source(s) with rules (AI off).`,
    };
  }

  type ContentPart =
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string; detail: "high" | "low" | "auto" } };

  const textBudget = imageSources.length ? 18_000 : 28_000;
  const content: ContentPart[] = [
    {
      type: "text",
      text: `Consolidate ${sources.length} source(s) [${sources
        .map((s) => `${s.fileName}/${s.kind}`)
        .join(", ")}] into one cash-flow JSON.\nSchema: ${PARSE_SCHEMA_COMPACT}`,
    },
  ];

  if (combinedText) {
    content.push({
      type: "text",
      text: `Text extracts:\n"""${combinedText.slice(0, textBudget)}"""`,
    });
  }

  // Cap images + use low detail for speed (still readable for bank UIs).
  for (const img of imageSources.slice(0, Math.min(MAX_IMAGES, 6))) {
    const mime =
      img.mimeType && img.mimeType.startsWith("image/") ? img.mimeType : "image/jpeg";
    content.push({
      type: "text",
      text: `Image: ${img.fileName}`,
    });
    content.push({
      type: "image_url",
      image_url: {
        url: `data:${mime};base64,${img.base64}`,
        detail: "low",
      },
    });
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        response_format: { type: "json_object" },
        temperature: 0,
        max_tokens: 3500,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content },
        ],
      }),
    });

    if (!response.ok) {
      console.warn(
        "[kashu-parse] openai",
        response.status,
        await response.text().catch(() => "")
      );
      if (rules) return rules;
      throw new Error(
        "Kashu AI could not read those files. Try clearer screenshots or a PDF/CSV export."
      );
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) {
      if (rules) return rules;
      throw new Error("Kashu AI returned an empty parse.");
    }
    const parsed = JSON.parse(raw) as KashuStatementParseResult;
    const normalized = normalizeAiResult(parsed, rules);
    const sourceNote = ` Consolidated ${sources.length} file${sources.length === 1 ? "" : "s"} (${imageSources.length} image${imageSources.length === 1 ? "" : "s"}).`;
    normalized.summary = `${normalized.summary?.trim() || "Scan complete."}${sourceNote}`;
    return normalized;
  } catch (error) {
    console.warn("[kashu-parse] fallback", error);
    if (rules) return rules;
    throw error instanceof Error
      ? error
      : new Error("Could not consolidate those statements.");
  }
}

export function assertStatementBatchLimits(files: Array<{ size: number; name: string }>) {
  if (files.length > MAX_FILES) {
    throw new Error(`Upload up to ${MAX_FILES} files at once.`);
  }
  const total = files.reduce((s, f) => s + f.size, 0);
  if (total > MAX_TOTAL_BYTES) {
    throw new Error("Combined upload is too large (max ~32 MB).");
  }
  for (const f of files) {
    if (f.size > MAX_FILE_BYTES) {
      throw new Error(`"${f.name}" must be 8 MB or smaller.`);
    }
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
