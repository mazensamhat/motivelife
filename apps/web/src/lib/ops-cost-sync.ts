import {
  OpsCostBrand,
  OpsCostCategory,
  OpsCostSource,
  prisma,
} from "@forward/database";
import { getStripe } from "@/lib/stripe";

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthStartUtc(yyyyMm: string): Date {
  const [y, m] = yyyyMm.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1));
}

function previousMonthKey(d = new Date()): string {
  const prev = new Date(Date.UTC(d.getFullYear(), d.getMonth() - 1, 1));
  return monthKey(prev);
}

/** Rough USD→CAD for ops estimates (ledger stores CAD). */
const USD_TO_CAD = 1.36;

export type SyncLine = {
  monthKey: string;
  amountCad: number;
  upserted: boolean;
  skipped?: string;
};

export type OpsCostSyncResult = {
  openai: SyncLine[];
  stripeFees: SyncLine[];
  resend: SyncLine[];
  metaAds: SyncLine[];
  twilio: SyncLine[];
};

async function upsertAutoEntry(params: {
  source: OpsCostSource;
  externalId: string;
  brand: OpsCostBrand;
  category: OpsCostCategory;
  amountCad: number;
  occurredOn: Date;
  vendor: string;
  description: string;
}) {
  const amount = Math.round(params.amountCad * 100) / 100;
  await prisma.opsCostEntry.upsert({
    where: {
      source_externalId: {
        source: params.source,
        externalId: params.externalId,
      },
    },
    create: {
      brand: params.brand,
      category: params.category,
      source: params.source,
      amountCad: amount,
      currency: "CAD",
      occurredOn: params.occurredOn,
      vendor: params.vendor,
      description: params.description,
      externalId: params.externalId,
    },
    update: {
      amountCad: amount,
      occurredOn: params.occurredOn,
      description: params.description,
      vendor: params.vendor,
      brand: params.brand,
      category: params.category,
    },
  });
}

