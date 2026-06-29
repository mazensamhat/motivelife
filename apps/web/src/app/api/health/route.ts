import { z } from "zod";
import { prisma } from "@forward/database";
import { HEALTH_ITEM_TYPES } from "@forward/shared";
import { getSession } from "@/lib/session";
import { badRequest, json, unauthorized, serverError } from "@/lib/api";
import { recordProgressMoment } from "@/lib/forward";

const createSchema = z.object({
  type: z.enum(HEALTH_ITEM_TYPES),
  title: z.string().min(1).max(200),
  targetValue: z.number().positive().optional(),
  currentValue: z.number().min(0).optional(),
  unit: z.string().max(50).optional(),
  goalId: z.string().optional(),
  notes: z.string().max(1000).optional(),
});

const updateSchema = z.object({
  id: z.string(),
  title: z.string().min(1).max(200).optional(),
  targetValue: z.number().positive().optional().nullable(),
  currentValue: z.number().min(0).optional(),
  unit: z.string().max(50).optional().nullable(),
  goalId: z.string().nullable().optional(),
  notes: z.string().max(1000).optional().nullable(),
});

const deleteSchema = z.object({ id: z.string() });

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const items = await prisma.healthItem.findMany({
      where: { userId: session.id },
      include: { goal: { select: { id: true, title: true } } },
      orderBy: [{ type: "asc" }, { updatedAt: "desc" }],
    });

    return json({ items });
  } catch (error) {
    console.error("[api/health]", error);
    return serverError("Health data unavailable. Run: npx pnpm@9.15.0 db:push");
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return badRequest("Invalid input");

    const item = await prisma.healthItem.create({
      data: {
        userId: session.id,
        ...parsed.data,
        currentValue: parsed.data.currentValue ?? 0,
      },
      include: { goal: { select: { id: true, title: true } } },
    });

    return json({ item }, 201);
  } catch (error) {
    console.error("[api/health]", error);
    return serverError("Could not create health item.");
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return badRequest("Invalid input");

    const { id, ...rest } = parsed.data;

    const existing = await prisma.healthItem.findFirst({
      where: { id, userId: session.id },
    });
    if (!existing) return badRequest("Item not found");

    const item = await prisma.healthItem.update({
      where: { id },
      data: rest,
      include: { goal: { select: { id: true, title: true } } },
    });

    if (
      item.targetValue &&
      item.currentValue >= item.targetValue &&
      existing.currentValue < (existing.targetValue ?? Infinity)
    ) {
      await recordProgressMoment(
        session.id,
        `Health goal reached: ${item.title}`,
        "MILESTONE",
        "HEALTH"
      );
    }

    return json({ item });
  } catch (error) {
    console.error("[api/health]", error);
    return serverError("Could not update health item.");
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const body = await request.json();
    const parsed = deleteSchema.safeParse(body);
    if (!parsed.success) return badRequest("Invalid input");

    const existing = await prisma.healthItem.findFirst({
      where: { id: parsed.data.id, userId: session.id },
    });
    if (!existing) return badRequest("Item not found");

    await prisma.healthItem.delete({ where: { id: parsed.data.id } });
    return json({ ok: true });
  } catch (error) {
    console.error("[api/health]", error);
    return serverError("Could not delete health item.");
  }
}
