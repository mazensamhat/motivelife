import { z } from "zod";
import { getSession } from "@/lib/session";
import { json, unauthorized, badRequest } from "@/lib/api";
import { getHealthIntegrationStatus } from "@/lib/health-connection";
import { upsertHealthMetrics } from "@/lib/health-sync";

const metricSchema = z.object({
  source: z.enum(["health_connect", "apple_health", "fitbit"]),
  metricType: z.enum(["steps", "sleep_minutes", "resting_hr", "active_minutes"]),
  value: z.number(),
  unit: z.string(),
  periodStart: z.string(),
  periodEnd: z.string().optional().nullable(),
  externalId: z.string().optional().nullable(),
});

const bodySchema = z.object({
  metrics: z.array(metricSchema).min(1).max(50),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return unauthorized();

  const body = await request.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid health sync payload.");

  const count = await upsertHealthMetrics(session.id, parsed.data.metrics);
  return json({ ok: true, count });
}

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();

  const status = await getHealthIntegrationStatus(session.id);
  return json(status);
}
