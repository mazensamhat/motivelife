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
import { tickSimulatedMembers } from "./demo-seed";
import { buildFamilyFlow, detectSomethingDifferent } from "./flow-engine";
import { ensureHouseholdForUser } from "./household";
import { applyLocationPrivacy } from "./privacy";

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
  const { household, member: me } = await ensureHouseholdForUser(userId);

  await tickSimulatedMembers(household.id);

  const [members, places, trips] = await Promise.all([
    prisma.familyMember.findMany({
      where: { householdId: household.id },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
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
      take: 12,
      include: { member: { select: { displayName: true, id: true } } },
    }),
  ]);

  const placeById = new Map(places.map((p) => [p.id, p]));
  const nameById = new Map(members.map((m) => [m.id, m.displayName]));

  const flowInputs = members.map((m) => {
    const place = m.currentPlaceId ? placeById.get(m.currentPlaceId) : null;
    return {
      id: m.id,
      displayName: m.displayName,
      presence: m.presenceStatus as FamilyMemberPresenceStatus,
      statusLabel: m.statusLabel ?? "Unknown",
      placeName: place?.name ?? null,
      etaMinutes: m.etaMinutes,
      batteryPercent: m.lastBatteryPercent,
      likelyDestination: m.likelyDestination,
      destinationConfidence: m.destinationConfidence,
      isAtHome: place?.category === "home",
    };
  });

  const flow = buildFamilyFlow(flowInputs);
  const somethingDifferent = detectSomethingDifferent(flowInputs);

  const memberViews = members.map((m) => {
    const place = m.currentPlaceId ? placeById.get(m.currentPlaceId) : null;
    const isYou = m.id === me.id;
    let timeAtPlaceMinutes: number | null = null;
    if (place && m.lastLocationAt && m.presenceStatus === "stationary") {
      // approximate from last location timestamp vs place last visit — MVP uses 0 placeholder if unknown
      timeAtPlaceMinutes = Math.max(
        1,
        Math.round((Date.now() - m.lastLocationAt.getTime()) / 60_000)
      );
    }

    const recentTrip = trips.find((t) => t.memberId === m.id);
    const raw = {
      id: m.id,
      displayName: m.displayName,
      role: (m.role === "OWNER" ? "OWNER" : "MEMBER") as "OWNER" | "MEMBER",
      color: m.color,
      isYou,
      isSimulated: m.isSimulated,
      locationSharingLevel: asSharing(m.locationSharingLevel),
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
      driveScoreRecent: recentTrip?.driveScore ?? null,
    };
    return applyLocationPrivacy(raw, isYou);
  });

  const placeViews = places.map((p) => {
    const headingThere = members.filter(
      (m) =>
        m.likelyDestination === p.name &&
        (m.presenceStatus === "driving" || m.presenceStatus === "moving")
    ).length;
    const avg =
      p.visitCount > 0 ? Math.round(p.totalDwellMin / Math.max(1, p.visitCount)) : 0;
    let insight: string | null = null;
    if (p.visitCount >= 3) {
      insight = `Family visits: ${p.visitCount}. ${
        headingThere ? `${headingThere} member heading there now.` : "No one heading there right now."
      }`;
    } else if (p.category === "home") {
      insight = "Home is your Family Flow anchor for ETAs.";
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
      mostCommonVisitorName: p.mostCommonVisitorId
        ? nameById.get(p.mostCommonVisitorId) ?? null
        : null,
      membersHeadingThere: headingThere,
      insight,
    };
  });

  const recentTrips: DriveTripSummary[] = trips.slice(0, 8).map((t) => ({
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
  }));

  return {
    household: {
      id: household.id,
      name: household.name,
      inviteCode: household.inviteCode,
      isOwner: household.ownerUserId === userId,
      memberCount: members.length,
      maxMembers: FAMILY_MAX_MEMBERS,
    },
    you: {
      memberId: me.id,
      locationSharingLevel: asSharing(me.locationSharingLevel),
      shareDrivingData: me.shareDrivingData,
      sharePlaceHistory: me.sharePlaceHistory,
      shareRoutineLearning: me.shareRoutineLearning,
      shareFamilyInsights: me.shareFamilyInsights,
    },
    members: memberViews,
    places: placeViews,
    recentTrips,
    flow,
    somethingDifferent,
    updatedAt: new Date().toISOString(),
  };
}
