import { prisma } from "@forward/database";
import {
  FAMILY_MAX_MEMBERS,
  driveScoreBand,
  type DriveTripSummary,
  type FamilyMapState,
  type FamilyMemberPresenceStatus,
  type FamilyPlaceCategory,
  type LocationSharingLevel,
} from "@forward/shared";
import { ensureFamilyMapSchema } from "./ensure-schema";
import { buildFamilyFlow, buildSomethingDifferentNote } from "./flow-engine";
import { ensureHouseholdForUser } from "./household";
import { isUnusuallyLateAtPlace } from "./normal-life";
import { buildAreaAlerts, buildTrafficIntel } from "./area-intel";
import { applyLocationPrivacy } from "./privacy";
import { summarizeFuelTrend } from "./vehicle-fuel";

function asPlaceCategory(raw: string): FamilyPlaceCategory {
  const allowed: FamilyPlaceCategory[] = ["home", "work", "school", "shop", "sports", "other"];
  return (allowed.includes(raw as FamilyPlaceCategory) ? raw : "other") as FamilyPlaceCategory;
}

function asSharing(raw: string): LocationSharingLevel {
  const allowed: LocationSharingLevel[] = [
    "precise",
    "approximate",
    "destination_only",
    "eta_only",
    "driving_status_only",
    "off",
  ];
  return (allowed.includes(raw as LocationSharingLevel) ? raw : "precise") as LocationSharingLevel;
}

