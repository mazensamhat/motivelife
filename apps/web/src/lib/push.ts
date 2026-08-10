/**
 * Expo push delivery for lock-screen family alerts (Life360-style).
 * Tokens are registered by the native shell via /api/devices/push-token.
 */

import { prisma } from "@forward/database";
import { ensureFamilyMapSchema } from "@/lib/family-map/ensure-schema";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

export function isFamilyPushType(type: string) {
  return (
    type.startsWith("family_") ||
    type.includes("geofence") ||
    type.includes("road") ||
    type.includes("weather") ||
    type.includes("ping") ||
    type.includes("driving")
  );
}

export async function upsertDevicePushToken(opts: {
  userId: string;
  token: string;
  platform: "ios" | "android";
}) {
  await ensureFamilyMapSchema();
  const token = opts.token.trim();
  if (!token || token.length < 20) return null;

  return prisma.devicePushToken.upsert({
    where: { token },
    create: {
      userId: opts.userId,
      token,
      platform: opts.platform,
    },
    update: {
      userId: opts.userId,
      platform: opts.platform,
      updatedAt: new Date(),
    },
  });
}

export async function removeDevicePushToken(token: string) {
  await ensureFamilyMapSchema();
  await prisma.devicePushToken.deleteMany({ where: { token } });
}

type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  sound?: "default" | null;
  priority?: "default" | "normal" | "high";
  channelId?: string;
};

async function postExpoPush(messages: ExpoPushMessage[]) {
  if (!messages.length) return;
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
      const text = await res.text().catch(() => "");
      console.warn("[push] expo send failed", res.status, text.slice(0, 200));
      return;
    }
    const json = (await res.json().catch(() => null)) as {
      data?: Array<{ status?: string; details?: { error?: string }; message?: string }>;
    } | null;
    const tickets = json?.data ?? [];
    for (let i = 0; i < tickets.length; i++) {
      const ticket = tickets[i];
      if (ticket?.status === "error") {
        const err = ticket.details?.error || ticket.message || "error";
        // Drop dead tokens so we stop retrying.
        if (err === "DeviceNotRegistered" || /not .+ registered/i.test(err)) {
          const bad = messages[i]?.to;
          if (bad) {
            await prisma.devicePushToken.deleteMany({ where: { token: bad } }).catch(() => null);
          }
        }
        // InvalidCredentials = EAS is missing APNs (iOS) or FCM V1 (Android).
        // Keep the token so delivery resumes once credentials are uploaded.
        if (err === "InvalidCredentials") {
          console.warn(
            "[push] InvalidCredentials — upload APNs Auth Key (.p8) and FCM V1 service account on Expo EAS credentials"
          );
        } else {
          console.warn("[push] ticket error", err);
        }
      }
    }
  } catch (error) {
    console.warn("[push] expo send threw", error);
  }
}

/** Send lock-screen push for a notification already written to the DB. */
export async function sendPushForNotification(opts: {
  userId: string;
  type: string;
  title: string;
  body: string;
  href?: string | null;
}) {
  if (!isFamilyPushType(opts.type)) return;

  try {
    await ensureFamilyMapSchema();
  } catch {
    // continue — table may already exist
  }

  let tokens: { token: string }[] = [];
  try {
    tokens = await prisma.devicePushToken.findMany({
      where: { userId: opts.userId },
      select: { token: true },
    });
  } catch (error) {
    console.warn("[push] token lookup failed", error);
    return;
  }
  if (!tokens.length) return;

  // One push per unique token — duplicate DevicePushToken rows were stacking
  // identical "Hamoudi left Home" shade entries at the same second.
  const uniqueTokens = [...new Set(tokens.map((t) => t.token).filter(Boolean))];
  if (!uniqueTokens.length) return;

  // Collapse identical geofence pushes so reinstall/duplicate tokens don't stack
  // two "Hamoudi entered Home" rows in the shade.
  const collapseId = `${opts.type}:${opts.title}`.slice(0, 64);

  const messages: (ExpoPushMessage & { collapseId?: string; tag?: string })[] =
    uniqueTokens.map((token) => ({
      to: token,
      title: opts.title,
      body: opts.body,
      data: {
        href: opts.href || "/family-map",
        url: opts.href || "/family-map",
        type: opts.type,
      },
      sound: "default",
      priority: "high",
      channelId: "family-alerts",
      collapseId,
      // Android notification tag — replaces prior identical alert in the shade.
      tag: collapseId,
    }));

  // Expo recommends batches of ≤100
  for (let i = 0; i < messages.length; i += 90) {
    await postExpoPush(messages.slice(i, i + 90));
  }
}
