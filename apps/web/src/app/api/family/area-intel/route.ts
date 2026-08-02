import { z } from "zod";
import { getSession } from "@/lib/session";
import { badRequest, json, serverError, unauthorized } from "@/lib/api";
import { buildFamilyAreaIntel } from "@/lib/family-map/area-intel";
import { getMemberForUser } from "@/lib/family-map/household";
import { prisma } from "@forward/database";
import { createNotification } from "@/lib/notifications";
import { weatherHazardForDriver } from "@/lib/family-map/road-hazards";

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
    }> = [];

    if (me) {
      const rows = await prisma.familyMember.findMany({
        where: { householdId: me.householdId },
        select: {
          id: true,
          displayName: true,
          presenceStatus: true,
          lastSpeedKmh: true,
          lastBatteryPercent: true,
          lastLat: true,
          lastLng: true,
        },
      });
      members = rows.map((r) => ({
        id: r.id,
        displayName: r.displayName,
        presence: r.presenceStatus,
        speedKmh: r.lastSpeedKmh,
        batteryPercent: r.lastBatteryPercent,
        lat: r.lastLat,
        lng: r.lastLng,
      }));
    }

    const areaIntel = await buildFamilyAreaIntel({
      lat: parsed.data.lat,
      lng: parsed.data.lng,
      members,
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
