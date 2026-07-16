import { z } from "zod";
import {
  OpsCostBrand,
  OpsCostCategory,
  OpsCostSource,
  prisma,
} from "@forward/database";
import { requireAdmin } from "@/lib/admin";
import { badRequest, forbidden, json, serverError, unauthorized } from "@/lib/api";
import { dailyFromMonthly, daysInMonthKey } from "@/lib/ops-cost-labels";
import { parseMonthBounds } from "@/lib/ops-cost-sync";

const createSchema = z.object({
  brand: z.nativeEnum(OpsCostBrand),
  category: z.nativeEnum(OpsCostCategory),
  amountCad: z.number().finite().nonnegative().max(1_000_000),
  occurredOn: z.string().min(4).max(32),
  vendor: z.string().max(128).optional(),
  description: z.string().max(500).optional(),
});

function serializeEntry(row: {
  id: string;
  brand: OpsCostBrand;
  category: OpsCostCategory;
  source: OpsCostSource;
  amountCad: { toNumber?: () => number } | number | string;
  currency: string;
  occurredOn: Date;
  vendor: string | null;
  description: string | null;
  externalId: string | null;
  createdAt: Date;
}) {
  const amount =
    typeof row.amountCad === "number"
      ? row.amountCad
      : typeof row.amountCad === "string"
        ? Number(row.amountCad)
        : row.amountCad.toNumber?.() ?? Number(row.amountCad);
  return {
    id: row.id,
    brand: row.brand,
    category: row.category,
    source: row.source,
    amountCad: Math.round(amount * 100) / 100,
    currency: row.currency,
    occurredOn: row.occurredOn.toISOString().slice(0, 10),
    vendor: row.vendor,
    description: row.description,
    externalId: row.externalId,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function GET(request: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) {
      if (auth.status === 401) return unauthorized(auth.error);
      return forbidden(auth.error);
    }

    const url = new URL(request.url);
    const month = url.searchParams.get("month") ?? new Date().toISOString().slice(0, 7);
    const brandParam = url.searchParams.get("brand");
    let start: Date;
    let end: Date;
    try {
      ({ start, end } = parseMonthBounds(month));
    } catch {
      return badRequest("month must be YYYY-MM");
    }

    const brand =
      brandParam && brandParam !== "all" && Object.values(OpsCostBrand).includes(brandParam as OpsCostBrand)
        ? (brandParam as OpsCostBrand)
        : undefined;

    const rows = await prisma.opsCostEntry.findMany({
      where: {
        occurredOn: { gte: start, lt: end },
        ...(brand ? { brand } : {}),
      },
      orderBy: [{ occurredOn: "desc" }, { createdAt: "desc" }],
      take: 500,
    });

    const entries = rows.map(serializeEntry);
    const totalCad = Math.round(entries.reduce((s, e) => s + e.amountCad, 0) * 100) / 100;
    const daysInMonth = daysInMonthKey(month);
    const totalDailyCad = dailyFromMonthly(totalCad, daysInMonth);

    const byCategory: Record<string, number> = {};
    const byBrand: Record<string, number> = {};
    for (const e of entries) {
      byCategory[e.category] = Math.round(((byCategory[e.category] ?? 0) + e.amountCad) * 100) / 100;
      byBrand[e.brand] = Math.round(((byBrand[e.brand] ?? 0) + e.amountCad) * 100) / 100;
    }

    const categoryBreakdown = Object.entries(byCategory).map(([category, monthlyCad]) => ({
      category,
      monthlyCad,
      dailyCad: dailyFromMonthly(monthlyCad, daysInMonth),
    }));
    const brandBreakdown = Object.entries(byBrand).map(([brandKey, monthlyCad]) => ({
      brand: brandKey,
      monthlyCad,
      dailyCad: dailyFromMonthly(monthlyCad, daysInMonth),
    }));

    return json({
      month,
      daysInMonth,
      totalCad,
      totalDailyCad,
      byCategory,
      byBrand,
      categoryBreakdown,
      brandBreakdown,
      entries: entries.map((e) => ({
        ...e,
        monthlyCad: e.amountCad,
        dailyCad: dailyFromMonthly(e.amountCad, daysInMonth),
      })),
      brands: Object.values(OpsCostBrand),
      categories: Object.values(OpsCostCategory),
    });
  } catch (error) {
    console.error("[admin/ops-costs GET]", error);
    const prismaCode =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: string }).code ?? "")
        : "";
    const message =
      error instanceof Error ? error.message : "Could not load ops costs.";
    // Admin-only: surface the real DB error so missing-table is obvious.
    if (prismaCode === "P2021" || /does not exist|OpsCostEntry/i.test(message)) {
      return serverError(
        "OpsCostEntry table missing on this database. Run packages/database/prisma/ops-cost-entry.sql in Supabase SQL Editor (production project), or db:push with production DATABASE_URL + DIRECT_URL.",
      );
    }
    return serverError(message.slice(0, 280) || "Could not load ops costs.");
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) {
      if (auth.status === 401) return unauthorized(auth.error);
      return forbidden(auth.error);
    }

    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return badRequest("Invalid cost entry.");

    const occurred = new Date(parsed.data.occurredOn);
    if (Number.isNaN(occurred.getTime())) return badRequest("Invalid occurredOn date.");

    const row = await prisma.opsCostEntry.create({
      data: {
        brand: parsed.data.brand,
        category: parsed.data.category,
        source: OpsCostSource.manual,
        amountCad: Math.round(parsed.data.amountCad * 100) / 100,
        currency: "CAD",
        occurredOn: occurred,
        vendor: parsed.data.vendor?.trim() || null,
        description: parsed.data.description?.trim() || null,
      },
    });

    return json({ ok: true, entry: serializeEntry(row) });
  } catch (error) {
    console.error("[admin/ops-costs POST]", error);
    const message =
      error instanceof Error ? error.message : "Could not create ops cost entry.";
    if (/does not exist|OpsCostEntry|P2021/i.test(message)) {
      return serverError(
        "OpsCostEntry table missing. Run ops-cost-entry.sql in Supabase (prod) or db:push with production URLs.",
      );
    }
    return serverError(message.slice(0, 280) || "Could not create ops cost entry.");
  }
}
