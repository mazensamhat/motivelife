/**
 * Expo Push — Life360-style lock-screen alerts for Family Map.
 * Tokens registered from the native shell; sends fire from createNotification.
 */

import { prisma } from "@forward/database";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

export async function upsertPushDeviceToken(opts: {
  userId: string;
  token: string;
  platform: "ios" | "android" | "web";
  appVersion?: string | null;
}) {
  const token = opts.token.trim();
  if (!token) return null;

  return prisma.pushDeviceToken.upsert({
    where: {
      userId_token: { userId: opts.userId, token },
    },
    create: {
      userId: opts.userId,
      token,
      platform: opts.platform,
      appVersion: opts.appVersion ?? null,
      lastSeenAt: new Date(),
    },
    update: {
      platform: opts.platform,
      appVersion: opts.appVersion ?? null,
      lastSeenAt: new Date(),
    },
  });
}

export async function removePushDeviceToken(userId: string, token: string) {
  await prisma.pushDeviceToken.deleteMany({
    where: { userId, token },
  });
}

type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
  priority?: "default" | "normal" | "high";
  channelId?: string;
};

async function sendExpoPush(messages: ExpoPushMessage[]) {
  if (messages.length === 0) return;
  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
    });
    if (!res.ok) {
      console.warn("[push] Expo push failed", res.status, await res.text().catch(() => ""));
    }
  } catch (e) {
    console.warn("[push] Expo push error", e);
  }
}

/** Fire-and-forget push to all of a user's registered devices. */
export async function sendPushToUser(opts: {
  userId: string;
  title: string;
  body: string;
  href?: string | null;
  type?: string;
}) {
  try {
    const tokens = await prisma.pushDeviceToken.findMany({
      where: { userId: opts.userId },
      select: { token: true, platform: true },
    });
    if (tokens.length === 0) return;

    const messages: ExpoPushMessage[] = tokens.map((t) => ({
      to: t.token,
      title: opts.title,
      body: opts.body,
      sound: "default",
      priority: "high",
      channelId: t.platform === "android" ? "family-alerts" : undefined,
      data: {
        href: opts.href ?? "/family-map",
        type: opts.type ?? "family",
      },
    }));

    // Expo accepts batches of 100
    for (let i = 0; i < messages.length; i += 100) {
      void sendExpoPush(messages.slice(i, i + 100));
    }
  } catch (e) {
    console.warn("[push] sendPushToUser failed", e);
  }
}
