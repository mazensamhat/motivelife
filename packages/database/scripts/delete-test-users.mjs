/**
 * Permanently delete test accounts (@motivelife.test).
 * Usage: node packages/database/scripts/delete-test-users.mjs
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

const prisma = new PrismaClient();

try {
  const testUsers = await prisma.user.findMany({
    where: { email: { endsWith: "@motivelife.test" } },
    select: { id: true, email: true, name: true },
  });

  if (testUsers.length === 0) {
    console.log("No @motivelife.test users found.");
    process.exit(0);
  }

  console.log("Deleting test users:");
  for (const u of testUsers) {
    console.log(`  - ${u.email} (${u.name ?? "no name"})`);
  }

  const result = await prisma.user.deleteMany({
    where: { email: { endsWith: "@motivelife.test" } },
  });

  console.log("");
  console.log(`Deleted ${result.count} test user(s).`);
} catch (error) {
  console.error("Failed:", error.message);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
