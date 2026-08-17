/** Payload uploaded from native shells to POST /api/health/sync */

export type PhoneHealthMetricPayload = {
  source: "health_connect" | "apple_health";
  metricType: "steps" | "sleep_minutes" | "resting_hr" | "active_minutes";
  value: number;
  unit: string;
  periodStart: string;
  periodEnd: string;
  externalId: string;
};

export type PhoneHealthNativeResult =
  | { ok: true; metrics: PhoneHealthMetricPayload[] }
  | { ok: false; error: string };
