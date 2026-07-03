import { NextRequest } from "next/server";
import { json, unauthorized } from "@/lib/api";
import { runDailyRetentionJobs } from "@/lib/retention-jobs";

function authorizeCron(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return process.env.NODE_ENV === "development";
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!authorizeCron(req)) return unauthorized();

  const hourUtc = new Date().getUTCHours();
  const result = await runDailyRetentionJobs(hourUtc);
  return json({ ok: true, hourUtc, ...result });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
