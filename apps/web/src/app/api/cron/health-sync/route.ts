import { NextRequest } from "next/server";
import { json, unauthorized } from "@/lib/api";
import { syncAllStaleFitbitHealth } from "@/lib/fitbit";

function authorizeCron(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return process.env.NODE_ENV === "development";
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

/** Hourly Fitbit / Google Health pull so Vitalu stays current without a tap. */
export async function GET(req: NextRequest) {
  if (!authorizeCron(req)) return unauthorized();

  const result = await syncAllStaleFitbitHealth({
    minAgeMs: 45 * 60 * 1000,
    limit: 80,
  });
  return json({ ok: true, ...result });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