async function fetchOpenAiOrgCostUsd(yyyyMm: string): Promise<number | null> {
  const adminKey = process.env.OPENAI_ADMIN_KEY?.trim();
  if (!adminKey) return null;

  const start = monthStartUtc(yyyyMm);
  const [y, m] = yyyyMm.split("-").map(Number);
  const end = new Date(Date.UTC(y, m, 1));
  const startTime = Math.floor(start.getTime() / 1000);
  const endTime = Math.floor(end.getTime() / 1000);

  let total = 0;
  let page: string | undefined;
  for (let i = 0; i < 20; i++) {
    const qs = new URLSearchParams({
      start_time: String(startTime),
      end_time: String(endTime),
      bucket_width: "1d",
      limit: "31",
    });
    if (page) qs.set("page", page);
    const res = await fetch(`https://api.openai.com/v1/organization/costs?${qs}`, {
      headers: {
        Authorization: `Bearer ${adminKey}`,
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`OpenAI costs API ${res.status}: ${text.slice(0, 160)}`);
    }
    const json = (await res.json()) as {
      data?: Array<{ results?: Array<{ amount?: { value?: number } }> }>;
      next_page?: string | null;
    };
    for (const bucket of json.data ?? []) {
      for (const row of bucket.results ?? []) {
        total += Number(row.amount?.value ?? 0);
      }
    }
    if (!json.next_page) break;
    page = json.next_page;
  }
  return total;
}

/** Prefer Organization Costs API (OPENAI_ADMIN_KEY); else AiUsageMonthly estimate. */
export async function syncOpenAiCosts(months: string[]): Promise<SyncLine[]> {
  const out: SyncLine[] = [];
  for (const key of months) {
    try {
      const orgUsd = await fetchOpenAiOrgCostUsd(key);
      if (orgUsd != null) {
        const amountCad = orgUsd * USD_TO_CAD;
        await upsertAutoEntry({
          source: OpsCostSource.auto_openai_org,
          externalId: `openai_org:${key}`,
          brand: OpsCostBrand.motivelife,
          category: OpsCostCategory.openai,
          amountCad,
          occurredOn: monthStartUtc(key),
          vendor: "OpenAI",
          description: `OpenAI org costs for ${key} (Organization Costs API)`,
        });
        // Avoid double-count with the older AiUsageMonthly row.
        await prisma.opsCostEntry
          .deleteMany({
            where: { source: OpsCostSource.auto_openai, externalId: `openai:${key}` },
          })
          .catch(() => undefined);
        out.push({ monthKey: key, amountCad: Math.round(amountCad * 100) / 100, upserted: true });
        continue;
      }

      const rows = await prisma.aiUsageMonthly.findMany({
        where: { monthKey: key },
        select: { estimatedMicroUsd: true },
      });
      const microUsd = rows.reduce((s, r) => s + (r.estimatedMicroUsd ?? 0), 0);
      const amountCad = (microUsd / 1_000_000) * USD_TO_CAD;
      await upsertAutoEntry({
        source: OpsCostSource.auto_openai,
        externalId: `openai:${key}`,
        brand: OpsCostBrand.motivelife,
        category: OpsCostCategory.openai,
        amountCad,
        occurredOn: monthStartUtc(key),
        vendor: "OpenAI",
        description: `Estimated OpenAI usage for ${key} (from AiUsageMonthly — set OPENAI_ADMIN_KEY for full org $)`,
      });
      out.push({ monthKey: key, amountCad: Math.round(amountCad * 100) / 100, upserted: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "OpenAI sync failed";
      out.push({ monthKey: key, amountCad: 0, upserted: false, skipped: message });
    }
  }
  return out;
}

export async function syncStripeFees(months: string[]): Promise<SyncLine[]> {
  const out: SyncLine[] = [];
  const stripe = getStripe();
  if (!stripe) {
    return months.map((monthKey) => ({
      monthKey,
      amountCad: 0,
      upserted: false,
      skipped: "Stripe not configured",
    }));
  }

  for (const key of months) {
    const start = monthStartUtc(key);
    const [y, m] = key.split("-").map(Number);
    const end = new Date(Date.UTC(y, m, 1));
    const gte = Math.floor(start.getTime() / 1000);
    const lt = Math.floor(end.getTime() / 1000);

    try {
      let feeCents = 0;
      let startingAfter: string | undefined;
      for (let page = 0; page < 20; page++) {
        const batch = await stripe.balanceTransactions.list({
          created: { gte, lt },
          limit: 100,
          starting_after: startingAfter,
        });
        for (const tx of batch.data) {
          feeCents += tx.fee ?? 0;
        }
        if (!batch.has_more || batch.data.length === 0) break;
        startingAfter = batch.data[batch.data.length - 1]?.id;
      }

      const feeMajor = feeCents / 100;
      const amountCad = feeMajor * USD_TO_CAD;
      await upsertAutoEntry({
        source: OpsCostSource.auto_stripe,
        externalId: `stripe_fees:${key}`,
        brand: OpsCostBrand.motivelife,
        category: OpsCostCategory.stripe_fees,
        amountCad,
        occurredOn: start,
        vendor: "Stripe",
        description: `Stripe processing fees for ${key}`,
      });
      out.push({ monthKey: key, amountCad: Math.round(amountCad * 100) / 100, upserted: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Stripe fees sync failed";
      out.push({ monthKey: key, amountCad: 0, upserted: false, skipped: message });
    }
  }
  return out;
}

async function countResendEmailsInMonth(yyyyMm: string): Promise<number> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) throw new Error("RESEND_API_KEY not set");

  const start = monthStartUtc(yyyyMm);
  const [y, m] = yyyyMm.split("-").map(Number);
  const end = new Date(Date.UTC(y, m, 1));
  let count = 0;
  let after: string | undefined;

  for (let page = 0; page < 50; page++) {
    const qs = new URLSearchParams({ limit: "100" });
    if (after) qs.set("after", after);
    const res = await fetch(`https://api.resend.com/emails?${qs}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Resend list ${res.status}: ${text.slice(0, 120)}`);
    }
    const json = (await res.json()) as {
      data?: Array<{ id: string; created_at?: string }>;
      has_more?: boolean;
    };
    const rows = json.data ?? [];
    if (rows.length === 0) break;

    let reachedOlder = false;
    for (const row of rows) {
      const created = row.created_at ? new Date(row.created_at) : null;
      if (!created || Number.isNaN(created.getTime())) continue;
      if (created >= end) continue;
      if (created < start) {
        reachedOlder = true;
        continue;
      }
      count += 1;
    }
    if (reachedOlder || !json.has_more) break;
    after = rows[rows.length - 1]?.id;
    if (!after) break;
  }
  return count;
}

/**
 * Resend has no billing $ API. Estimate:
 * RESEND_MONTHLY_PLAN_USD + max(0, emails - RESEND_INCLUDED_EMAILS) * RESEND_OVERAGE_USD_PER_EMAIL
 * Defaults: plan 0, included 3000, overage 0.001 → free-tier friendly.
 */
export async function syncResendCosts(months: string[]): Promise<SyncLine[]> {
  if (!process.env.RESEND_API_KEY?.trim()) {
    return months.map((monthKey) => ({
      monthKey,
      amountCad: 0,
      upserted: false,
      skipped: "RESEND_API_KEY not set",
    }));
  }

  const planUsd = Number(process.env.RESEND_MONTHLY_PLAN_USD ?? "0");
  const included = Number(process.env.RESEND_INCLUDED_EMAILS ?? "3000");
  const overage = Number(process.env.RESEND_OVERAGE_USD_PER_EMAIL ?? "0.001");
  const out: SyncLine[] = [];

  for (const key of months) {
    try {
      const emails = await countResendEmailsInMonth(key);
      const overageUsd = Math.max(0, emails - (Number.isFinite(included) ? included : 3000)) *
        (Number.isFinite(overage) ? overage : 0.001);
      const usd = (Number.isFinite(planUsd) ? planUsd : 0) + overageUsd;
      const amountCad = usd * USD_TO_CAD;
      await upsertAutoEntry({
        source: OpsCostSource.auto_resend,
        externalId: `resend:${key}`,
        brand: OpsCostBrand.motivelife,
        category: OpsCostCategory.resend,
        amountCad,
        occurredOn: monthStartUtc(key),
        vendor: "Resend",
        description: `Resend estimate for ${key}: ${emails} emails (plan $${planUsd || 0} + overage). Set RESEND_MONTHLY_PLAN_USD for accuracy.`,
      });
      out.push({ monthKey: key, amountCad: Math.round(amountCad * 100) / 100, upserted: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Resend sync failed";
      out.push({ monthKey: key, amountCad: 0, upserted: false, skipped: message });
    }
  }
  return out;
}

/** Meta Ads Insights spend — needs MARKETING_META_ACCESS_TOKEN + MARKETING_META_AD_ACCOUNT_ID. */
export async function syncMetaAdsCosts(months: string[]): Promise<SyncLine[]> {
  const token = process.env.MARKETING_META_ACCESS_TOKEN?.trim();
  const adAccount = process.env.MARKETING_META_AD_ACCOUNT_ID?.trim()?.replace(/^act_/, "");
  if (!token || !adAccount) {
    return months.map((monthKey) => ({
      monthKey,
      amountCad: 0,
      upserted: false,
      skipped: !token
        ? "MARKETING_META_ACCESS_TOKEN not set"
        : "MARKETING_META_AD_ACCOUNT_ID not set (e.g. 123456789)",
    }));
  }

  const out: SyncLine[] = [];
  for (const key of months) {
    const start = monthStartUtc(key);
    const [y, m] = key.split("-").map(Number);
    const end = new Date(Date.UTC(y, m, 1));
    const until = new Date(end.getTime() - 86400000);
    const since = start.toISOString().slice(0, 10);
    const untilStr = until.toISOString().slice(0, 10);

    try {
      const qs = new URLSearchParams({
        fields: "spend",
        time_range: JSON.stringify({ since, until: untilStr }),
        level: "account",
        access_token: token,
      });
      const res = await fetch(
        `https://graph.facebook.com/v21.0/act_${adAccount}/insights?${qs}`,
      );
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Meta insights ${res.status}: ${text.slice(0, 160)}`);
      }
      const json = (await res.json()) as { data?: Array<{ spend?: string }> };
      const spendUsd = Number(json.data?.[0]?.spend ?? 0);
      const amountCad = (Number.isFinite(spendUsd) ? spendUsd : 0) * USD_TO_CAD;
      await upsertAutoEntry({
        source: OpsCostSource.auto_meta_ads,
        externalId: `meta_ads:${key}`,
        brand: OpsCostBrand.motivelife,
        category: OpsCostCategory.marketing_ads,
        amountCad,
        occurredOn: start,
        vendor: "Meta Ads",
        description: `Meta ad account spend for ${key} (Insights API). Re-tag brand manually if needed.`,
      });
      out.push({ monthKey: key, amountCad: Math.round(amountCad * 100) / 100, upserted: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Meta ads sync failed";
      out.push({ monthKey: key, amountCad: 0, upserted: false, skipped: message });
    }
  }
  return out;
}

/** Twilio Usage Records (monthly) — needs TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN. */
export async function syncTwilioCosts(months: string[]): Promise<SyncLine[]> {
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const auth = process.env.TWILIO_AUTH_TOKEN?.trim();
  if (!sid || !auth) {
    return months.map((monthKey) => ({
      monthKey,
      amountCad: 0,
      upserted: false,
      skipped: "TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN not set",
    }));
  }

  const basic = Buffer.from(`${sid}:${auth}`).toString("base64");
  const out: SyncLine[] = [];

  for (const key of months) {
    const start = monthStartUtc(key);
    const [y, m] = key.split("-").map(Number);
    const endDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const startDate = `${key}-01`;
    const endDate = `${key}-${String(endDay).padStart(2, "0")}`;

    try {
      const qs = new URLSearchParams({
        Category: "totalprice",
        StartDate: startDate,
        EndDate: endDate,
      });
      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${sid}/Usage/Records.json?${qs}`,
        { headers: { Authorization: `Basic ${basic}` } },
      );
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Twilio usage ${res.status}: ${text.slice(0, 160)}`);
      }
      const json = (await res.json()) as {
        usage_records?: Array<{ price?: string; price_unit?: string }>;
      };
      const price = Number(json.usage_records?.[0]?.price ?? 0);
      const amountCad = (Number.isFinite(price) ? Math.abs(price) : 0) * USD_TO_CAD;
      await upsertAutoEntry({
        source: OpsCostSource.auto_twilio,
        externalId: `twilio:${key}`,
        brand: OpsCostBrand.motivelife,
        category: OpsCostCategory.twilio,
        amountCad,
        occurredOn: start,
        vendor: "Twilio",
        description: `Twilio totalprice usage for ${key}`,
      });
      out.push({ monthKey: key, amountCad: Math.round(amountCad * 100) / 100, upserted: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Twilio sync failed";
      out.push({ monthKey: key, amountCad: 0, upserted: false, skipped: message });
    }
  }
  return out;
}

/** Sync current + previous calendar month auto costs. */
export async function syncOpsAutoCosts(now = new Date()): Promise<OpsCostSyncResult> {
  const months = [monthKey(now), previousMonthKey(now)];
  const unique = [...new Set(months)];
  const [openai, stripeFees, resend, metaAds, twilio] = await Promise.all([
    syncOpenAiCosts(unique),
    syncStripeFees(unique),
    syncResendCosts(unique),
    syncMetaAdsCosts(unique),
    syncTwilioCosts(unique),
  ]);
  return { openai, stripeFees, resend, metaAds, twilio };
}

export function parseMonthBounds(yyyyMm: string): { start: Date; end: Date } {
  if (!/^\d{4}-\d{2}$/.test(yyyyMm)) {
    throw new Error("month must be YYYY-MM");
  }
  const start = monthStartUtc(yyyyMm);
  const [y, m] = yyyyMm.split("-").map(Number);
  const end = new Date(Date.UTC(y, m, 1));
  return { start, end };
}
