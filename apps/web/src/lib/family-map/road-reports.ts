/**
 * Household-crowdsourced road reports (police / events) → FamilyDriveEvent orbs.
 * Backed by FamilyRoadReport; expires so stale traps don't linger.
 */

import { prisma } from "@forward/database";
import type { FamilyDriveEvent, FamilyDriveEventKind } from "@forward/shared";
import { haversineKm } from "./drive-impact";
import { ensureFamilyMapSchema } from "./ensure-schema";

const POLICE_TTL_MS = 90 * 60_000;
const OTHER_TTL_MS = 6 * 60 * 60_000;

export type RoadReportKind = "police" | "other";

function defaultTitle(kind: RoadReportKind): string {
  return kind === "police" ? "Police" : "Event";
}

function defaultDetail(kind: RoadReportKind, memberName: string): string {
  return kind === "police"
    ? `Reported by ${memberName} · speed trap / police activity nearby`
    : `Reported by ${memberName} · concert, game, or gathering nearby`;
}

export async function createRoadReport(opts: {
  householdId: string;
  memberId: string;
  memberName: string;
  kind: RoadReportKind;
  lat: number;
  lng: number;
  note?: string | null;
}): Promise<FamilyDriveEvent> {
  await ensureFamilyMapSchema();
  const note = opts.note?.trim() || "";
  const ttl = opts.kind === "police" ? POLICE_TTL_MS : OTHER_TTL_MS;
  const expiresAt = new Date(Date.now() + ttl);
  const title = note
    ? note.length > 40
      ? `${note.slice(0, 38)}…`
      : note
    : defaultTitle(opts.kind);
  const detail = note
    ? `${note} · reported by ${opts.memberName}`
    : defaultDetail(opts.kind, opts.memberName);

  const row = await prisma.familyRoadReport.create({
    data: {
      householdId: opts.householdId,
      memberId: opts.memberId,
      kind: opts.kind,
      title,
      detail,
      lat: opts.lat,
      lng: opts.lng,
      expiresAt,
    },
  });

  return reportToDriveEvent(row, {
    memberId: opts.memberId,
    memberName: opts.memberName,
    distanceAheadKm: 0,
  });
}

export async function fetchHouseholdRoadReports(opts: {
  householdId: string;
  center: { lat: number; lng: number } | null;
  routePath?: Array<{ lat: number; lng: number }> | null;
  memberId: string | null;
  memberName: string | null;
  radiusKm?: number;
  limit?: number;
}): Promise<FamilyDriveEvent[]> {
  await ensureFamilyMapSchema();
  const now = new Date();
  const rows = await prisma.familyRoadReport.findMany({
    where: {
      householdId: opts.householdId,
      expiresAt: { gt: now },
    },
    include: { member: { select: { displayName: true } } },
    orderBy: { createdAt: "desc" },
    take: 40,
  });

  if (!rows.length) return [];

  const radius = opts.radiusKm ?? 18;
  const limit = opts.limit ?? 8;
  const path = opts.routePath?.filter(
    (p) => Number.isFinite(p.lat) && Number.isFinite(p.lng)
  );

  const scored = rows
    .map((row) => {
      let minKm = opts.center
        ? haversineKm(opts.center, { lat: row.lat, lng: row.lng })
        : 0;
      if (path?.length) {
        for (const p of path) {
          const d = haversineKm(p, { lat: row.lat, lng: row.lng });
          if (d < minKm) minKm = d;
        }
      }
      return { row, minKm };
    })
    .filter((x) => x.minKm <= radius)
    .sort((a, b) => a.minKm - b.minKm)
    .slice(0, limit);

  return scored.map(({ row, minKm }) =>
    reportToDriveEvent(row, {
      memberId: opts.memberId ?? row.memberId,
      memberName: opts.memberName ?? row.member.displayName,
      distanceAheadKm: Number(minKm.toFixed(2)),
    })
  );
}

function reportToDriveEvent(
  row: {
    id: string;
    kind: string;
    title: string;
    detail: string;
    lat: number;
    lng: number;
  },
  opts: {
    memberId: string | null;
    memberName: string | null;
    distanceAheadKm: number;
  }
): FamilyDriveEvent {
  const kind: FamilyDriveEventKind =
    row.kind === "police" ? "police" : "other";
  const km = opts.distanceAheadKm;
  return {
    id: `report-${row.id}`,
    kind,
    title: row.title,
    detail: row.detail,
    severity: kind === "police" ? "watch" : "info",
    memberId: opts.memberId,
    memberName: opts.memberName,
    lat: row.lat,
    lng: row.lng,
    etaDeltaMin: kind === "police" ? 2 : 1,
    distanceAheadKm: km,
    badge:
      km > 0 ? (km >= 10 ? `${Math.round(km)}` : km.toFixed(1)) : "!",
    visual: kind === "police" ? "police" : "other",
  };
}
