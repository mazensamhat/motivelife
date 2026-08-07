import { prisma } from "@forward/database";
import {
  FAMILY_MAX_MEMBERS,
  driveScoreBand,
  sanitizeSpeedKmh,
  type DriveTripSummary,
  type FamilyMapState,
  type FamilyMemberPresenceStatus,
  type FamilyPlaceCategory,
  type LocationSharingLevel,
} from "@forward/shared";
import { ensureFamilyMapSchema } from "./ensure-schema";
import { buildFamilyFlow, buildSomethingDifferentNote } from "./flow-engine";
import { buildSmartDeparture } from "./smart-departure";
import { buildFamilyTimeIntel } from "./family-time";
import { listNoShowAlerts } from "./no-show-alerts";
import { ensureHouseholdForUser } from "./household";
import { isUnusuallyLateAtPlace } from "./normal-life";
import { buildAreaAlerts, buildTrafficIntel } from "./area-intel";
import { applyLocationPrivacy } from "./privacy";
import { summarizeFuelTrend, estimateTripFuelCost } from "./vehicle-fuel";
import { freeFamilyEntitlements, resolveFamilyEntitlements, peekCachedFamilyEntitlements } from "./entitlements";
import { getCalendarEvents } from "@/lib/calendar-events";
import { isFixedHomeMember } from "./fixed-home-members";
import { coalescePlaceVisits } from "./history";

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

