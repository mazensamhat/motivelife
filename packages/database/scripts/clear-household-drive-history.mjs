/**
 * Wipe Family Map drive telematics for a household so they can start clean.
 * Keeps the household, members, places, and place visits.
 *
 * Usage:
 *   node packages/database/scripts/clear-household-drive-history.mjs you@example.com
 *   node packages/database/scripts/clear-household-drive-history.mjs you@example.com --keep-events
 */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(scriptDir, "../.env");

if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

const email = process.argv[2]?.trim().toLowerCase();
const keepEvents = process.argv.includes("--keep-events");

if (!email) {
  console.error(
    "Usage: node packages/database/scripts/clear-household-drive-history.mjs <ownerEmail> [--keep-events]"
  );
  process.exit(1);
}

const prisma = new PrismaClient();
try {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true },
  });
  if (!user) {
    console.error("No user for", email);
    process.exit(1);
  }

  const member = await prisma.familyMember.findFirst({
    where: { userId: user.id, isSimulated: false },
    orderBy: { updatedAt: "desc" },
    select: { id: true, householdId: true, displayName: true },
  });
  if (!member) {
    console.error("User has no household membership.");
    process.exit(1);
  }

  const members = await prisma.familyMember.findMany({
    where: { householdId: member.householdId },
    select: { id: true, userId: true, displayName: true },
  });
  const memberIds = members.map((m) => m.id);
  const userIds = members.map((m) => m.userId).filter(Boolean);

  const trips = await prisma.familyTrip.deleteMany({
    where: { memberId: { in: memberIds } },
  });

  let events = { count: 0 };
  if (!keepEvents) {
    events = await prisma.familyLocationEvent.deleteMany({
      where: { memberId: { in: memberIds } },
    });
  }

  let notifications = { count: 0 };
  if (userIds.length) {
    notifications = await prisma.notification.deleteMany({
      where: {
        userId: { in: userIds },
        type: { in: ["family_road_alert", "family_trip_ended"] },
      },
    });
  }

  console.log("Cleared drive history for household of", user.email, {
    householdId: member.householdId,
    members: members.map((m) => m.displayName),
    tripsDeleted: trips.count,
    locationEventsDeleted: events.count,
    driveNotificationsDeleted: notifications.count,
    placeVisitsKept: true,
  });
} finally {
  await prisma.$disconnect();
}
