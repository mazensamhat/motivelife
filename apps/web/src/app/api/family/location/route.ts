import { z } from "zod";
import { prisma } from "@forward/database";
import { getSessionFromRequest } from "@/lib/session";
import { badRequest, json, serverError, unauthorized } from "@/lib/api";
import { ensureFamilyMapSchema } from "@/lib/family-map/ensure-schema";
import { ensureHouseholdForUser, repairUserMemberships } from "@/lib/family-map/household";
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
  /** True when MotiveLife is foreground / screen in use (distracted driving). */
  phoneInUse: z.boolean().optional().nullable(),
});

/** Per-user ingest floor — stops one phone from 4k posts / 5 min (Vercel alert). */
const MIN_INGEST_GAP_MS = 1_800;
const lastIngestAtByUser = new Map<string, number>();

function shouldThrottleIngest(userId: string): boolean {
  const now = Date.now();
  const last = lastIngestAtByUser.get(userId) ?? 0;
  if (now - last < MIN_INGEST_GAP_MS) return true;
  lastIngestAtByUser.set(userId, now);
  // Bound map size on busy instances
  if (lastIngestAtByUser.size > 5_000) {
    const cutoff = now - 60_000;
    for (const [id, at] of lastIngestAtByUser) {
      if (at < cutoff) lastIngestAtByUser.delete(id);
    }
  }
  return false;
}

export async function POST(request: Request) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) return unauthorized();

    // Cheap ack before schema/DB work when a client is storming.
    if (shouldThrottleIngest(session.id)) {
      return json({ ok: true, ingested: false, throttled: true });
    }

    await ensureFamilyMapSchema();

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest("Invalid location payload.");

    // Hot path: never run repairUserMemberships / household create on every GPS
    // ping — that was saturating Postgres (Mode of Life + Ops felt frozen).
    let member = await prisma.familyMember.findFirst({
      where: { userId: session.id, isSimulated: false },
      orderBy: { updatedAt: "desc" },
    });
    if (!member) {
      const ensured = await ensureHouseholdForUser(session.id, session.name);
      member = ensured.member;
    } else {
      const dupCount = await prisma.familyMember.count({
        where: { userId: session.id, isSimulated: false },
      });
      if (dupCount > 1) {
        const repaired = await repairUserMemberships(session.id);
        if (repaired) member = repaired;
      }
    }

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
      phoneInUse: parsed.data.phoneInUse,
    });

    // Evaluate no-show alerts off the hot path — fire-and-forget so GPS returns fast.
    void (async () => {
      try {
        const { evaluateNoShowAlerts } = await import("@/lib/family-map/no-show-alerts");
        const peers = await prisma.familyMember.findMany({
          where: { householdId: member!.householdId, NOT: { userId: null } },
          select: { userId: true },
        });
        await evaluateNoShowAlerts({
          householdId: member!.householdId,
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
