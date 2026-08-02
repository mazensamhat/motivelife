import { prisma } from "@forward/database";
import { destinationPoint } from "./geo";
import { MEMBER_COLORS } from "./household";
import { upsertPlace } from "./location-engine";

type DemoMember = {
  displayName: string;
  color: string;
  simRouteKey: string;
  battery: number;
};

const DEMO_MEMBERS: DemoMember[] = [
  { displayName: "Mom", color: MEMBER_COLORS[1]!, simRouteKey: "grocery", battery: 72 },
  { displayName: "Mohamad", color: MEMBER_COLORS[2]!, simRouteKey: "campus", battery: 54 },
  { displayName: "Mahdi", color: MEMBER_COLORS[3]!, simRouteKey: "soccer", battery: 13 },
];

/** Seed Home / Work / Costco / Soccer around an anchor and create simulated members. */
export async function seedDemoFamily(opts: {
  householdId: string;
  anchorLat: number;
  anchorLng: number;
}) {
  const home = await upsertPlace({
    householdId: opts.householdId,
    name: "Home",
    lat: opts.anchorLat,
    lng: opts.anchorLng,
    radiusM: 100,
    category: "home",
  });

  const work = destinationPoint(opts.anchorLat, opts.anchorLng, 45, 8.5);
  await upsertPlace({
    householdId: opts.householdId,
    name: "Work",
    lat: work.lat,
    lng: work.lng,
    radiusM: 140,
    category: "work",
  });

  const costco = destinationPoint(opts.anchorLat, opts.anchorLng, 210, 4.2);
  await upsertPlace({
    householdId: opts.householdId,
    name: "Costco",
    lat: costco.lat,
    lng: costco.lng,
    radiusM: 160,
    category: "shop",
  });

  const soccer = destinationPoint(opts.anchorLat, opts.anchorLng, 120, 3.1);
  await upsertPlace({
    householdId: opts.householdId,
    name: "Soccer",
    lat: soccer.lat,
    lng: soccer.lng,
    radiusM: 120,
    category: "sports",
  });

  const campus = destinationPoint(opts.anchorLat, opts.anchorLng, 300, 6.4);
  await upsertPlace({
    householdId: opts.householdId,
    name: "University",
    lat: campus.lat,
    lng: campus.lng,
    radiusM: 180,
    category: "school",
  });

  // Remove prior simulated members, keep real ones
  await prisma.familyMember.deleteMany({
    where: { householdId: opts.householdId, isSimulated: true },
  });

  for (const demo of DEMO_MEMBERS) {
    await prisma.familyMember.create({
      data: {
        householdId: opts.householdId,
        displayName: demo.displayName,
        role: "MEMBER",
        color: demo.color,
        isSimulated: true,
        simRouteKey: demo.simRouteKey,
        locationSharingLevel: "precise",
        lastBatteryPercent: demo.battery,
        presenceStatus: "unknown",
        statusLabel: "Simulated",
      },
    });
  }

  return { homeId: home.id };
}

/** Advance simulated members along scripted routes based on wall clock. */
export async function tickSimulatedMembers(householdId: string) {
  const places = await prisma.familyPlace.findMany({ where: { householdId } });
  const byName = new Map(places.map((p) => [p.name, p]));
  const home = byName.get("Home");
  if (!home) return;

  const sims = await prisma.familyMember.findMany({
    where: { householdId, isSimulated: true },
  });

  const now = Date.now();
  const cycle = (now / 1000) % 900; // 15-minute loop

  for (const sim of sims) {
    const key = sim.simRouteKey ?? "home_bound";
    let lat = home.lat;
    let lng = home.lng;
    let speed = 0;
    let statusLabel = "At Home";
    let presence = "stationary";
    let destination: string | null = null;
    let confidence: number | null = null;
    let eta: number | null = null;
    let placeId: string | null = home.id;
    let heading: number | null = null;

    if (key === "grocery") {
      const costco = byName.get("Costco")!;
      // 0-4 min: at costco, 4-12 driving home, 12-15 at home
      if (cycle < 240) {
        lat = costco.lat;
        lng = costco.lng;
        placeId = costco.id;
        statusLabel = `Costco · Arrived ${Math.floor(cycle / 60) + 12} min ago`;
        presence = "stationary";
      } else if (cycle < 720) {
        const t = (cycle - 240) / 480;
        lat = costco.lat + (home.lat - costco.lat) * t;
        lng = costco.lng + (home.lng - costco.lng) * t;
        speed = 48;
        presence = "driving";
        destination = "Home";
        confidence = 0.91;
        eta = Math.max(1, Math.round((1 - t) * 12));
        statusLabel = `Driving home · ETA ${eta} min`;
        placeId = null;
        heading = 30;
      } else {
        statusLabel = "At Home";
        presence = "stationary";
      }
    } else if (key === "campus") {
      const uni = byName.get("University")!;
      if (cycle < 500) {
        lat = uni.lat;
        lng = uni.lng;
        placeId = uni.id;
        statusLabel = "University · Leaving around 4:30";
        presence = "stationary";
        destination = "Home";
        confidence = 0.78;
        eta = 34;
      } else {
        const t = (cycle - 500) / 400;
        lat = uni.lat + (home.lat - uni.lat) * Math.min(1, t);
        lng = uni.lng + (home.lng - uni.lng) * Math.min(1, t);
        speed = 36;
        presence = "driving";
        destination = "Home";
        confidence = 0.86;
        eta = Math.max(1, Math.round((1 - Math.min(1, t)) * 22));
        statusLabel = `→ Home · ETA ${eta} min`;
        placeId = null;
      }
    } else if (key === "soccer") {
      const soccer = byName.get("Soccer")!;
      lat = soccer.lat;
      lng = soccer.lng;
      placeId = soccer.id;
      // Stay late for Something's Different when battery low
      const late = sim.lastBatteryPercent != null && sim.lastBatteryPercent < 20;
      statusLabel = late
        ? "Soccer · Still there past usual leave time"
        : "Soccer · Practice ends 7:30";
      presence = "stationary";
      destination = "Home";
      confidence = 0.64;
      eta = late ? 0 : 25;
    } else {
      // Dad-style home bound drive from work
      const work = byName.get("Work")!;
      const t = (cycle % 600) / 600;
      lat = work.lat + (home.lat - work.lat) * t;
      lng = work.lng + (home.lng - work.lng) * t;
      speed = 55;
      presence = "driving";
      destination = "Home";
      confidence = 0.89;
      eta = Math.max(1, Math.round((1 - t) * 22));
      statusLabel = `Driving home · ETA ${eta} min`;
      placeId = null;
      heading = 225;
    }

    await prisma.familyMember.update({
      where: { id: sim.id },
      data: {
        lastLat: lat,
        lastLng: lng,
        lastSpeedKmh: speed,
        lastHeadingDeg: heading,
        lastLocationAt: new Date(),
        presenceStatus: presence,
        statusLabel,
        currentPlaceId: placeId,
        likelyDestination: destination,
        destinationConfidence: confidence,
        etaMinutes: eta,
      },
    });
  }
}
