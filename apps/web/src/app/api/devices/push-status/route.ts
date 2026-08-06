import { json, serverError, unauthorized } from "@/lib/api";
import { getSessionFromRequest } from "@/lib/session";
import { prisma } from "@forward/database";
import { ensureFamilyMapSchema } from "@/lib/family-map/ensure-schema";

/** Whether this signed-in user has any Expo push tokens registered. */
export async function GET(request: Request) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) return unauthorized();

    await ensureFamilyMapSchema().catch(() => null);

    const tokens = await prisma.devicePushToken.findMany({
      where: { userId: session.id },
      select: { platform: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 10,
    });

    return json({
      ok: true,
      registered: tokens.length > 0,
      count: tokens.length,
      platforms: [...new Set(tokens.map((t) => t.platform))],
      lastUpdatedAt: tokens[0]?.updatedAt?.toISOString() ?? null,
    });
  } catch (error) {
    console.error("[api/devices/push-status]", error);
    return serverError("Could not read push status.");
  }
}
