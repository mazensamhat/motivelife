import { prisma } from "@forward/database";
import { mergeScopes } from "@/lib/integrations/types";
import { upsertHealthMetrics, type HealthMetricInput } from "@/lib/health-sync";
import { getCalendarTimeZone } from "@/lib/calendar-timezone";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const HEALTH_API_BASE = "https://health.googleapis.com/v4";

export const GOOGLE_HEALTH_SCOPES = [
  "https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly",
  "https://www.googleapis.com/auth/googlehealth.sleep.readonly",
  "https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly",
  "https://www.googleapis.com/auth/googlehealth.profile.readonly",
].join(" ");

function healthClientId() {
  return process.env.FITBIT_CLIENT_ID ?? process.env.GOOGLE_CLIENT_ID;
}

function healthClientSecret() {
  return process.env.FITBIT_CLIENT_SECRET ?? process.env.GOOGLE_CLIENT_SECRET;
}

export function isFitbitConfigured() {
  return Boolean(healthClientId() && healthClientSecret());
}

export function getFitbitRedirectUri() {
  return (
    process.env.FITBIT_REDIRECT_URI ??
    `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3002"}/api/integrations/fitbit/callback`
  );
}

/** Fitbit wearables now authorize through Google Health API (Google OAuth). */
export function getFitbitAuthUrl(state: string) {
  const params = new URLSearchParams({
    client_id: healthClientId()!,
    redirect_uri: getFitbitRedirectUri(),
    response_type: "code",
    scope: GOOGLE_HEALTH_SCOPES,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export async function exchangeFitbitCode(code: string) {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: healthClientId()!,
      client_secret: healthClientSecret()!,
      redirect_uri: getFitbitRedirectUri(),
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error("[google-health] token exchange failed:", res.status, body);
    throw new Error(`token_exchange:${res.status}`);
  }

  return res.json() as Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope: string;
  }>;
}

export async function refreshFitbitToken(refreshToken: string) {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: healthClientId()!,
      client_secret: healthClientSecret()!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) throw new Error("Failed to refresh Google Health token");
  return res.json() as Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope?: string;
  }>;
}

type HealthIdentity = {
  legacyUserId?: string;
  healthUserId?: string;
};

async function fetchHealthIdentity(accessToken: string): Promise<HealthIdentity> {
  const res = await fetch(`${HEALTH_API_BASE}/users/me/identity`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });
  if (!res.ok) {
    const body = await res.text();
    console.error("[google-health] identity failed:", res.status, body);
    return {};
  }
  return res.json() as Promise<HealthIdentity>;
}

export async function getFitbitAccessToken(userId: string): Promise<string | null> {
  const integration = await prisma.userIntegration.findUnique({
    where: { userId_provider: { userId, provider: "FITBIT" } },
  });
  if (!integration) return null;

  const now = new Date();
  if (integration.expiresAt && integration.expiresAt > now) {
    return integration.accessToken;
  }

  if (!integration.refreshToken) return null;

  const tokens = await refreshFitbitToken(integration.refreshToken);
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
  await prisma.userIntegration.update({
    where: { id: integration.id },
    data: {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? integration.refreshToken,
      expiresAt,
      scope: tokens.scope ? mergeScopes(integration.scope, tokens.scope) : undefined,
    },
  });

  return tokens.access_token;
}

export async function saveFitbitTokens(
  userId: string,
  tokens: {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope: string;
  }
) {
  const identity = await fetchHealthIdentity(tokens.access_token);
  const accountLabel = identity.legacyUserId ?? identity.healthUserId ?? "google-health";
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

  await prisma.userIntegration.upsert({
    where: { userId_provider: { userId, provider: "FITBIT" } },
    create: {
      userId,
      provider: "FITBIT",
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? "",
      expiresAt,
      scope: tokens.scope,
      accountLabel,
      metadata: JSON.stringify({
        oauthType: "google_health",
        legacyUserId: identity.legacyUserId,
        healthUserId: identity.healthUserId,
      }),
    },
    update: {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? undefined,
      expiresAt,
      scope: mergeScopes(undefined, tokens.scope),
      accountLabel,
      metadata: JSON.stringify({
        oauthType: "google_health",
        legacyUserId: identity.legacyUserId,
        healthUserId: identity.healthUserId,
      }),
    },
  });
}

function civilDateParts(date = new Date()) {
  const tz = getCalendarTimeZone();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  const day = Number(parts.find((p) => p.type === "day")?.value);
  return { year, month, day, tz };
}

function civilDayRange() {
  const { year, month, day } = civilDateParts();
  const time = { hours: 0, minutes: 0, seconds: 0, nanos: 0 };
  return {
    start: { date: { year, month, day }, time },
    end: {
      date: { year, month, day },
      time: { hours: 23, minutes: 59, seconds: 59, nanos: 0 },
    },
  };
}

function yesterdayIsoDate() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const { year, month, day } = civilDateParts(d);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

