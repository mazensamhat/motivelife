import { z } from "zod";
import { prisma } from "@forward/database";
import { LEARNING_ITEM_TYPES } from "@forward/shared";
import { getSession } from "@/lib/session";
import { badRequest, json, unauthorized, serverError } from "@/lib/api";
import { recordProgressMoment } from "@/lib/forward";

const createSchema = z.object({
  type: z.enum(LEARNING_ITEM_TYPES),
  title: z.string().min(1).max(200),
  progress: z.number().int().min(0).max(100).optional(),
  targetDate: z.string().datetime().optional(),
  url: z.string().url().optional().or(z.literal("")),
  goalId: z.string().optional(),
  notes: z.string().max(1000).optional(),
});

const updateSchema = z.object({
  id: z.string(),
  title: z.string().min(1).max(200).optional(),
  progress: z.number().int().min(0).max(100).optional(),
  targetDate: z.string().datetime().optional().nullable(),
  url: z.string().url().optional().or(z.literal("")).nullable(),
  goalId: z.string().nullable().optional(),
  notes: z.string().max(1000).optional().nullable(),
});

const deleteSchema = z.object({ id: z.string() });

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const items = await prisma.learningItem.findMany({
      where: { userId: session.id },
      include: { goal: { select: { id: true, title: true } } },
      orderBy: [{ progress: "asc" }, { updatedAt: "desc" }],
    });

    return json({ items });
  } catch (error) {
    console.error("[api/learning]", error);
    return serverError("Learning data unavailable. Run: npx pnpm@9.15.0 db:push");
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return badRequest("Invalid input");

    const { targetDate, url, ...rest } = parsed.data;

    const item = await prisma.learningItem.create({
      data: {
        userId: session.id,
        ...rest,
        progress: rest.progress ?? 0,
        targetDate: targetDate ? new Date(targetDate) : undefined,
        url: url || undefined,
      },
      include: { goal: { select: { id: true, title: true } } },
    });

    return json({ item }, 201);
  } catch (error) {
    console.error("[api/learning]", error);
    return serverError("Could not create learning item.");
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return badRequest("Invalid input");

    const { id, targetDate, url, ...rest } = parsed.data;

    const existing = await prisma.learningItem.findFirst({
      where: { id, userId: session.id },
    });
    if (!existing) return badRequest("Item not found");

    const item = await prisma.learningItem.update({
      where: { id },
      data: {
        ...rest,
        ...(targetDate !== undefined && {
          targetDate: targetDate ? new Date(targetDate) : null,
        }),
        ...(url !== undefined && { url: url || null }),
      },
      include: { goal: { select: { id: true, title: true } } },
    });

    if (item.progress === 100 && existing.progress < 100) {
      await recordProgressMoment(
        session.id,
        `Completed: ${item.title}`,
        "MILESTONE",
        "LEARNING"
      );
    }

    return json({ item });
  } catch (error) {
    console.error("[api/learning]", error);
    return serverError("Could not update learning item.");
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const body = await request.json();
    const parsed = deleteSchema.safeParse(body);
    if (!parsed.success) return badRequest("Invalid input");

    const existing = await prisma.learningItem.findFirst({
      where: { id: parsed.data.id, userId: session.id },
    });
    if (!existing) return badRequest("Item not found");

    await prisma.learningItem.delete({ where: { id: parsed.data.id } });
    return json({ ok: true });
  } catch (error) {
    console.error("[api/learning]", error);
    return serverError("Could not delete learning item.");
  }
}
