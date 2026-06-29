/**
 * Grant MotiveLife Pro to a user (no Stripe). Admin/support tool.
 * Usage: node packages/database/scripts/grant-pro.mjs you@example.com
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
if (!email) {
  console.error("Usage: node packages/database/scripts/grant-pro.mjs <email>");
  process.exit(1);
}

const prisma = new PrismaClient();
try {
  const user = await prisma.user.update({
    where: { email },
    data: { subscriptionPlan: "plus", subscriptionStatus: "active" },
    select: { email: true, name: true, subscriptionPlan: true, subscriptionStatus: true },
  });
  console.log("Pro granted:", user);
} catch (e) {
  console.error("Failed:", e.message);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
