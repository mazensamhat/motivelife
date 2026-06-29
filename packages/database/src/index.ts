import { existsSync } from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";

function findRepoRoot(start = process.cwd()): string {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    if (existsSync(path.join(dir, "pnpm-workspace.yaml"))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return start;
}

/** Always use the canonical repo database file — avoids split-brain from relative paths. */
function resolveDatabaseUrl(): string {
  const fromEnv = process.env.DATABASE_URL;

  if (fromEnv?.startsWith("postgresql://") || fromEnv?.startsWith("postgres://")) {
    return fromEnv;
  }

  if (fromEnv?.startsWith("file:")) {
    const filePath = fromEnv.slice(5);
    if (path.isAbsolute(filePath)) {
      return `file:${filePath}`;
    }
  }

  if (process.env.VERCEL || process.env.NODE_ENV === "production") {
    throw new Error(
      "[forward/database] DATABASE_URL must be set to a PostgreSQL connection string in production.",
    );
  }

  const repoRoot = findRepoRoot();
  const dbPath = path.join(repoRoot, "packages", "database", "prisma", "dev.db");

  if (!existsSync(dbPath)) {
    console.warn(`[forward/database] SQLite file not found at ${dbPath}. Run: pnpm db:push`);
  }

  return `file:${dbPath}`;
}

const databaseUrl = resolveDatabaseUrl();
process.env.DATABASE_URL = databaseUrl;

if (process.env.NODE_ENV === "development") {
  console.log("[forward/database] Using", databaseUrl);
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaUrl: string | undefined;
};

// Recreate client if URL changed (e.g. after hot reload with wrong path)
if (globalForPrisma.prisma && globalForPrisma.prismaUrl !== databaseUrl) {
  void globalForPrisma.prisma.$disconnect();
  globalForPrisma.prisma = undefined;
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaUrl = databaseUrl;
}

export * from "@prisma/client";
