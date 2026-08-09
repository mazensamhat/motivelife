import { NextRequest } from "next/server";
import { json, unauthorized } from "@/lib/api";
import { notifyWeeklyDrivingReportsReady } from "@/lib/family-map/driving-report";

function authorizeCron(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return process.env.NODE_ENV === "development";
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

/** Monday morning — notify households that last week's driving report is ready. */
export async function GET(req: NextRequest) {
  if (!authorizeCron(req)) return unauthorized();

  const result = await notifyWeeklyDrivingReportsReady();
  return json({ ok: true, ...result });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
