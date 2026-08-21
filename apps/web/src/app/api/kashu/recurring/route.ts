import { z } from "zod";
import { prisma } from "@forward/database";
import { getSession } from "@/lib/session";
import { badRequest, json, unauthorized, serverError } from "@/lib/api";
import { ensureKashuSchema } from "@/lib/kashu/ensure-schema";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    await ensureKashuSchema();
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
        moneyItemId: c.moneyItemId,
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
  title: z.string().min(1).max(200).optional(),
  amount: z.number().positive().optional(),
  frequency: z
    .enum(["WEEKLY", "BIWEEKLY", "SEMI_MONTHLY", "MONTHLY", "ANNUAL", "ONE_OFF"])
    .optional(),
  intervalDays: z.number().int().positive().optional().nullable(),
  nextDueDate: z.string().datetime().optional().nullable(),
  dueDay: z.number().int().min(1).max(31).optional().nullable(),
  priority: z.enum(["MANDATORY", "NECESSARY", "DISCRETIONARY", "LIFESTYLE"]).optional(),
  moneyType: z
    .enum([
      "HOUSING",
      "BILL",
      "SUBSCRIPTION",
      "LIVING_EXPENSE",
      "COMMITMENT",
      "DEBT",
      "SAVINGS",
      "INVESTMENT",
      "RETIREMENT",
    ])
    .optional(),
});

function inferMoneyType(
  title: string,
  frequency: string,
  priority: string,
  explicit?: string
): string {
  if (explicit) return explicit;
  if (/property\s*tax|municipal|city\s*of|windsor\s*p/i.test(title)) return "HOUSING";
  if (/mortgage|rent|mtg/i.test(title)) return "HOUSING";
  if (/loan|lincoln|auto\s*loan|credit\s*card/i.test(title)) return "DEBT";
  if (priority === "LIFESTYLE" || priority === "DISCRETIONARY") return "LIVING_EXPENSE";
  if (frequency === "MONTHLY" && /sub|netflix|spotify|prime|gym|fitness/i.test(title)) {
    return "SUBSCRIPTION";
  }
  return "BILL";
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    await ensureKashuSchema();
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

    const title = parsed.data.title?.trim() || candidate.title;
    const amount = parsed.data.amount ?? candidate.amount;
    const frequency = parsed.data.frequency ?? candidate.frequency;
    const intervalDays =
      parsed.data.intervalDays !== undefined
        ? parsed.data.intervalDays
        : candidate.intervalDays;
    const priority = parsed.data.priority ?? candidate.priority;
    const nextDue =
      parsed.data.nextDueDate !== undefined
        ? parsed.data.nextDueDate
          ? new Date(parsed.data.nextDueDate)
          : null
        : candidate.nextDueDate;
    const next = nextDue ?? new Date();
    const dueDay =
      parsed.data.dueDay != null
        ? Math.min(28, Math.max(1, parsed.data.dueDay))
        : Math.min(28, Math.max(1, next.getDate()));
    const moneyType = inferMoneyType(title, frequency, priority, parsed.data.moneyType);

    let moneyItemId = candidate.moneyItemId;
    if (moneyItemId) {
      const existing = await prisma.moneyItem.findFirst({
        where: { id: moneyItemId, userId: session.id },
      });
      if (existing) {
        const notesBase = (existing.notes ?? "")
          .replace(/\s*·\s*timing-ready/gi, "")
          .trim();
        await prisma.moneyItem.update({
          where: { id: existing.id },
          data: {
            type: moneyType as
              | "HOUSING"
              | "BILL"
              | "SUBSCRIPTION"
              | "LIVING_EXPENSE"
              | "COMMITMENT"
              | "DEBT"
              | "SAVINGS"
              | "INVESTMENT"
              | "RETIREMENT",
            title,
            currentAmount: amount,
            dueDay,
            autoPay: candidate.autoPay,
            frequency,
            intervalDays,
            nextDueDate: nextDue,
            priority,
            confidence: candidate.confidence,
            source: existing.source ?? "statement",
            notes: notesBase
              ? `${notesBase} · timing-ready`
              : `Confirmed from statement · ${candidate.merchantNorm} · timing-ready`,
          },
        });
      } else {
        moneyItemId = null;
      }
    }

    if (!moneyItemId) {
      const item = await prisma.moneyItem.create({
        data: {
          userId: session.id,
          type: moneyType as
            | "HOUSING"
            | "BILL"
            | "SUBSCRIPTION"
            | "LIVING_EXPENSE"
            | "COMMITMENT"
            | "DEBT"
            | "SAVINGS"
            | "INVESTMENT"
            | "RETIREMENT",
          title,
          currentAmount: amount,
          dueDay,
          autoPay: candidate.autoPay,
          frequency,
          intervalDays,
          nextDueDate: nextDue,
          priority,
          confidence: candidate.confidence,
          source: "statement",
          notes: `Confirmed from statement · ${candidate.merchantNorm} · timing-ready`,
        },
      });
      moneyItemId = item.id;
    }

    await prisma.kashuRecurringCandidate.update({
      where: { id: candidate.id },
      data: {
        status: "confirmed",
        moneyItemId,
        title,
        amount,
        frequency,
        intervalDays,
        nextDueDate: nextDue,
        priority,
      },
    });

    return json({ ok: true, status: "confirmed", moneyItemId });
  } catch (error) {
    console.error("[api/kashu/recurring POST]", error);
    return serverError("Could not update recurring suggestion.");
  }
}
