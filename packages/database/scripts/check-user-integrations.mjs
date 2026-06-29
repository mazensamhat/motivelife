/**
 * Read-only check: subscription + Google integration for a user.
 * Usage: node packages/database/scripts/check-user-integrations.mjs [email]
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

const email = (process.argv[2] ?? "samhatmazen@gmail.com").trim().toLowerCase();
const prisma = new PrismaClient();

try {
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      name: true,
      subscriptionPlan: true,
      subscriptionStatus: true,
      trialEndsAt: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
      integrations: {
        where: { provider: "GOOGLE" },
        select: {
          provider: true,
          accountEmail: true,
          scope: true,
          expiresAt: true,
          updatedAt: true,
        },
      },
    },
  });

  if (!user) {
    console.log(`No user found: ${email}`);
    process.exit(1);
  }

  const google = user.integrations[0];
  const hasCalendarScope =
    google?.scope?.includes("calendar") || google?.scope?.includes("calendar.readonly");

  console.log(JSON.stringify({
    email: user.email,
    name: user.name,
    subscription: {
      plan: user.subscriptionPlan,
      status: user.subscriptionStatus,
      trialEndsAt: user.trialEndsAt?.toISOString() ?? null,
      stripeCustomerId: user.stripeCustomerId ? `${user.stripeCustomerId.slice(0, 12)}...` : null,
      stripeSubscriptionId: user.stripeSubscriptionId ? `${user.stripeSubscriptionId.slice(0, 12)}...` : null,
      proActive:
        user.subscriptionPlan === "plus" &&
        !["cancelled", "past_due"].includes(user.subscriptionStatus),
    },
    google: {
      connected: Boolean(google && hasCalendarScope),
      accountEmail: google?.accountEmail ?? null,
      scope: google?.scope ?? null,
      tokenExpiresAt: google?.expiresAt?.toISOString() ?? null,
      lastUpdated: google?.updatedAt?.toISOString() ?? null,
    },
  }, null, 2));
} finally {
  await prisma.$disconnect();
}
