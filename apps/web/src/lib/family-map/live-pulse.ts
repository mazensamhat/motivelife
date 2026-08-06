import { prisma } from "@forward/database";
import { ensureHouseholdForUser } from "./household";

/**
 * Cheap “did anyone move?” probe for SSE — avoids rebuilding full Family Map
 * state on every tick.
 */
export async function getHouseholdLivePulse(userId: string): Promise<{
  householdId: string;
  fingerprint: string;
}> {
  const { household } = await ensureHouseholdForUser(userId);
  const rows = await prisma.familyMember.findMany({
    where: { householdId: household.id, isSimulated: false },
    select: {
      id: true,
      lastLat: true,
      lastLng: true,
      lastSpeedKmh: true,
      lastHeadingDeg: true,
      presenceStatus: true,
      statusLabel: true,
      lastLocationAt: true,
      likelyDestination: true,
      etaMinutes: true,
    },
    orderBy: { id: "asc" },
  });

  const fingerprint = rows
    .map((r) =>
      [
        r.id,
        r.lastLat?.toFixed(5) ?? "",
        r.lastLng?.toFixed(5) ?? "",
        r.lastSpeedKmh != null ? Math.round(r.lastSpeedKmh) : "",
        r.lastHeadingDeg != null ? Math.round(r.lastHeadingDeg) : "",
        r.presenceStatus ?? "",
        r.statusLabel ?? "",
        r.lastLocationAt?.getTime() ?? "",
        r.likelyDestination ?? "",
        r.etaMinutes ?? "",
      ].join(":")
    )
    .join("|");

  return { householdId: household.id, fingerprint };
}
