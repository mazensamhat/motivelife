/**
 * Grant free MotiveLife Pro (no Stripe).
 * Usage:
 *   node packages/database/scripts/grant-pro.mjs you@example.com
 *   node packages/database/scripts/grant-pro.mjs you@example.com year
 *   node packages/database/scripts/grant-pro.mjs you@example.com month|year|forever
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

function computeProExpiresAt(duration) {
  if (duration === "forever") return null;
  const d = new Date();
  if (duration === "month") d.setMonth(d.getMonth() + 1);
  else d.setFullYear(d.getFullYear() + 1);
  return d;
}

const email = process.argv[2]?.trim().toLowerCase();
const duration = process.argv[3]?.trim().toLowerCase() ?? "forever";

if (!email) {
  console.error("Usage: node packages/database/scripts/grant-pro.mjs <email> [month|year|forever]");
  process.exit(1);
}

if (!["month", "year", "forever"].includes(duration)) {
  console.error("Duration must be month, year, or forever");
  process.exit(1);
}

const prisma = new PrismaClient();
try {
  const user = await prisma.user.update({
    where: { email },
    data: {
      subscriptionPlan: "plus",
      subscriptionStatus: "active",
      proExpiresAt: computeProExpiresAt(duration),
    },
    select: {
      email: true,
      name: true,
      subscriptionPlan: true,
      subscriptionStatus: true,
      proExpiresAt: true,
    },
  });
  console.log("Free Pro granted:", user);
} catch (e) {
  console.error("Failed:", e.message);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
