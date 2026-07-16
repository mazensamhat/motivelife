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

export type OpsCostSyncResult = {
  openai: Array<{ monthKey: string; amountCad: number; upserted: boolean }>;
  stripeFees: Array<{ monthKey: string; amountCad: number; upserted: boolean; skipped?: string }>;
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
    },
  });
}

export async function syncOpenAiCosts(months: string[]): Promise<OpsCostSyncResult["openai"]> {
  const out: OpsCostSyncResult["openai"] = [];
  for (const key of months) {
    const rows = await prisma.aiUsageMonthly.findMany({
      where: { monthKey: key },
      select: { estimatedMicroUsd: true },
    });
    const microUsd = rows.reduce((s, r) => s + (r.estimatedMicroUsd ?? 0), 0);
    const usd = microUsd / 1_000_000;
    const amountCad = usd * USD_TO_CAD;
    const externalId = `openai:${key}`;
    await upsertAutoEntry({
      source: OpsCostSource.auto_openai,
      externalId,
      brand: OpsCostBrand.motivelife,
      category: OpsCostCategory.openai,
      amountCad,
      occurredOn: monthStartUtc(key),
      vendor: "OpenAI",
      description: `Estimated OpenAI usage for ${key} (from AiUsageMonthly)`,
    });
    out.push({ monthKey: key, amountCad: Math.round(amountCad * 100) / 100, upserted: true });
  }
  return out;
}

export async function syncStripeFees(months: string[]): Promise<OpsCostSyncResult["stripeFees"]> {
  const out: OpsCostSyncResult["stripeFees"] = [];
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

      // Stripe amounts are in the account currency; treat as USD if not CAD.
      const feeMajor = feeCents / 100;
      const amountCad = feeMajor * USD_TO_CAD;
      const externalId = `stripe_fees:${key}`;
      await upsertAutoEntry({
        source: OpsCostSource.auto_stripe,
        externalId,
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

/** Sync current + previous calendar month auto costs. */
export async function syncOpsAutoCosts(now = new Date()): Promise<OpsCostSyncResult> {
  const months = [monthKey(now), previousMonthKey(now)];
  const unique = [...new Set(months)];
  const [openai, stripeFees] = await Promise.all([
    syncOpenAiCosts(unique),
    syncStripeFees(unique),
  ]);
  return { openai, stripeFees };
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
