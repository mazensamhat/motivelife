import { z } from "zod";
import { prisma } from "@forward/database";
import { getSession } from "@/lib/session";
import { badRequest, json, unauthorized, serverError } from "@/lib/api";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const candidates = await prisma.kashuRecurringCandidate.findMany({
      where: { userId: session.id, status: "pending" },
      orderBy: [{ confidence: "desc" }, { amount: "desc" }],
    });

    return json({
      candidates: candidates.map((c) => ({
        id: c.id,
        title: c.title,
        merchantNorm: c.merchantNorm,
        amount: c.amount,
        amountMin: c.amountMin,
        amountMax: c.amountMax,
        frequency: c.frequency,
        intervalDays: c.intervalDays,
        nextDueDate: c.nextDueDate?.toISOString() ?? null,
        priority: c.priority,
        confidence: c.confidence,
        autoPay: c.autoPay,
      })),
    });
  } catch (error) {
    console.error("[api/kashu/recurring GET]", error);
    return serverError("Could not load recurring suggestions.");
  }
}

const actionSchema = z.object({
  id: z.string(),
  action: z.enum(["confirm", "dismiss"]),
});

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const body = await request.json();
    const parsed = actionSchema.safeParse(body);
    if (!parsed.success) return badRequest("Invalid recurring action.");

    const candidate = await prisma.kashuRecurringCandidate.findFirst({
      where: { id: parsed.data.id, userId: session.id },
    });
    if (!candidate) return badRequest("Suggestion not found.");

    if (parsed.data.action === "dismiss") {
      await prisma.kashuRecurringCandidate.update({
        where: { id: candidate.id },
        data: { status: "dismissed" },
      });
      return json({ ok: true, status: "dismissed" });
    }

    const next = candidate.nextDueDate ?? new Date();
    const dueDay = next.getDate();
    const moneyType =
      candidate.priority === "LIFESTYLE" || candidate.priority === "DISCRETIONARY"
        ? "LIVING_EXPENSE"
        : candidate.frequency === "MONTHLY" && /sub|netflix|spotify|prime/i.test(candidate.title)
          ? "SUBSCRIPTION"
          : "BILL";

    const item = await prisma.moneyItem.create({
      data: {
        userId: session.id,
        type: moneyType,
        title: candidate.title,
        currentAmount: candidate.amount,
        dueDay,
        autoPay: candidate.autoPay,
        frequency: candidate.frequency,
        intervalDays: candidate.intervalDays,
        nextDueDate: candidate.nextDueDate,
        priority: candidate.priority,
        confidence: candidate.confidence,
        source: "statement",
        notes: `Confirmed from statement · ${candidate.merchantNorm}`,
      },
    });

    await prisma.kashuRecurringCandidate.update({
      where: { id: candidate.id },
      data: { status: "confirmed", moneyItemId: item.id },
    });

    return json({ ok: true, status: "confirmed", moneyItemId: item.id });
  } catch (error) {
    console.error("[api/kashu/recurring POST]", error);
    return serverError("Could not update recurring suggestion.");
  }
}
