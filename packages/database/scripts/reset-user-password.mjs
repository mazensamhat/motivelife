/**
 * Set a temporary password for a user (local admin tool).
 *
 * Usage:
 *   node packages/database/scripts/reset-user-password.mjs you@example.com
 *   node packages/database/scripts/reset-user-password.mjs you@example.com YourTempPass123
 *
 * Uses DATABASE_URL from packages/database/.env (same Supabase as production when URLs match).
 */
import { randomBytes } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(scriptDir, "../.env");

function loadDatabaseEnv() {
  if (!existsSync(envPath)) {
    console.error(`Missing ${envPath}`);
    console.error("Copy packages/database/.env.example and add your Supabase URLs.");
    process.exit(1);
  }

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

loadDatabaseEnv();

const dbUrl = process.env.DATABASE_URL ?? "";
if (!dbUrl.startsWith("postgresql://") && !dbUrl.startsWith("postgres://")) {
  console.error("DATABASE_URL in packages/database/.env must start with postgresql://");
  console.error("Check for typos, missing quotes, or square brackets around the password.");
  process.exit(1);
}

const require = createRequire(import.meta.url);
const bcrypt = require(path.join(scriptDir, "../../../apps/web/node_modules/bcryptjs"));

const email = process.argv[2]?.trim().toLowerCase();
const customPassword = process.argv[3]?.trim();

if (!email) {
  console.error("Usage: node packages/database/scripts/reset-user-password.mjs <email> [password]");
  process.exit(1);
}

const tempPassword = customPassword || randomBytes(9).toString("base64url").slice(0, 12);

const prisma = new PrismaClient();

try {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true },
  });

  if (!user) {
    console.error(`No user found for ${email}`);
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(tempPassword, 12);

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });

  try {
    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
  } catch {
    // Table may not exist until password-reset migration is deployed
  }

  console.log("");
  console.log("Temporary password set successfully.");
  console.log("");
  console.log(`  Email:    ${user.email}`);
  console.log(`  Name:     ${user.name ?? "(none)"}`);
  console.log(`  Password: ${tempPassword}`);
  console.log("");
  console.log("Sign in at https://www.mymotivelife.com/login");
  console.log("Change it later via Forgot password (once email is configured) or ask to add Settings → change password.");
  console.log("");
} catch (error) {
  console.error("Failed:", error.message);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
