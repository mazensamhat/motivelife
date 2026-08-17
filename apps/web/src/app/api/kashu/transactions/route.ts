import { z } from "zod";
import { prisma } from "@forward/database";
import { KASHU_TX_CLASSIFICATIONS } from "@forward/shared";
import { getSession } from "@/lib/session";
import { badRequest, json, unauthorized, serverError } from "@/lib/api";
import { ensureKashuSchema } from "@/lib/kashu/ensure-schema";
import { getOrCreateFinancialProfile } from "@/lib/life-finance-engine";

function merchantNorm(description: string) {
  return description
    .toUpperCase()
    .replace(/\s+/g, " ")
    .replace(/[^A-Z0-9 #&'.-]/g, "")
    .trim()
    .slice(0, 80);
}

function serializeTransaction(t: {
  id: string;
  postedAt: Date;
  description: string;
  merchantNorm: string | null;
  amount: number;
  direction: string;
  balanceAfter: number | null;
  classification: string | null;
  isTransfer: boolean;
  isOneOff: boolean;
  statementId: string | null;
}) {
  return {
    id: t.id,
    postedAt: t.postedAt.toISOString(),
    description: t.description,
    merchantNorm: t.merchantNorm,
    amount: t.amount,
    direction: t.direction,
    balanceAfter: t.balanceAfter,
    classification: t.classification,
    isTransfer: t.isTransfer,
    isOneOff: t.isOneOff,
    statementId: t.statementId,
  };
}

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    await ensureKashuSchema();
    const url = new URL(request.url);
    const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? 60) || 60));

    const transactions = await prisma.kashuTransaction.findMany({
      where: { userId: session.id },
      orderBy: { postedAt: "desc" },
      take: limit,
      select: {
        id: true,
        postedAt: true,
        description: true,
        merchantNorm: true,
        amount: true,
        direction: true,
        balanceAfter: true,
        classification: true,
        isTransfer: true,
        isOneOff: true,
        statementId: true,
      },
    });

    return json({
      transactions: transactions.map(serializeTransaction),
    });
  } catch (error) {
    console.error("[api/kashu/transactions GET]", error);
    return serverError("Could not load Kashu transactions.");
  }
}

const createSchema = z.object({
  description: z.string().min(1).max(200),
  amount: z.number().positive(),
  direction: z.enum(["debit", "credit"]),
  postedAt: z.string().min(8).max(40).optional(),
  classification: z.enum(KASHU_TX_CLASSIFICATIONS).optional(),
  isTransfer: z.boolean().optional(),
  isOneOff: z.boolean().optional(),
  applyToBalance: z.boolean().optional(),
});

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    await ensureKashuSchema();
    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return badRequest("Invalid transaction.");

    const postedAt = parsed.data.postedAt ? new Date(parsed.data.postedAt) : new Date();
    if (Number.isNaN(postedAt.getTime())) return badRequest("Invalid date.");

    const classification = parsed.data.classification ?? "other";
    const isTransfer = parsed.data.isTransfer ?? classification === "transfer";
    const applyToBalance = parsed.data.applyToBalance !== false && !isTransfer;

    const profile = await getOrCreateFinancialProfile(session.id);
    let balanceAfter: number | null = profile.liquidBalance ?? null;
    if (applyToBalance && profile.liquidBalance != null) {
      const next =
        parsed.data.direction === "debit"
          ? profile.liquidBalance - parsed.data.amount
          : profile.liquidBalance + parsed.data.amount;
      balanceAfter = Math.round(next * 100) / 100;
      await prisma.financialProfile.update({
        where: { userId: session.id },
        data: { liquidBalance: balanceAfter },
      });
    }

    const created = await prisma.kashuTransaction.create({
      data: {
        userId: session.id,
        postedAt,
        description: parsed.data.description.trim(),
        merchantNorm: merchantNorm(parsed.data.description) || null,
        amount: parsed.data.amount,
        direction: parsed.data.direction,
        balanceAfter,
        classification,
        isTransfer,
        isOneOff: parsed.data.isOneOff ?? true,
      },
    });

    return json({ transaction: serializeTransaction(created), liquidBalance: balanceAfter });
  } catch (error) {
    console.error("[api/kashu/transactions POST]", error);
    return serverError("Could not add transaction.");
  }
}

const patchSchema = z.object({
  id: z.string(),
  classification: z.enum(KASHU_TX_CLASSIFICATIONS).optional(),
  isTransfer: z.boolean().optional(),
  isOneOff: z.boolean().optional(),
  description: z.string().min(1).max(500).optional(),
});

export async function PATCH(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    await ensureKashuSchema();
    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return badRequest("Invalid transaction update.");

    const existing = await prisma.kashuTransaction.findFirst({
      where: { id: parsed.data.id, userId: session.id },
    });
    if (!existing) return badRequest("Transaction not found.");

    const { id, ...data } = parsed.data;
    const updated = await prisma.kashuTransaction.update({
      where: { id },
      data,
    });

    return json({
      transaction: serializeTransaction(updated),
    });
  } catch (error) {
    console.error("[api/kashu/transactions PATCH]", error);
    return serverError("Could not update transaction.");
  }
}
