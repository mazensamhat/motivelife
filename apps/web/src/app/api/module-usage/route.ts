import { prisma } from "@forward/database";
import type { LifeModuleId } from "@forward/shared";
import { getSession } from "@/lib/session";
import { badRequest, json, unauthorized } from "@/lib/api";
import { parseModuleUsage, recordModuleOpen } from "@/lib/adaptive-modules";
import { recordUsageEvent } from "@/lib/usage-events";
import { z } from "zod";

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { moduleUsage: true },
  });

  return json({ usage: parseModuleUsage(user?.moduleUsage) });
}

const schema = z.object({ moduleId: z.string().min(1).max(32) });

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return unauthorized();

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid module");

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { moduleUsage: true },
  });

  const usage = recordModuleOpen(parseModuleUsage(user?.moduleUsage), parsed.data.moduleId as LifeModuleId);

  await prisma.user.update({
    where: { id: session.id },
    data: { moduleUsage: JSON.stringify(usage) },
  });

  await recordUsageEvent(session.id, parsed.data.moduleId, "open");

  return json({ usage });
}
