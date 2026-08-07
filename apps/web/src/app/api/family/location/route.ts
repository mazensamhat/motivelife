import { z } from "zod";
import { prisma } from "@forward/database";
import { getSessionFromRequest } from "@/lib/session";
import { badRequest, json, serverError, unauthorized } from "@/lib/api";
import { ensureFamilyMapSchema } from "@/lib/family-map/ensure-schema";
import { ensureHouseholdForUser } from "@/lib/family-map/household";
import { ingestLocationPing } from "@/lib/family-map/location-engine";
import { isFixedHomeMember } from "@/lib/family-map/fixed-home-members";

const schema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracyM: z.number().min(0).max(50_000).optional().nullable(),
  speedKmh: z.number().min(0).max(400).optional().nullable(),
  headingDeg: z.number().min(0).max(360).optional().nullable(),
  batteryPercent: z.number().int().min(0).max(100).optional().nullable(),
  recordedAt: z.string().datetime().optional(),
  /** Native motion: walking/driving/stationary — improves walk-start detection. */
  motionActivity: z
    .enum(["stationary", "walking", "driving", "unknown"])
    .optional()
    .nullable(),
});

export async function POST(request: Request) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) return unauthorized();

    await ensureFamilyMapSchema();

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest("Invalid location payload.");

    // Same membership path as the map load — avoid orphan solo rows / missing rows.
    const { member } = await ensureHouseholdForUser(session.id, session.name);

    // Pre-launch: fixed-home members (e.g. Mahdi) never ingest GPS — stay at Home.
    if (isFixedHomeMember(member.displayName)) {
      return json({ ok: true, ingested: false, fixedHome: true });
    }

    // Household sharing is always precise (presets removed from the product).
    if (member.locationSharingLevel !== "precise") {
      await prisma.familyMember.update({
        where: { id: member.id },
        data: { locationSharingLevel: "precise" },
      });
    }

    await ingestLocationPing({
      memberId: member.id,
      householdId: member.householdId,
      lat: parsed.data.lat,
      lng: parsed.data.lng,
      accuracyM: parsed.data.accuracyM,
      speedKmh: parsed.data.speedKmh,
      motionActivity: parsed.data.motionActivity,
      headingDeg: parsed.data.headingDeg,
      batteryPercent: parsed.data.batteryPercent,
      recordedAt: parsed.data.recordedAt ? new Date(parsed.data.recordedAt) : undefined,
    });

    // Evaluate no-show alerts off the hot path — fire-and-forget so GPS returns fast.
    void (async () => {
      try {
        const { evaluateNoShowAlerts } = await import("@/lib/family-map/no-show-alerts");
        const peers = await prisma.familyMember.findMany({
          where: { householdId: member.householdId, NOT: { userId: null } },
          select: { userId: true },
        });
        await evaluateNoShowAlerts({
          householdId: member.householdId,
          notifyUserIds: peers.map((p) => p.userId!).filter(Boolean),
        });
      } catch {
        // optional
      }
    })();

    // GPS ingest must stay cheap — full map-state rebuild was saturating Postgres
    // under multi-device ping + SSE. Clients refresh via /api/family/map + stream.
    return json({ ok: true, ingested: true });
  } catch (error) {
    console.error("[api/family/location]", error);
    return serverError("Could not update location.");
  }
}
