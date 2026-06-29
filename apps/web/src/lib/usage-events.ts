import { prisma } from "@forward/database";

export async function recordUsageEvent(
  userId: string,
  module: string,
  action = "open",
  durationMs?: number,
  statusCode = 200
) {
  try {
    await prisma.usageEvent.create({
      data: { userId, module, action, durationMs, statusCode },
    });
    await prisma.user.update({
      where: { id: userId },
      data: { lastSeenAt: new Date() },
    });
  } catch (error) {
    console.warn("[usage-events]", error);
  }
}
