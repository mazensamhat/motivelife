#!/usr/bin/env node
/**
 * Enable RLS on every public table (deny PostgREST anon/authenticated by default).
 * Requires DIRECT_URL or DATABASE_URL (direct/session pooler preferred).
 *
 *   DIRECT_URL=... node packages/database/scripts/enable-rls.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";

const url = (process.env.DIRECT_URL || process.env.DATABASE_URL || "").trim();
if (!url) {
  console.error("Set DIRECT_URL or DATABASE_URL");
  process.exit(1);
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sql = readFileSync(join(root, "prisma/enable-rls.sql"), "utf8");

const client = new pg.Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
try {
  await client.query(sql);
  const { rows } = await client.query(`
    SELECT
      count(*)::int AS total,
      count(*) FILTER (WHERE NOT c.relrowsecurity)::int AS still_off
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
  `);
  console.log("RLS enabled:", rows[0]);
  if (rows[0].still_off > 0) process.exit(2);
} finally {
  await client.end();
}
