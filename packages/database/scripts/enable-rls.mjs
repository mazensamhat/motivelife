#!/usr/bin/env node
/**
 * Enable RLS on every public table (deny PostgREST anon/authenticated by default).
 *
 *   cd packages/database
 *   DIRECT_URL=... npx prisma db execute --file prisma/enable-rls.sql --schema prisma/schema.prisma
 *
 * Or from repo root after setting DATABASE_URL / DIRECT_URL in packages/database/.env:
 *   pnpm --filter @forward/database exec prisma db execute --file prisma/enable-rls.sql
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const file = join(root, "prisma/enable-rls.sql");
const schema = join(root, "prisma/schema.prisma");

const result = spawnSync(
  "npx",
  ["prisma", "db", "execute", "--file", file, "--schema", schema],
  { cwd: root, stdio: "inherit", env: process.env, shell: true }
);
process.exit(result.status ?? 1);
