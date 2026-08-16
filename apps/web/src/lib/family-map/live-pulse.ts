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

  const [rows, places] = await Promise.all([
    prisma.familyMember.findMany({
      where: { householdId: membership.householdId, isSimulated: false },
      select: {
        id: true,
        lastLat: true,
        lastLng: true,
        lastSpeedKmh: true,
        lastHeadingDeg: true,
        presenceStatus: true,
        // Omit lastLocationAt / statusLabel — heartbeats refresh those without
        // moving the pin and forced full getFamilyMapState every ~15–30s (PC
        // map felt behind + choppy while the phone was already current).
        likelyDestination: true,
        etaMinutes: true,
      },
      orderBy: { id: "asc" },
    }),
    // Include places so create/rename/delete republishes map SSE (not only member motion).
    prisma.familyPlace.findMany({
      where: { householdId: membership.householdId },
      select: { id: true, updatedAt: true, name: true, lat: true, lng: true, radiusM: true },
      orderBy: { id: "asc" },
    }),
  ]);

  const memberFp = rows
    .map((r) =>
      [
        r.id,
        r.lastLat?.toFixed(5) ?? "",
        r.lastLng?.toFixed(5) ?? "",
        r.lastSpeedKmh != null ? Math.round(r.lastSpeedKmh) : "",
        r.lastHeadingDeg != null ? Math.round(r.lastHeadingDeg / 15) * 15 : "",
        r.presenceStatus ?? "",
        r.likelyDestination ?? "",
        r.etaMinutes ?? "",
      ].join(":")
    )
    .join("|");

  const placesFp = places
    .map((p) =>
      [
        p.id,
        p.name,
        p.lat.toFixed(5),
        p.lng.toFixed(5),
        Math.round(p.radiusM),
        p.updatedAt.getTime(),
      ].join(":")
    )
    .join("|");

  const fingerprint = `${memberFp}||p:${places.length}:${placesFp}`;

  return { householdId: membership.householdId, fingerprint };
}
