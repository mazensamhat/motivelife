#!/usr/bin/env node
/**
 * Dump MotiveLife Postgres (Supabase) to packages/database/backups/.
 * Requires pg_dump on PATH or in a standard PostgreSQL install folder.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(root, ".env");

function loadDirectUrl() {
  if (!existsSync(envPath)) {
    console.error("Missing packages/database/.env with DIRECT_URL");
    process.exit(1);
  }
  const text = readFileSync(envPath, "utf8");
  const match = text.match(/^DIRECT_URL="([^"]+)"/m);
  if (!match) {
    console.error("DIRECT_URL not found in packages/database/.env");
    process.exit(1);
  }
  return match[1];
}

function findPgDump() {
  const fromPath = spawnSync("where", ["pg_dump"], { encoding: "utf8", shell: true });
  if (fromPath.status === 0 && fromPath.stdout.trim()) {
    return fromPath.stdout.trim().split(/\r?\n/)[0];
  }

  const versions = ["17", "16", "15", "14"];
  const roots = [
    process.env["ProgramFiles"],
    process.env["ProgramFiles(x86)"],
  ].filter(Boolean);

  for (const base of roots) {
    for (const ver of versions) {
      const candidate = join(base, "PostgreSQL", ver, "bin", "pg_dump.exe");
      if (existsSync(candidate)) return candidate;
    }
  }

  return null;
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const outDir = join(root, "backups");
const outFile = join(outDir, `motivelife-${stamp}.sql`);

mkdirSync(outDir, { recursive: true });

const dbUrl = loadDirectUrl();
const pgDump = findPgDump();

if (!pgDump) {
  console.error(`
Could not find pg_dump on this machine.

Quick options:
  1. Supabase Dashboard → Project → Database → Backups (daily snapshots on paid plans)
  2. Install PostgreSQL client tools, then re-run:
       cd packages/database && npm run db:backup
     Windows: https://www.postgresql.org/download/windows/ (command line tools only)
  3. Install Docker Desktop, then:
       npx supabase db dump --db-url "<DIRECT_URL>" -f backups/manual.sql
`);
  process.exit(1);
}

console.log(`Using ${pgDump}`);
console.log(`Writing ${outFile}`);

const result = spawnSync(
  pgDump,
  ["--no-owner", "--no-acl", "--clean", "--if-exists", "--dbname", dbUrl],
  { encoding: "buffer", maxBuffer: 256 * 1024 * 1024 }
);

if (result.status !== 0) {
  const err = result.stderr?.toString() || "pg_dump failed";
  console.error(err);
  process.exit(result.status ?? 1);
}

writeFileSync(outFile, result.stdout);

const kb = Math.round(result.stdout.length / 1024);
console.log(`Backup complete (${kb} KB): ${outFile}`);