/** Cap GPS glitches without depending on a possibly-stale shared bundle. */
function safeSpeed(speed: number | null | undefined): number | null {
  try {
    if (typeof sanitizeSpeedKmh === "function") return sanitizeSpeedKmh(speed);
  } catch {
    // fall through
  }
  if (speed == null || !Number.isFinite(speed) || speed < 0) return null;
  if (speed > 200) return null;
  return Math.round(speed * 10) / 10;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

export async function getFamilyMapState(userId: string): Promise<FamilyMapState> {
  // Soft-timeout inside ensureFamilyMapSchema — safe to await.
  await ensureFamilyMapSchema();
  const { household, member: me } = await ensureHouseholdForUser(userId);

  // Housekeeping must not block the map response.
  void prisma.familyMember
    .deleteMany({ where: { householdId: household.id, isSimulated: true } })
    .catch(() => null);
  void prisma.familyMember
    .updateMany({
      where: {
        householdId: household.id,
        NOT: { locationSharingLevel: "precise" },
      },
      data: { locationSharingLevel: "precise" },
    })
    .catch(() => null);

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
        OR: [{ isActive: true }, { isActive: false, endedAt: { not: null } }],
      },
      orderBy: [{ isActive: "desc" }, { endedAt: "desc" }],
      take: 48,
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
  const homePlace = places.find((p) => p.category === "home") ?? places[0] ?? null;

  // Privacy-filter member pins FIRST — all other surfaces must use this view.
  const memberViews = members.map((m) => {
    const fixedHome = isFixedHomeMember(m.displayName) && homePlace != null;
    const place = fixedHome
      ? homePlace
      : m.currentPlaceId
        ? placeById.get(m.currentPlaceId)
        : null;
    const isYou = m.id === me.id;
    let timeAtPlaceMinutes: number | null = null;
    const enteredAt =
      (m as typeof m & { currentPlaceEnteredAt?: Date | null }).currentPlaceEnteredAt ?? null;
    if (place && (fixedHome || m.presenceStatus === "stationary")) {
      if (!fixedHome) {
        const since = enteredAt ?? m.lastLocationAt;
        if (since) {
          timeAtPlaceMinutes = Math.max(
            1,
            Math.round((Date.now() - since.getTime()) / 60_000)
          );
        }
      }
    }

    const ownTrip =
      fixedHome
        ? undefined
        : m.shareDrivingData || isYou
          ? trips.find((t) => t.memberId === m.id)
          : undefined;

    // Soft-decay stuck motion when the phone stopped posting — or when a
    // leftover "Walking" row has no corroborating speed (common right after
    // login while sitting: heartbeats refresh lastLocationAt, presence sticks).
    const lastAtMs = m.lastLocationAt?.getTime() ?? 0;
    const ageMs = lastAtMs > 0 ? Date.now() - lastAtMs : 0;
    const storedSpeed = safeSpeed(m.lastSpeedKmh);
    const ghostWalking =
      !fixedHome &&
      m.presenceStatus === "moving" &&
      (storedSpeed == null || storedSpeed < 1.5);
    const staleWalking =
      !fixedHome && m.presenceStatus === "moving" && ageMs > 90_000;
    // Sparse Android BG posts can gap ~60–90s; 75s was flipping kids to
    // "stationary" mid-drive so follow lost coast and looked frozen.
    const staleDriving =
      !fixedHome && m.presenceStatus === "driving" && ageMs > 210_000;
    const staleMotion = ghostWalking || staleWalking || staleDriving;
    const presence = (
      fixedHome || staleMotion ? "stationary" : m.presenceStatus
    ) as FamilyMemberPresenceStatus;
    const speedKmh = fixedHome || staleMotion ? 0 : storedSpeed;
    // Cap stale absurd ETAs left in DB from older prediction bugs.
    const rawEta = fixedHome || staleMotion ? null : m.etaMinutes;
    const etaMinutes =
      rawEta != null && Number.isFinite(rawEta) && rawEta > 0 && rawEta <= 90
        ? Math.round(rawEta)
        : null;
    let statusLabel = m.statusLabel ?? "Unknown";
    if (fixedHome) {
      statusLabel = `At ${homePlace!.name}`;
    } else if (staleMotion) {
      const mins = Math.max(1, Math.round(ageMs / 60_000));
      statusLabel = place?.name
        ? `At ${place.name}`
        : mins >= 2
          ? `Last seen ${mins} min ago`
          : "Stationary";
    } else if (
      statusLabel.includes("ETA") &&
      (etaMinutes == null || (m.etaMinutes != null && m.etaMinutes > 90))
    ) {
      // Strip multi-hour ETA copy left from bad predictions.
      statusLabel =
        m.presenceStatus === "driving"
          ? m.likelyDestination
            ? `Driving to ${m.likelyDestination}`
            : "Driving"
          : statusLabel.replace(/\s*·\s*ETA\s+\d+\s*min/i, "");
    }

    const raw = {
      id: m.id,
      displayName: m.displayName,
      relationshipLabel: m.relationshipLabel?.trim() || null,
      role: (m.role === "OWNER" ? "OWNER" : "MEMBER") as "OWNER" | "MEMBER",
      color: m.color,
      isYou,
      isSimulated: m.isSimulated,
      // Product always uses precise household sharing (presets removed from UI).
      locationSharingLevel: "precise" as LocationSharingLevel,
      presence,
      statusLabel,
      lat: fixedHome ? homePlace!.lat : m.lastLat,
      lng: fixedHome ? homePlace!.lng : m.lastLng,
      speedKmh,
      headingDeg: fixedHome || staleMotion ? null : m.lastHeadingDeg,
      batteryPercent: m.lastBatteryPercent,
      // Keep liveness fresh so the household doesn’t see “Updated Xm ago”.
      lastLocationAt: fixedHome
        ? new Date().toISOString()
        : m.lastLocationAt?.toISOString() ?? null,
      placeName: place?.name ?? null,
      placeCategory: place ? asPlaceCategory(place.category) : null,
      likelyDestination: fixedHome
        ? null
        : staleMotion
          ? place?.name ?? null
          : m.likelyDestination,
      destinationConfidence: fixedHome
        ? null
        : staleMotion
          ? place
            ? 1
            : null
          : m.destinationConfidence,
      etaMinutes,
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
      isAtHome: v.placeCategory === "home" && v.presence === "stationary",
    }));

  // Family logistics — deadlines are best-effort; never block map GET.
  let deadlines: Awaited<ReturnType<typeof listNoShowAlerts>> = [];
  try {
    deadlines = await withTimeout(listNoShowAlerts(household.id), 1_500, "noShowAlerts");
  } catch {
    deadlines = [];
  }

  const flow = buildFamilyFlow(flowInputs, {
    deadlines: deadlines.map((d) => ({
      memberId: d.memberId,
      placeName: d.placeName,
      byTimeLocal: d.byTimeLocal,
      enabled: d.enabled,
    })),
    places: places.map((p) => ({ name: p.name, category: p.category })),
  });

  // Something's Different is best-effort and time-boxed — never block map GET.
  let somethingDifferent: FamilyMapState["somethingDifferent"] = null;
  if (me.shareFamilyInsights && me.shareRoutineLearning) {
    try {
      somethingDifferent = await withTimeout(
        (async () => {
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
                return buildSomethingDifferentNote({
                  displayName: v.displayName,
                  placeName: v.placeName,
                  usualLeaveLabel: check.usualLeaveLabel,
                  batteryPercent: v.batteryPercent,
                });
              }
            } catch {
              // Routine table may not exist yet on first boot
            }
          }
          return null;
        })(),
        2_500,
        "somethingDifferent"
      );
    } catch {
      somethingDifferent = null;
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
    if (me.shareFamilyInsights && headingThere > 0) {
      insight = `${headingThere} heading there now · ${p.visitCount} family visits`;
    } else if (me.shareFamilyInsights && p.visitCount >= 5 && avg > 0) {
      insight = `${p.visitCount} visits · avg ${avg} min stay`;
    } else if (
      me.shareFamilyInsights &&
      p.category === "home" &&
      p.visitCount >= 1 &&
      headingThere === 0
    ) {
      insight = null; // Don't spam "Home anchors ETAs" — Flow KPI covers that.
    }

    return {
      id: p.id,
      name: p.name,
      lat: p.lat,
      lng: p.lng,
      radiusM: p.radiusM,
      category: asPlaceCategory(p.category),
      shape: (p.shape === "square" ? "square" : "circle") as "circle" | "square",
      notifyOnEnter: p.notifyOnEnter !== false,
      notifyOnLeave: p.notifyOnLeave !== false,
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
    .slice(0, 24)
    .map((t) => ({
      id: t.id,
      memberId: t.memberId,
      memberName: t.member.displayName,
      fromLabel: t.fromLabel,
      toLabel: t.toLabel,
      distanceKm: Number(t.distanceKm.toFixed(1)),
      durationMinutes: Math.round(t.durationMinutes),
      avgSpeedKmh: Math.round(t.avgSpeedKmh),
      maxSpeedKmh: Math.round(safeSpeed(t.maxSpeedKmh) ?? 0),
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

  let fuelSummary: {
    monthCad: number;
    prevMonthCad: number;
    direction: "flat" | "up" | "down";
    tripCount: number;
  } = { monthCad: 0, prevMonthCad: 0, direction: "flat", tripCount: 0 };
  try {
    const myFuelTrips = await prisma.familyTrip.findMany({
      where: {
        memberId: me.id,
        isActive: false,
        endedAt: { not: null },
      },
      orderBy: { endedAt: "desc" },
      take: 60,
      select: {
        id: true,
        distanceKm: true,
        estimatedFuelCostCad: true,
        endedAt: true,
      },
    });

    // Backfill costs for completed drives that finished before a vehicle was saved.
    // Any saved make/model is enough — don't require fuelType columns to be populated.
    if (me.vehicleMake && me.vehicleModel) {
      const fuelType = (
        ["gas", "diesel", "hybrid", "ev"].includes(me.fuelType ?? "")
          ? me.fuelType
          : "gas"
      ) as "gas" | "diesel" | "hybrid" | "ev";
      for (const t of myFuelTrips) {
        if (t.estimatedFuelCostCad != null) continue;
        const dist = Number(t.distanceKm);
        if (!(dist > 0.05)) continue;
        const est = estimateTripFuelCost({
          distanceKm: dist,
          fuelType,
          litresPer100km: me.litresPer100km,
          kwhPer100km: me.kwhPer100km,
          fuelPriceCadPerLitre: me.fuelPriceCadPerLitre ?? 1.55,
          evPriceCadPerKwh: me.evPriceCadPerKwh ?? 0.14,
        });
        if (est.costCad == null) continue;
        t.estimatedFuelCostCad = est.costCad;
        void prisma.familyTrip
          .update({
            where: { id: t.id },
            data: {
              estimatedFuelCostCad: est.costCad,
              estimatedFuelLitres: est.litres,
              estimatedFuelKwh: est.kwh,
            },
          })
          .catch(() => null);
      }
    }

    fuelSummary = summarizeFuelTrend(myFuelTrips);
  } catch {
    // Fuel columns may lag schema ensure — live map still loads.
  }

  // Visits for the whole household (privacy-filtered) so each member's Today
  // timeline can show their stays — not only the viewer's.
  const dayStart = new Date(Date.now() - 36 * 60 * 60_000);
  let placeVisitsToday: FamilyMapState["placeVisitsToday"] = [];
  try {
    const placeShareMemberIds = members
      .filter((m) => {
        if (m.id === me.id) return true;
        const level = asSharing(m.locationSharingLevel);
        return (
          m.sharePlaceHistory &&
          level !== "off" &&
          level !== "eta_only" &&
          level !== "destination_only"
        );
      })
      .map((m) => m.id);

    const visits = await prisma.familyPlaceVisit.findMany({
      where: {
        memberId: { in: placeShareMemberIds },
        OR: [{ arrivedAt: { gte: dayStart } }, { isActive: true }],
      },
      orderBy: { arrivedAt: "desc" },
      take: 80,
    });
    placeVisitsToday = coalescePlaceVisits(
      visits.map((v) => {
        const rawActiveDwell = Math.max(
          1,
          Math.round((Date.now() - v.arrivedAt.getTime()) / 60_000)
        );
        const dwell = v.isActive
          ? Math.min(rawActiveDwell, 16 * 60)
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
      })
    );
  } catch {
    placeVisitsToday = [];
  }

  // Smart Departure™ + Family Time — always for the viewer (own logistics).
  // shareFamilyInsights only gates household-wide Flow, not your Leave-by card.
  let smartDeparture: FamilyMapState["smartDeparture"] = null;
  let familyTime: FamilyMapState["familyTime"] = null;
  try {
      const [calendarEvents, usualLeaveMinute, weekTrips, weekHomeVisits] = await withTimeout(
        Promise.all([
          getCalendarEvents(userId, 1).catch(() => []),
          (async () => {
            const placeId = me.currentPlaceId;
            if (!placeId) return null;
            const place = places.find((p) => p.id === placeId);
            if (!place?.name) return null;
            const day = new Date().getDay();
            const hour = new Date().getHours();
            const row = await prisma.familyRoutineStat.findFirst({
              where: {
                memberId: me.id,
                placeName: place.name,
                dayOfWeek: day,
                hourBucket: { gte: Math.max(0, hour - 1), lte: Math.min(23, hour + 1) },
              },
              orderBy: { sampleCount: "desc" },
            });
            return row?.usualLeaveMinute ?? null;
          })().catch(() => null),
          prisma.familyTrip
            .findMany({
              where: {
                memberId: me.id,
                isActive: false,
                endedAt: { gte: new Date(Date.now() - 14 * 24 * 60 * 60_000) },
              },
              orderBy: { endedAt: "desc" },
              take: 40,
            })
            .catch(() => []),
          prisma.familyPlaceVisit
            .findMany({
              where: {
                memberId: me.id,
                arrivedAt: { gte: new Date(Date.now() - 14 * 24 * 60 * 60_000) },
              },
              orderBy: { arrivedAt: "desc" },
              take: 60,
            })
            .catch(() => []),
        ]),
        2_200,
        "smartDepartureFamilyTime"
      );

      smartDeparture = buildSmartDeparture({
        lat: me.lastLat,
        lng: me.lastLng,
        speedKmh: me.lastSpeedKmh,
        places: places.map((p) => ({
          name: p.name,
          lat: p.lat,
          lng: p.lng,
          category: asPlaceCategory(p.category),
        })),
        events: calendarEvents.map((e) => ({ title: e.title, start: e.start })),
        trafficLevel: traffic.level,
        usualLeaveMinute,
      });

      const myWeekTrips: DriveTripSummary[] = weekTrips.map((t) => ({
        id: t.id,
        memberId: t.memberId,
        memberName: me.displayName,
        fromLabel: t.fromLabel,
        toLabel: t.toLabel,
        distanceKm: Number(t.distanceKm.toFixed(1)),
        durationMinutes: Math.round(t.durationMinutes),
        avgSpeedKmh: Math.round(t.avgSpeedKmh),
        maxSpeedKmh: Math.round(safeSpeed(t.maxSpeedKmh) ?? 0),
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

      const homeNames = places.filter((p) => p.category === "home").map((p) => p.name);
      familyTime = buildFamilyTimeIntel({
        trips: myWeekTrips,
        placeVisits: weekHomeVisits.map((v) => ({
          id: v.id,
          memberId: v.memberId,
          placeName: v.placeName,
          arrivedAt: v.arrivedAt.toISOString(),
          departedAt: v.departedAt?.toISOString() ?? null,
          dwellMinutes: v.dwellMinutes,
          isActive: v.isActive,
          placeId: v.placeId,
          placeLat: v.lat ?? null,
          placeLng: v.lng ?? null,
          placeRadiusM: 100,
        })),
        homePlaceNames: homeNames,
      });
  } catch {
    smartDeparture = null;
    familyTime = null;
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

  let entitlements;
  try {
    entitlements = await withTimeout(
      resolveFamilyEntitlements({
        ownerUserId: household.ownerUserId,
        viewerUserId: userId,
      }),
      3_000,
      "entitlements"
    );
  } catch {
    // Prefer last known Family unlock over free — timeout fallbacks were
    // flashing "Ask the household owner…" on every live refresh while driving.
    const stale = peekCachedFamilyEntitlements(household.ownerUserId, userId);
    entitlements =
      stale ?? freeFamilyEntitlements(household.ownerUserId === userId);
  }

  // Free tier: live map stays usable. Intelligence payloads still load so the
  // Family Intelligence panel can render blurred + locked (tease what unlocks).
  // Interactive APIs (history, driving-report, alerts) stay entitlement-gated.
  // No-show evaluation runs on location updates, not map GET.

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
    entitlements,
    you: {
      memberId: me.id,
      locationSharingLevel: "precise",
      shareDrivingData: me.shareDrivingData,
      sharePlaceHistory: me.sharePlaceHistory,
      shareRoutineLearning: me.shareRoutineLearning,
      shareFamilyInsights: me.shareFamilyInsights,
      shareDigitalTwinIntegration: me.shareDigitalTwinIntegration !== false,
      alertArrive: me.alertArrive !== false,
      alertLeave: me.alertLeave !== false,
      alertDriving: me.alertDriving !== false,
      alertRoadHazards: me.alertRoadHazards !== false,
      alertStillThere: me.alertStillThere !== false,
      alertNoShow: me.alertNoShow !== false,
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
    smartDeparture,
    familyTime,
    areaIntel,
    updatedAt: new Date().toISOString(),
  };
}
