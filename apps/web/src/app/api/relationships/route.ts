import { z } from "zod";
import { prisma } from "@forward/database";
import { RELATIONSHIP_ITEM_TYPES } from "@forward/shared";
import { getSession } from "@/lib/session";
import { badRequest, json, unauthorized, serverError } from "@/lib/api";
import { recordProgressMoment } from "@/lib/forward";

const createSchema = z.object({
  type: z.enum(RELATIONSHIP_ITEM_TYPES),
  title: z.string().min(1).max(200),
  cadenceDays: z.number().int().min(1).max(365).optional(),
  lastContactAt: z.string().datetime().optional(),
  goalId: z.string().optional(),
  notes: z.string().max(1000).optional(),
});

const updateSchema = z.object({
  id: z.string(),
  title: z.string().min(1).max(200).optional(),
  cadenceDays: z.number().int().min(1).max(365).optional().nullable(),
  lastContactAt: z.string().datetime().optional().nullable(),
  goalId: z.string().nullable().optional(),
  notes: z.string().max(1000).optional().nullable(),
});

const deleteSchema = z.object({ id: z.string() });

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const items = await prisma.relationshipItem.findMany({
      where: { userId: session.id },
      include: { goal: { select: { id: true, title: true } } },
      orderBy: [{ type: "asc" }, { updatedAt: "desc" }],
    });

    return json({ items });
  } catch (error) {
    console.error("[api/relationships]", error);
    return serverError("Relationships data unavailable. Run: npx pnpm@9.15.0 db:push");
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return badRequest("Invalid input");

    const { lastContactAt, ...rest } = parsed.data;
    const item = await prisma.relationshipItem.create({
      data: {
        userId: session.id,
        ...rest,
        lastContactAt: lastContactAt ? new Date(lastContactAt) : undefined,
      },
      include: { goal: { select: { id: true, title: true } } },
    });

    return json({ item }, 201);
  } catch (error) {
    console.error("[api/relationships]", error);
    return serverError("Could not create relationship item.");
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return badRequest("Invalid input");

    const { id, lastContactAt, ...rest } = parsed.data;

    const existing = await prisma.relationshipItem.findFirst({
      where: { id, userId: session.id },
    });
    if (!existing) return badRequest("Item not found");

    const item = await prisma.relationshipItem.update({
      where: { id },
      data: {
        ...rest,
        ...(lastContactAt !== undefined
          ? { lastContactAt: lastContactAt ? new Date(lastContactAt) : null }
          : {}),
      },
      include: { goal: { select: { id: true, title: true } } },
    });

    if (
      lastContactAt &&
      existing.lastContactAt &&
      Date.now() - new Date(lastContactAt).getTime() < 60000
    ) {
      await recordProgressMoment(
        session.id,
        `Reached out to ${item.title}`,
        "MILESTONE",
        "RELATIONSHIPS"
      );
    }

    return json({ item });
  } catch (error) {
    console.error("[api/relationships]", error);
    return serverError("Could not update relationship item.");
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const body = await request.json();
    const parsed = deleteSchema.safeParse(body);
    if (!parsed.success) return badRequest("Invalid input");

    const existing = await prisma.relationshipItem.findFirst({
      where: { id: parsed.data.id, userId: session.id },
    });
    if (!existing) return badRequest("Item not found");

    await prisma.relationshipItem.delete({ where: { id: parsed.data.id } });
    return json({ ok: true });
  } catch (error) {
    console.error("[api/relationships]", error);
    return serverError("Could not delete relationship item.");
  }
}
