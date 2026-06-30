import { prisma } from "@forward/database";
import type { LifePreference } from "@forward/shared";

export type NotificationPayload = {
  id: string;
  type: string;
  title: string;
  body: string;
  href: string | null;
  readAt: string | null;
  createdAt: string;
};

async function userAllowsNotifications(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { preferences: true },
  });
  if (!user?.preferences) return true;
  try {
    const prefs = JSON.parse(user.preferences) as LifePreference;
    return prefs.notifications !== "off";
  } catch {
    return true;
  }
}

export async function createNotification(params: {
  userId: string;
  type: string;
  title: string;
  body: string;
  href?: string;
  force?: boolean;
}) {
  if (!params.force && !(await userAllowsNotifications(params.userId))) {
    return null;
  }

  return prisma.notification.create({
    data: {
      userId: params.userId,
      type: params.type,
      title: params.title,
      body: params.body,
      href: params.href ?? null,
    },
  });
}

export async function listNotifications(userId: string, limit = 20) {
  const [items, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.notification.count({
      where: { userId, readAt: null },
    }),
  ]);

  return {
    items: items.map(
      (n) =>
        ({
          id: n.id,
          type: n.type,
          title: n.title,
          body: n.body,
          href: n.href,
          readAt: n.readAt?.toISOString() ?? null,
          createdAt: n.createdAt.toISOString(),
        }) satisfies NotificationPayload
    ),
    unreadCount,
  };
}

export async function markNotificationRead(userId: string, notificationId: string) {
  await prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { readAt: new Date() },
  });
}

export async function markAllNotificationsRead(userId: string) {
  await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
}

export async function notifyCircleOwnersLifeEngine(
  actorUserId: string,
  actorName: string,
  streak: number
) {
  const owners = await prisma.lifeCircleMember.findMany({
    where: { linkedUserId: actorUserId },
    select: { ownerUserId: true },
  });

  const firstName = actorName.split(" ")[0] ?? actorName;
  const streakLine = streak > 1 ? ` — ${streak}-day streak` : "";

  await Promise.all(
    owners
      .filter((o) => o.ownerUserId !== actorUserId)
      .map((o) =>
        createNotification({
          userId: o.ownerUserId,
          type: "circle_life_engine",
          title: `${firstName} moved life forward`,
          body: `${firstName} completed Life Engine today${streakLine}. Say hello or cheer them on.`,
          href: "/dashboard",
        })
      )
  );
}

export async function notifyReferralJoined(inviterId: string, joinerName: string) {
  const firstName = joinerName.split(" ")[0] ?? "Someone";
  await createNotification({
    userId: inviterId,
    type: "referral_joined",
    title: `${firstName} joined MotiveLife`,
    body: `Your invite worked — you earned +5 bonus voice organizes.`,
    href: "/settings",
    force: true,
  });
}

export async function notifyCircleJoined(ownerId: string, joinerName: string, relationship: string) {
  const firstName = joinerName.split(" ")[0] ?? "Someone";
  const label = relationship === "FAMILY" ? "family member" : "friend";
  await createNotification({
    userId: ownerId,
    type: "circle_joined",
    title: `${firstName} joined your Life Circle`,
    body: `${firstName} is now in your circle as a ${label}.`,
    href: "/dashboard",
  });
}
