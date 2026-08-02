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
import { ensureFamilyMapSchema } from "./ensure-schema";
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
  await ensureFamilyMapSchema();
  const { household, member: me } = await ensureHouseholdForUser(userId);

  const realOthers = await prisma.familyMember.count({
    where: { householdId: household.id, isSimulated: false, NOT: { userId: null } },
  });
  // Never advance demo actors once a real multi-person household exists
  if (realOthers <= 1) {
    await tickSimulatedMembers(household.id);
  }

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
    if (place && m.lastLocationAt && m.presenceStatus === "stationary") {
      timeAtPlaceMinutes = Math.max(
        1,
        Math.round((Date.now() - m.lastLocationAt.getTime()) / 60_000)
      );
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
      driveScoreRecent: ownTrip?.driveScore ?? null,
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
  const somethingDifferent =
    me.shareFamilyInsights && me.shareRoutineLearning
      ? detectSomethingDifferent(flowInputs)
      : null;

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

  const realMemberCount = members.filter((m) => !m.isSimulated).length;

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
