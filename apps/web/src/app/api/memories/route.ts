import { z } from "zod";
import { prisma } from "@forward/database";
import { LIFE_DOMAINS } from "@forward/shared";
import { getSession } from "@/lib/session";
import { badRequest, json, unauthorized } from "@/lib/api";

const createSchema = z.object({
  content: z.string().min(1).max(2000),
  type: z.enum(["FACT", "PREFERENCE", "COMMITMENT", "ACHIEVEMENT"]).optional(),
  domain: z.enum(LIFE_DOMAINS).optional(),
});

const deleteSchema = z.object({
  id: z.string(),
});

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();

  const memories = await prisma.memory.findMany({
    where: { userId: session.id },
    orderBy: { updatedAt: "desc" },
  });

  return json({ memories });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return unauthorized();

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid input");

  const { content, type, domain } = parsed.data;

  const memory = await prisma.memory.create({
    data: {
      userId: session.id,
      content,
      type: type ?? "FACT",
      domain,
    },
  });

  return json({ memory }, 201);
}

export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session) return unauthorized();

  const body = await request.json();
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid input");

  const { id } = parsed.data;

  const existing = await prisma.memory.findFirst({ where: { id, userId: session.id } });
  if (!existing) return badRequest("Memory not found");

  await prisma.memory.delete({ where: { id } });
  return json({ ok: true });
}