export async function getFamilyMapState(userId: string): Promise<FamilyMapState> {
  await ensureFamilyMapSchema();
  const { household, member: me } = await ensureHouseholdForUser(userId);

  // Sample/demo actors are retired — purge any leftover simulated members.
  await prisma.familyMember.deleteMany({
    where: { householdId: household.id, isSimulated: true },
  });

  // Graduated sharing presets were removed — everyone in the household is precise.
  await prisma.familyMember.updateMany({
    where: {
      householdId: household.id,
      NOT: { locationSharingLevel: "precise" },
    },
    data: { locationSharingLevel: "precise" },
  });

  const [members, places, trips] = await Promise.all([
    prisma.familyMember.findMany({
      where: { householdId: household.id, isSimulated: false },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
      include: {
        user: { select: { phoneNumber: true, avatarUrl: true } },
      },
    }),
    prisma.familyPlace.findMany({
      where: { householdId: household.id },
      orderBy: { name: "asc" },
    }),
    prisma.familyTrip.findMany({
      where: {
        member: { householdId: household.id },
        isActive: false,
        endedAt: { not: null },
      },
      orderBy: { endedAt: "desc" },
      take: 20,
      include: {
        member: {
          select: {
            displayName: true,
            id: true,
            userId: true,
            shareDrivingData: true,
            locationSharingLevel: true,
          },
        },
      },
    }),
  ]);

  const placeById = new Map(places.map((p) => [p.id, p]));
  const memberById = new Map(members.map((m) => [m.id, m]));

  // Privacy-filter member pins FIRST — all other surfaces must use this view.
  const memberViews = members.map((m) => {
    const place = m.currentPlaceId ? placeById.get(m.currentPlaceId) : null;
    const isYou = m.id === me.id;
    let timeAtPlaceMinutes: number | null = null;
    const enteredAt =
      (m as typeof m & { currentPlaceEnteredAt?: Date | null }).currentPlaceEnteredAt ?? null;
    if (place && m.presenceStatus === "stationary") {
      const since = enteredAt ?? m.lastLocationAt;
      if (since) {
        timeAtPlaceMinutes = Math.max(
          1,
          Math.round((Date.now() - since.getTime()) / 60_000)
        );
      }
    }

    const ownTrip =
      m.shareDrivingData || isYou
        ? trips.find((t) => t.memberId === m.id)
        : undefined;

    const raw = {
      id: m.id,
      displayName: m.displayName,
      role: (m.role === "OWNER" ? "OWNER" : "MEMBER") as "OWNER" | "MEMBER",
      color: m.color,
      isYou,
      isSimulated: m.isSimulated,
      // Product always uses precise household sharing (presets removed from UI).
      locationSharingLevel: "precise" as LocationSharingLevel,
      presence: m.presenceStatus as FamilyMemberPresenceStatus,
      statusLabel: m.statusLabel ?? "Unknown",
      lat: m.lastLat,
      lng: m.lastLng,
      speedKmh: m.lastSpeedKmh,
      headingDeg: m.lastHeadingDeg,
      batteryPercent: m.lastBatteryPercent,
      lastLocationAt: m.lastLocationAt?.toISOString() ?? null,
      placeName: place?.name ?? null,
      placeCategory: place ? asPlaceCategory(place.category) : null,
      likelyDestination: m.likelyDestination,
      destinationConfidence: m.destinationConfidence,
      etaMinutes: m.etaMinutes,
      timeAtPlaceMinutes,
      driveScoreRecent: ownTrip?.driveScore ?? null,
      phoneNumber: m.isSimulated ? null : m.user?.phoneNumber ?? null,
      avatarUrl: m.isSimulated ? null : m.user?.avatarUrl ?? null,
      vehicleLabel:
        m.vehicleMake && m.vehicleModel
          ? `${m.vehicleMake} ${m.vehicleModel}${m.vehicleYear ? ` (${m.vehicleYear})` : ""}`
          : null,
    };
    return applyLocationPrivacy(raw, isYou);
  });

  const viewById = new Map(memberViews.map((m) => [m.id, m]));

  // Flow / Something's Different only from what viewers are allowed to see
  const flowInputs = memberViews
    .filter((v) => {
      const raw = memberById.get(v.id);
      if (!raw) return false;
      if (v.id === me.id) return true;
      if (!raw.shareFamilyInsights) return false;
      return v.locationSharingLevel !== "off";
    })
    .map((v) => ({
      id: v.id,
      displayName: v.displayName,
      presence: v.presence,
      statusLabel: v.statusLabel,
      placeName: v.placeName,
      etaMinutes: v.etaMinutes,
      batteryPercent: v.batteryPercent,
      likelyDestination: v.likelyDestination,
      destinationConfidence: v.destinationConfidence,
      isAtHome: v.placeCategory === "home",
    }));

  const flow = buildFamilyFlow(flowInputs);

  let somethingDifferent: FamilyMapState["somethingDifferent"] = null;
  if (me.shareFamilyInsights && me.shareRoutineLearning) {
    for (const v of flowInputs) {
      if (!v.placeName || v.presence !== "stationary") continue;
      const raw = memberById.get(v.id);
      if (!raw?.shareRoutineLearning) continue;
      try {
        const check = await isUnusuallyLateAtPlace({
          memberId: v.id,
          placeName: v.placeName,
        });
        if (check.unusual && check.usualLeaveLabel) {
          somethingDifferent = buildSomethingDifferentNote({
            displayName: v.displayName,
            placeName: v.placeName,
            usualLeaveLabel: check.usualLeaveLabel,
            batteryPercent: v.batteryPercent,
          });
          break;
        }
      } catch {
        // Routine table may not exist yet on first boot
      }
    }
  }

  const placeViews = places.map((p) => {
    const headingThere = memberViews.filter(
      (v) =>
        v.likelyDestination === p.name &&
        (v.presence === "driving" || v.presence === "moving")
    ).length;
    const avg =
      p.visitCount > 0 ? Math.round(p.totalDwellMin / Math.max(1, p.visitCount)) : 0;

    const visitor = p.mostCommonVisitorId ? memberById.get(p.mostCommonVisitorId) : null;
    const visitorView = p.mostCommonVisitorId ? viewById.get(p.mostCommonVisitorId) : null;
    const canNameVisitor =
      visitor &&
      visitor.sharePlaceHistory &&
      visitorView &&
      visitorView.locationSharingLevel !== "off";

    let insight: string | null = null;
    if (me.shareFamilyInsights && p.visitCount >= 3) {
      insight = `Family visits: ${p.visitCount}. ${
        headingThere ? `${headingThere} heading there now.` : "No one heading there right now."
      }`;
    } else if (p.category === "home") {
      insight = "Home anchors household ETAs.";
    }

    return {
      id: p.id,
      name: p.name,
      lat: p.lat,
      lng: p.lng,
      radiusM: p.radiusM,
      category: asPlaceCategory(p.category),
      visitCount: p.visitCount,
      averageVisitMinutes: avg,
      lastVisitedAt: p.lastVisitedAt?.toISOString() ?? null,
      mostCommonVisitorName: canNameVisitor ? visitor!.displayName : null,
      membersHeadingThere: headingThere,
      insight,
    };
  });

  const recentTrips: DriveTripSummary[] = trips
    .filter((t) => {
      if (t.memberId === me.id) return me.shareDrivingData;
      return (
        t.member.shareDrivingData &&
        asSharing(t.member.locationSharingLevel) !== "off" &&
        asSharing(t.member.locationSharingLevel) !== "eta_only" &&
        asSharing(t.member.locationSharingLevel) !== "destination_only"
      );
    })
    .slice(0, 8)
    .map((t) => ({
      id: t.id,
      memberId: t.memberId,
      memberName: t.member.displayName,
      fromLabel: t.fromLabel,
      toLabel: t.toLabel,
      distanceKm: Number(t.distanceKm.toFixed(1)),
      durationMinutes: Math.round(t.durationMinutes),
      avgSpeedKmh: Math.round(t.avgSpeedKmh),
      maxSpeedKmh: Math.round(t.maxSpeedKmh),
      hardBraking: t.hardBraking,
      rapidAcceleration: t.rapidAcceleration,
      unusualRouteEvents: t.unusualRouteEvents,
      driveScore: t.driveScore,
      band: driveScoreBand(t.driveScore),
      personalBaselineScore: null,
      estimatedFuelCostCad: t.estimatedFuelCostCad ?? null,
      estimatedFuelLitres: t.estimatedFuelLitres ?? null,
      estimatedFuelKwh: t.estimatedFuelKwh ?? null,
      startedAt: t.startedAt.toISOString(),
      endedAt: t.endedAt?.toISOString() ?? null,
      startLat: t.startLat,
      startLng: t.startLng,
      endLat: t.endLat,
      endLng: t.endLng,
    }));

  const realMemberCount = members.filter((m) => !m.isSimulated).length;

  const homePlace = places.find((p) => p.category === "home") ?? places[0];
  const pinMember = memberViews.find((m) => m.lat != null && m.lng != null);
  const areaLat = me.lastLat ?? homePlace?.lat ?? pinMember?.lat ?? null;
  const areaLng = me.lastLng ?? homePlace?.lng ?? pinMember?.lng ?? null;

  // Sync only — never await Open-Meteo on the map request (Fold was spinning forever)
  const traffic = buildTrafficIntel(
    memberViews.map((m) => ({
      presence: m.presence,
      speedKmh: m.speedKmh,
      displayName: m.displayName,
    }))
  );
  const lowBatteryMembers = memberViews
    .filter((m) => m.batteryPercent != null && m.batteryPercent < 15)
    .map((m) => m.displayName);
  const areaIntel = {
    weather: null,
    memberWeather: [] as [],
    traffic,
    alerts: buildAreaAlerts({
      weather: null,
      memberWeather: [],
      traffic,
      lowBatteryMembers,
    }),
    center: areaLat != null && areaLng != null ? { lat: areaLat, lng: areaLng } : null,
    updatedAt: new Date().toISOString(),
  };

  const myFuelTrips = await prisma.familyTrip.findMany({
    where: {
      memberId: me.id,
      isActive: false,
      endedAt: { not: null },
      estimatedFuelCostCad: { not: null },
    },
    orderBy: { endedAt: "desc" },
    take: 60,
    select: { estimatedFuelCostCad: true, endedAt: true },
  });
  const fuelSummary = summarizeFuelTrend(myFuelTrips);

  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  let placeVisitsToday: FamilyMapState["placeVisitsToday"] = [];
  try {
    const visits = await prisma.familyPlaceVisit.findMany({
      where: {
        memberId: me.id,
        OR: [{ arrivedAt: { gte: dayStart } }, { isActive: true }],
      },
      orderBy: { arrivedAt: "desc" },
      take: 24,
    });
    placeVisitsToday = visits.map((v) => {
      const dwell = v.isActive
        ? Math.max(
            1,
            Math.round((Date.now() - v.arrivedAt.getTime()) / 60_000)
          )
        : v.dwellMinutes;
      return {
        id: v.id,
        memberId: v.memberId,
        placeName: v.placeName,
        arrivedAt: v.arrivedAt.toISOString(),
        departedAt: v.departedAt?.toISOString() ?? null,
        dwellMinutes: dwell,
        isActive: v.isActive,
        placeId: v.placeId,
        placeLat: v.lat ?? null,
        placeLng: v.lng ?? null,
        placeRadiusM: 100,
      };
    });
  } catch {
    placeVisitsToday = [];
  }

  const vehicle =
    me.vehicleMake && me.vehicleModel
      ? {
          make: me.vehicleMake,
          model: me.vehicleModel,
          year: me.vehicleYear,
          fuelType: (["gas", "diesel", "hybrid", "ev"].includes(me.fuelType ?? "")
            ? me.fuelType
            : "gas") as "gas" | "diesel" | "hybrid" | "ev",
          engineSummary: me.engineSummary ?? "Vehicle saved",
          litresPer100km: me.litresPer100km,
          kwhPer100km: me.kwhPer100km,
          fuelPriceCadPerLitre: me.fuelPriceCadPerLitre ?? 1.55,
          evPriceCadPerKwh: me.evPriceCadPerKwh ?? 0.14,
        }
      : null;

  return {
    household: {
      id: household.id,
      name: household.name,
      // Invite code is an owner secret — members join via share, not the map strip
      inviteCode: household.ownerUserId === userId ? household.inviteCode : "",
      isOwner: household.ownerUserId === userId,
      memberCount: realMemberCount,
      maxMembers: FAMILY_MAX_MEMBERS,
    },
    you: {
      memberId: me.id,
      locationSharingLevel: "precise",
      shareDrivingData: me.shareDrivingData,
      sharePlaceHistory: me.sharePlaceHistory,
      shareRoutineLearning: me.shareRoutineLearning,
      shareFamilyInsights: me.shareFamilyInsights,
      memberKind: (["ADULT", "TEEN", "CHILD"].includes(me.memberKind)
        ? me.memberKind
        : "ADULT") as "ADULT" | "TEEN" | "CHILD",
      vehicle,
      fuelSummary,
    },
    members: memberViews,
    places: placeViews,
    recentTrips,
    placeVisitsToday,
    flow,
    somethingDifferent,
    areaIntel,
    updatedAt: new Date().toISOString(),
  };
}
