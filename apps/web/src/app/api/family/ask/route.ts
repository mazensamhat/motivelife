import { z } from "zod";
import { prisma } from "@forward/database";
import { getSessionFromRequest } from "@/lib/session";
import { badRequest, json, premiumRequired, serverError, unauthorized } from "@/lib/api";
import { getMemberForUser } from "@/lib/family-map/household";
import { answerAskKinzo } from "@/lib/family-map/ask-kinzo";
import { ensureFamilyMapSchema } from "@/lib/family-map/ensure-schema";
import { getViewerFamilyEntitlements } from "@/lib/family-map/require-intelligence";

const bodySchema = z.object({
  question: z.string().min(1).max(280),
  /** day | month — bounds DB read */
  range: z.enum(["day", "month"]).optional(),
});

/**
 * Ask KINZO — deterministic answers from household trips/visits (no LLM).
 */
export async function POST(request: Request) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) return unauthorized();

    const { entitlements } = await getViewerFamilyEntitlements();
    if (!entitlements?.intelligence) {
      return premiumRequired("Upgrade to KINZO AI to ask about family history.");
    }

    await ensureFamilyMapSchema();
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) return badRequest("Ask a short question.");

    const me = await getMemberForUser(session.id);
    if (!me) return badRequest("Join a family first.");

    const range = parsed.data.range ?? "month";
    const since =
      range === "day"
        ? new Date(Date.now() - 36 * 60 * 60_000)
        : new Date(Date.now() - 35 * 24 * 60 * 60_000);

    const members = await prisma.familyMember.findMany({
      where: { householdId: me.householdId, isSimulated: false },
      select: { id: true, displayName: true },
    });
    const memberIds = members.map((m) => m.id);

    const [trips, visits, places] = await Promise.all([
      prisma.familyTrip.findMany({
        where: {
          memberId: { in: memberIds },
          isActive: false,
          endedAt: { gte: since },
        },
        orderBy: { endedAt: "desc" },
        take: 80,
        select: {
          memberId: true,
          fromLabel: true,
          toLabel: true,
          distanceKm: true,
          durationMinutes: true,
          startedAt: true,
          endedAt: true,
          driveScore: true,
          member: { select: { displayName: true } },
        },
      }),
      prisma.familyPlaceVisit.findMany({
        where: {
          memberId: { in: memberIds },
          arrivedAt: { gte: since },
        },
        orderBy: { arrivedAt: "desc" },
        take: 120,
        select: {
          memberId: true,
          placeName: true,
          arrivedAt: true,
          departedAt: true,
          dwellMinutes: true,
          isActive: true,
        },
      }),
      prisma.familyPlace.findMany({
        where: { householdId: me.householdId },
        select: { name: true },
      }),
    ]);

    const result = answerAskKinzo({
      question: parsed.data.question,
      members,
      trips: trips.map((t) => ({
        memberId: t.memberId,
        memberName: t.member.displayName,
        fromLabel: t.fromLabel,
        toLabel: t.toLabel,
        distanceKm: t.distanceKm,
        durationMinutes: t.durationMinutes,
        startedAt: t.startedAt.toISOString(),
        endedAt: t.endedAt?.toISOString() ?? null,
        driveScore: t.driveScore,
      })),
      visits: visits.map((v) => ({
        memberId: v.memberId,
        placeName: v.placeName,
        arrivedAt: v.arrivedAt.toISOString(),
        departedAt: v.departedAt?.toISOString() ?? null,
        dwellMinutes: v.dwellMinutes,
        isActive: v.isActive,
      })),
      placeNames: places.map((p) => p.name),
    });

    return json(result);
  } catch (e) {
    console.error("ask kinzo", e);
    return serverError("Could not answer that.");
  }
}
