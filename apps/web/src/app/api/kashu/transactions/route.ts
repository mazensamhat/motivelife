import { z } from "zod";
import { prisma } from "@forward/database";
import { KASHU_TX_CLASSIFICATIONS } from "@forward/shared";
import { getSession } from "@/lib/session";
import { badRequest, json, unauthorized, serverError } from "@/lib/api";
import { ensureKashuSchema } from "@/lib/kashu/ensure-schema";

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
      transactions: transactions.map((t) => ({
        ...t,
        postedAt: t.postedAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("[api/kashu/transactions GET]", error);
    return serverError("Could not load Kashu transactions.");
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
      transaction: {
        id: updated.id,
        postedAt: updated.postedAt.toISOString(),
        description: updated.description,
        merchantNorm: updated.merchantNorm,
        amount: updated.amount,
        direction: updated.direction,
        balanceAfter: updated.balanceAfter,
        classification: updated.classification,
        isTransfer: updated.isTransfer,
        isOneOff: updated.isOneOff,
        statementId: updated.statementId,
      },
    });
  } catch (error) {
    console.error("[api/kashu/transactions PATCH]", error);
    return serverError("Could not update transaction.");
  }
}
