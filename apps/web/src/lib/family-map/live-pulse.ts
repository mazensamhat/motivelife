import { prisma } from "@forward/database";

/**
 * Cheap “did anyone move?” probe for SSE — avoids rebuilding full Family Map
 * state on every tick.
 *
 * Intentionally does NOT call ensureHouseholdForUser / ensureFamilyMapSchema /
 * repairUserMemberships. Those heal/DDL paths ran every ~700ms per open map
 * and herd-locked Postgres (Mode of Life slowed with Family).
 */
export async function getHouseholdLivePulse(userId: string): Promise<{
  householdId: string;
  fingerprint: string;
}> {
  const membership = await prisma.familyMember.findFirst({
    where: { userId, isSimulated: false },
    select: { householdId: true },
    orderBy: { updatedAt: "desc" },
  });
  if (!membership) {
    return { householdId: "", fingerprint: "" };
  }

  const rows = await prisma.familyMember.findMany({
    where: { householdId: membership.householdId, isSimulated: false },
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

  return { householdId: membership.householdId, fingerprint };
}
