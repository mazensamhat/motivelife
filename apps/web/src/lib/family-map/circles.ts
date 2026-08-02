import { prisma } from "@forward/database";
import { CIRCLE_DEFAULTS, type LocationCircleType } from "@forward/shared";
import { generateFamilyInviteCode } from "./invite-code";
import { ensureFamilyMapSchema } from "./ensure-schema";

export async function listCirclesForUser(userId: string) {
  await ensureFamilyMapSchema();
  const memberships = await prisma.locationCircleMember.findMany({
    where: { userId },
    include: {
      circle: {
        include: { _count: { select: { members: true } } },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return memberships.map((m) => ({
    id: m.circle.id,
    name: m.circle.name,
    type: m.circle.type,
    inviteCode: m.circle.ownerUserId === userId ? m.circle.inviteCode : "",
    memberCount: m.circle._count.members,
    isOwner: m.circle.ownerUserId === userId,
  }));
}

export async function getActiveFriendsCircle(userId: string) {
  await ensureFamilyMapSchema();
  const membership = await prisma.locationCircleMember.findFirst({
    where: {
      userId,
      circle: { type: "FRIENDS" },
    },
    include: {
      circle: {
        include: {
          members: { orderBy: { createdAt: "asc" } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!membership) return null;

  const circle = membership.circle;
  return {
    id: circle.id,
    name: circle.name,
    type: circle.type,
    inviteCode: circle.ownerUserId === userId ? circle.inviteCode : "",
    memberCount: circle.members.length,
    isOwner: circle.ownerUserId === userId,
    members: circle.members.map((m) => {
      const active =
        m.shareUntil == null || m.shareUntil.getTime() > Date.now();
      const showPrecise = active && m.sharingLevel === "precise";
      return {
        id: m.id,
        displayName: m.displayName,
        sharingLevel: m.sharingLevel,
        shareUntil: m.shareUntil?.toISOString() ?? null,
        isYou: m.userId === userId,
        color: m.color || "#22c55e",
        lat: showPrecise ? m.lastLat : null,
        lng: showPrecise ? m.lastLng : null,
        batteryPercent: active ? m.lastBatteryPercent : null,
        lastLocationAt: m.lastLocationAt?.toISOString() ?? null,
        statusLabel: !active
          ? "Share ended"
          : m.lastLat != null
            ? "Live"
            : "Waiting for location",
      };
    }),
  };
}

const FRIEND_COLORS = ["#22c55e", "#3b82f6", "#f59e0b", "#ec4899", "#8b5cf6", "#14b8a6"];

export async function updateCircleMemberLocation(opts: {
  userId: string;
  lat: number;
  lng: number;
  batteryPercent?: number | null;
}) {
  await ensureFamilyMapSchema();
  const memberships = await prisma.locationCircleMember.findMany({
    where: {
      userId: opts.userId,
      circle: { type: "FRIENDS" },
      OR: [{ shareUntil: null }, { shareUntil: { gt: new Date() } }],
    },
  });
  if (memberships.length === 0) return null;

  await Promise.all(
    memberships.map((m) =>
      prisma.locationCircleMember.update({
        where: { id: m.id },
        data: {
          lastLat: opts.lat,
          lastLng: opts.lng,
          lastBatteryPercent: opts.batteryPercent ?? undefined,
          lastLocationAt: new Date(),
          color: m.color || FRIEND_COLORS[0],
        },
      })
    )
  );

  return getActiveFriendsCircle(opts.userId);
}

export async function createCircle(opts: {
  userId: string;
  name: string;
  type: LocationCircleType;
  displayName?: string | null;
}) {
  await ensureFamilyMapSchema();
  const defaults = CIRCLE_DEFAULTS[opts.type];
  let inviteCode = generateFamilyInviteCode();
  for (let i = 0; i < 5; i++) {
    const clash = await prisma.locationCircle.findUnique({ where: { inviteCode } });
    if (!clash) break;
    inviteCode = generateFamilyInviteCode();
  }

  const user = await prisma.user.findUnique({
    where: { id: opts.userId },
    select: { name: true },
  });

  const shareUntil =
    defaults.defaultShareDurationMinutes != null
      ? new Date(Date.now() + defaults.defaultShareDurationMinutes * 60_000)
      : null;

  const circle = await prisma.locationCircle.create({
    data: {
      ownerUserId: opts.userId,
      name: opts.name.trim() || (opts.type === "FRIENDS" ? "Friends" : "Circle"),
      type: opts.type,
      inviteCode,
      members: {
        create: {
          userId: opts.userId,
          displayName: opts.displayName?.trim() || user?.name?.trim() || "Me",
          role: "OWNER",
          sharingLevel: "precise",
          shareUntil,
          memberKind: "ADULT",
          color: FRIEND_COLORS[0],
        },
      },
    },
  });

  return circle;
}

export async function joinCircleByCode(opts: {
  userId: string;
  code: string;
  displayName?: string | null;
}) {
  await ensureFamilyMapSchema();
  const inviteCode = opts.code.trim().toUpperCase();
  const circle = await prisma.locationCircle.findUnique({
    where: { inviteCode },
    include: { members: true },
  });
  if (!circle) throw new Error("INVALID_CODE");

  const already = circle.members.find((m) => m.userId === opts.userId);
  if (already) return circle;

  const defaults = CIRCLE_DEFAULTS[(circle.type as LocationCircleType) || "FRIENDS"] ??
    CIRCLE_DEFAULTS.FRIENDS;
  if (circle.members.length >= defaults.maxMembers) throw new Error("CIRCLE_FULL");

  const user = await prisma.user.findUnique({
    where: { id: opts.userId },
    select: { name: true },
  });

  const shareUntil =
    defaults.defaultShareDurationMinutes != null
      ? new Date(Date.now() + defaults.defaultShareDurationMinutes * 60_000)
      : null;

  await prisma.locationCircleMember.create({
    data: {
      circleId: circle.id,
      userId: opts.userId,
      displayName: opts.displayName?.trim() || user?.name?.trim() || "Friend",
      role: "MEMBER",
      sharingLevel: "precise",
      shareUntil,
      memberKind: "ADULT",
      color: FRIEND_COLORS[circle.members.length % FRIEND_COLORS.length],
    },
  });

  return circle;
}
