import { z } from "zod";
import { prisma } from "@forward/database";
import { MONEY_ITEM_TYPES } from "@forward/shared";
import { getSession } from "@/lib/session";
import { badRequest, json, unauthorized, serverError } from "@/lib/api";
import { recordProgressMoment } from "@/lib/forward";

const createSchema = z.object({
  type: z.enum(MONEY_ITEM_TYPES),
  title: z.string().min(1).max(200),
  targetAmount: z.number().positive().optional(),
  currentAmount: z.number().min(0).optional(),
  dueDay: z.number().int().min(1).max(31).optional(),
  targetDate: z.string().datetime().optional(),
  goalId: z.string().optional(),
  notes: z.string().max(1000).optional(),
  autoPay: z.boolean().optional(),
  frequency: z
    .enum(["WEEKLY", "BIWEEKLY", "SEMI_MONTHLY", "MONTHLY", "ANNUAL", "ONE_OFF"])
    .optional(),
  intervalDays: z.number().int().positive().optional(),
  nextDueDate: z.string().datetime().optional(),
  priority: z.enum(["MANDATORY", "NECESSARY", "DISCRETIONARY", "LIFESTYLE"]).optional(),
});

const updateSchema = z.object({
  id: z.string(),
  type: z.enum(MONEY_ITEM_TYPES).optional(),
  title: z.string().min(1).max(200).optional(),
  targetAmount: z.number().positive().optional().nullable(),
  currentAmount: z.number().min(0).optional(),
  dueDay: z.number().int().min(1).max(31).optional().nullable(),
  targetDate: z.string().datetime().optional().nullable(),
  goalId: z.string().nullable().optional(),
  notes: z.string().max(1000).optional().nullable(),
  autoPay: z.boolean().optional(),
  frequency: z
    .enum(["WEEKLY", "BIWEEKLY", "SEMI_MONTHLY", "MONTHLY", "ANNUAL", "ONE_OFF"])
    .optional()
    .nullable(),
  intervalDays: z.number().int().positive().optional().nullable(),
  nextDueDate: z.string().datetime().optional().nullable(),
  priority: z.enum(["MANDATORY", "NECESSARY", "DISCRETIONARY", "LIFESTYLE"]).optional().nullable(),
});

const deleteSchema = z.object({ id: z.string() });

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const items = await prisma.moneyItem.findMany({
      where: { userId: session.id },
      include: { goal: { select: { id: true, title: true } } },
      orderBy: [{ type: "asc" }, { updatedAt: "desc" }],
    });

    return json({ items });
  } catch (error) {
    console.error("[api/money]", error);
    return serverError("Money data unavailable. Run: npx pnpm@9.15.0 db:push");
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return badRequest("Invalid input");

    const {
      type,
      title,
      targetAmount,
      currentAmount,
      dueDay,
      targetDate,
      goalId,
      notes,
      autoPay,
      frequency,
      intervalDays,
      nextDueDate,
      priority,
    } = parsed.data;

    const item = await prisma.moneyItem.create({
      data: {
        userId: session.id,
        type,
        title,
        targetAmount,
        currentAmount: currentAmount ?? 0,
        dueDay,
        autoPay: autoPay ?? false,
        targetDate: targetDate ? new Date(targetDate) : undefined,
        goalId,
        notes,
        frequency: frequency ?? "MONTHLY",
        intervalDays,
        nextDueDate: nextDueDate ? new Date(nextDueDate) : undefined,
        priority: priority ?? "MANDATORY",
        source: "manual",
      },
      include: { goal: { select: { id: true, title: true } } },
    });

    return json({ item }, 201);
  } catch (error) {
    console.error("[api/money]", error);
    return serverError("Could not create money item.");
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return badRequest("Invalid input");

    const { id, targetDate, nextDueDate, ...rest } = parsed.data;

    const existing = await prisma.moneyItem.findFirst({
      where: { id, userId: session.id },
    });
    if (!existing) return badRequest("Item not found");

    const item = await prisma.moneyItem.update({
      where: { id },
      data: {
        ...rest,
        ...(targetDate !== undefined && {
          targetDate: targetDate ? new Date(targetDate) : null,
        }),
        ...(nextDueDate !== undefined && {
          nextDueDate: nextDueDate ? new Date(nextDueDate) : null,
        }),
      },
      include: { goal: { select: { id: true, title: true } } },
    });

    if (
      item.type === "SAVINGS" &&
      item.targetAmount &&
      item.currentAmount >= item.targetAmount &&
      existing.currentAmount < (existing.targetAmount ?? Infinity)
    ) {
      await recordProgressMoment(
        session.id,
        `Reached savings goal: ${item.title}`,
        "MILESTONE",
        "MONEY"
      );
    }

    if (
      item.type === "DEBT" &&
      item.currentAmount === 0 &&
      existing.currentAmount > 0
    ) {
      await recordProgressMoment(
        session.id,
        `Paid off: ${item.title}`,
        "MILESTONE",
        "MONEY"
      );
    }

    return json({ item });
  } catch (error) {
    console.error("[api/money]", error);
    return serverError("Could not update money item.");
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const body = await request.json();
    const parsed = deleteSchema.safeParse(body);
    if (!parsed.success) return badRequest("Invalid input");

    const existing = await prisma.moneyItem.findFirst({
      where: { id: parsed.data.id, userId: session.id },
    });
    if (!existing) return badRequest("Item not found");

    await prisma.moneyItem.delete({ where: { id: parsed.data.id } });
    return json({ ok: true });
  } catch (error) {
    console.error("[api/money]", error);
    return serverError("Could not delete money item.");
  }
}
