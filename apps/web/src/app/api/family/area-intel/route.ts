import { z } from "zod";
import { getSession } from "@/lib/session";
import { badRequest, json, serverError, unauthorized } from "@/lib/api";
import { buildFamilyAreaIntel } from "@/lib/family-map/area-intel";
import { getMemberForUser } from "@/lib/family-map/household";
import { prisma } from "@forward/database";
import { createNotification } from "@/lib/notifications";
import { weatherHazardForDriver } from "@/lib/family-map/road-hazards";
import type { DriveTripSummary } from "@forward/shared";
import { driveScoreBand } from "@forward/shared";

const schema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

/** Optional weather enrichment — never on the critical map path. */
export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const url = new URL(request.url);
    const parsed = schema.safeParse({
      lat: url.searchParams.get("lat"),
      lng: url.searchParams.get("lng"),
    });
    if (!parsed.success) return badRequest("lat/lng required.");

    const me = await getMemberForUser(session.id);
    let members: Array<{
      id: string;
      presence: string;
      speedKmh: number | null;
      displayName: string;
      batteryPercent: number | null;
      lat: number | null;
      lng: number | null;
      headingDeg: number | null;
      etaMinutes: number | null;
      likelyDestination: string | null;
    }> = [];
    let recentTrips: DriveTripSummary[] = [];
    let home: { lat: number; lng: number } | null = null;

    if (me) {
      const [rows, homePlace, trips] = await Promise.all([
        prisma.familyMember.findMany({
          where: { householdId: me.householdId },
          select: {
            id: true,
            displayName: true,
            presenceStatus: true,
            lastSpeedKmh: true,
            lastBatteryPercent: true,
            lastLat: true,
            lastLng: true,
            lastHeadingDeg: true,
            likelyDestination: true,
            etaMinutes: true,
          },
        }),
        prisma.familyPlace.findFirst({
          where: { householdId: me.householdId, category: "home" },
          select: { lat: true, lng: true },
          orderBy: { visitCount: "desc" },
        }),
        prisma.familyTrip.findMany({
          where: {
            member: { householdId: me.householdId },
            OR: [{ isActive: true }, { isActive: false, endedAt: { not: null } }],
          },
          orderBy: [{ isActive: "desc" }, { endedAt: "desc" }],
          take: 12,
          select: {
            id: true,
            memberId: true,
            fromLabel: true,
            toLabel: true,
            distanceKm: true,
            durationMinutes: true,
            avgSpeedKmh: true,
            maxSpeedKmh: true,
            hardBraking: true,
            rapidAcceleration: true,
            unusualRouteEvents: true,
            driveScore: true,
            estimatedFuelCostCad: true,
            startedAt: true,
            endedAt: true,
            member: { select: { displayName: true } },
          },
        }),
      ]);

      members = rows.map((r) => ({
        id: r.id,
        displayName: r.displayName,
        presence: r.presenceStatus,
        speedKmh: r.lastSpeedKmh,
        batteryPercent: r.lastBatteryPercent,
        lat: r.lastLat,
        lng: r.lastLng,
        headingDeg: r.lastHeadingDeg ?? null,
        etaMinutes: r.etaMinutes ?? null,
        likelyDestination: r.likelyDestination ?? null,
      }));

      if (homePlace) home = { lat: homePlace.lat, lng: homePlace.lng };

      recentTrips = trips.map((t) => ({
        id: t.id,
        memberId: t.memberId,
        memberName: t.member.displayName,
        fromLabel: t.fromLabel,
        toLabel: t.toLabel,
        distanceKm: Number(t.distanceKm),
        durationMinutes: Math.round(t.durationMinutes),
        avgSpeedKmh: Math.round(t.avgSpeedKmh),
        maxSpeedKmh: Math.round(t.maxSpeedKmh),
        hardBraking: t.hardBraking,
        rapidAcceleration: t.rapidAcceleration,
        unusualRouteEvents: t.unusualRouteEvents,
        driveScore: t.driveScore,
        band: driveScoreBand(t.driveScore),
        estimatedFuelCostCad: t.estimatedFuelCostCad,
        startedAt: t.startedAt.toISOString(),
        endedAt: t.endedAt?.toISOString() ?? null,
      }));
    }

    const areaIntel = await buildFamilyAreaIntel({
      lat: parsed.data.lat,
      lng: parsed.data.lng,
      members,
      recentTrips,
      home,
    });

    // Calm in-app notifications when severe weather hits a driver's live location
    for (const mw of areaIntel.memberWeather) {
      if (!mw.weather.severe) continue;
      const signal = weatherHazardForDriver({
        displayName: mw.memberName,
        weather: mw.weather,
      });
      if (!signal) continue;
      void createNotification({
        userId: session.id,
        type: "family_weather_alert",
        title: signal.title,
        body: signal.body,
        href: "/family-map",
      }).catch(() => undefined);
    }

    return json({ areaIntel });
  } catch (error) {
    console.error("[api/family/area-intel]", error);
    return serverError("Could not load area conditions.");
  }
}