async function healthGet(token: string, path: string) {
  return fetch(`${HEALTH_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
}

async function healthPost(token: string, path: string, body: unknown) {
  return fetch(`${HEALTH_API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

async function dailyRollUpValue(
  token: string,
  dataType: string,
  extract: (point: Record<string, unknown>) => number | null
): Promise<number | null> {
  const res = await healthPost(
    token,
    `/users/me/dataTypes/${dataType}/dataPoints:dailyRollUp`,
    { range: civilDayRange(), windowSizeDays: 1 }
  );
  if (!res.ok) return null;
  const data = (await res.json()) as { rollupDataPoints?: Record<string, unknown>[] };
  const point = data.rollupDataPoints?.[0];
  if (!point) return null;
  return extract(point);
}

export async function syncFitbitHealth(userId: string) {
  const token = await getFitbitAccessToken(userId);
  if (!token) throw new Error("Fitbit not connected.");

  const { year, month, day } = civilDateParts();
  const dateKey = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);

  const metrics: HealthMetricInput[] = [];

  const [steps, activeMinutes] = await Promise.all([
    dailyRollUpValue(token, "steps", (point) => {
      const bucket = point.steps as { countSum?: string } | undefined;
      const n = Number(bucket?.countSum);
      return Number.isFinite(n) ? n : null;
    }),
    dailyRollUpValue(token, "active-minutes", (point) => {
      const bucket = point.activeMinutes as { minutesSum?: string; countSum?: string } | undefined;
      const n = Number(bucket?.minutesSum ?? bucket?.countSum);
      return Number.isFinite(n) ? n : null;
    }),
  ]);

  if (steps != null) {
    metrics.push({
      source: "fitbit",
      metricType: "steps",
      value: steps,
      unit: "steps",
      periodStart: dayStart.toISOString(),
      externalId: `steps-${dateKey}`,
    });
  }

  if (activeMinutes != null) {
    metrics.push({
      source: "fitbit",
      metricType: "active_minutes",
      value: activeMinutes,
      unit: "minutes",
      periodStart: dayStart.toISOString(),
      externalId: `active-${dateKey}`,
    });
  }

  const rhrRes = await healthGet(
    token,
    `/users/me/dataTypes/daily-resting-heart-rate/dataPoints?filter=daily_resting_heart_rate.civil_start_time.date.year=${year} AND daily_resting_heart_rate.civil_start_time.date.month=${month} AND daily_resting_heart_rate.civil_start_time.date.day=${day}`
  );
  if (rhrRes.ok) {
    const rhrData = (await rhrRes.json()) as {
      dataPoints?: { dailyRestingHeartRate?: { beatsPerMinute?: number } }[];
    };
    const bpm = rhrData.dataPoints?.[0]?.dailyRestingHeartRate?.beatsPerMinute;
    if (bpm != null) {
      metrics.push({
        source: "fitbit",
        metricType: "resting_hr",
        value: bpm,
        unit: "bpm",
        periodStart: dayStart.toISOString(),
        externalId: `rhr-${dateKey}`,
      });
    }
  }

  const sleepFilter = encodeURIComponent(
    `sleep.interval.civil_end_time >= "${yesterdayIsoDate()}"`
  );
  const sleepRes = await healthGet(
    token,
    `/users/me/dataTypes/sleep/dataPoints:reconcile?dataSourceFamily=users/me/dataSourceFamilies/google-wearables&filter=${sleepFilter}`
  );
  if (sleepRes.ok) {
    const sleepData = (await sleepRes.json()) as {
      dataPoints?: {
        sleep?: { summary?: { minutesAsleep?: string }; metadata?: { main?: boolean } };
      }[];
    };
    const sessions = sleepData.dataPoints ?? [];
    const main =
      sessions.find((s) => s.sleep?.metadata?.main) ??
      sessions.sort(
        (a, b) =>
          Number(b.sleep?.summary?.minutesAsleep ?? 0) -
          Number(a.sleep?.summary?.minutesAsleep ?? 0)
      )[0];
    const minutesAsleep = Number(main?.sleep?.summary?.minutesAsleep);
    if (Number.isFinite(minutesAsleep) && minutesAsleep > 0) {
      metrics.push({
        source: "fitbit",
        metricType: "sleep_minutes",
        value: minutesAsleep,
        unit: "minutes",
        periodStart: dayStart.toISOString(),
        externalId: `sleep-${dateKey}`,
      });
    }
  }

  if (metrics.length === 0) {
    throw new Error("No Fitbit/Google Health data for today yet. Sync your tracker in the Fitbit app first.");
  }

  const count = await upsertHealthMetrics(userId, metrics);

  const integration = await prisma.userIntegration.findUnique({
    where: { userId_provider: { userId, provider: "FITBIT" } },
  });
  let metadata: Record<string, unknown> = { oauthType: "google_health" };
  if (integration?.metadata) {
    try {
      metadata = { ...metadata, ...JSON.parse(integration.metadata) };
    } catch {
      /* ignore */
    }
  }

  await prisma.userIntegration.update({
    where: { userId_provider: { userId, provider: "FITBIT" } },
    data: {
      metadata: JSON.stringify({ ...metadata, lastSyncAt: new Date().toISOString() }),
    },
  });

  return { count, metrics };
}
