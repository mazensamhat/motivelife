import { prisma } from "@forward/database";
import { mergeScopes } from "@/lib/integrations/types";
import { upsertHealthMetrics, type HealthMetricInput } from "@/lib/health-sync";

const FITBIT_AUTH_URL = "https://www.fitbit.com/oauth2/authorize";
const FITBIT_TOKEN_URL = "https://api.fitbit.com/oauth2/token";
const FITBIT_SCOPES = "activity heartrate sleep profile";

export function isFitbitConfigured() {
  return Boolean(process.env.FITBIT_CLIENT_ID && process.env.FITBIT_CLIENT_SECRET);
}

export function getFitbitRedirectUri() {
  return (
    process.env.FITBIT_REDIRECT_URI ??
    `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3002"}/api/integrations/fitbit/callback`
  );
}

export function getFitbitAuthUrl(state: string) {
  const params = new URLSearchParams({
    client_id: process.env.FITBIT_CLIENT_ID!,
    response_type: "code",
    scope: FITBIT_SCOPES,
    redirect_uri: getFitbitRedirectUri(),
    expires_in: "604800",
    state,
  });
  return `${FITBIT_AUTH_URL}?${params.toString()}`;
}

function fitbitBasicAuth() {
  const id = process.env.FITBIT_CLIENT_ID!;
  const secret = process.env.FITBIT_CLIENT_SECRET!;
  return `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`;
}

export async function exchangeFitbitCode(code: string) {
  const res = await fetch(FITBIT_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: fitbitBasicAuth(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: process.env.FITBIT_CLIENT_ID!,
      grant_type: "authorization_code",
      redirect_uri: getFitbitRedirectUri(),
      code,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error("[fitbit] token exchange failed:", res.status, body);
    throw new Error(`token_exchange:${res.status}`);
  }

  return res.json() as Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
    scope: string;
    user_id: string;
  }>;
}

export async function refreshFitbitToken(refreshToken: string) {
  const res = await fetch(FITBIT_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: fitbitBasicAuth(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) throw new Error("Failed to refresh Fitbit token");
  return res.json() as Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope?: string;
    user_id?: string;
  }>;
}

export async function getFitbitAccessToken(userId: string): Promise<{
  token: string;
  fitbitUserId: string;
} | null> {
  const integration = await prisma.userIntegration.findUnique({
    where: { userId_provider: { userId, provider: "FITBIT" } },
  });
  if (!integration) return null;

  let metadata: { fitbitUserId?: string } = {};
  try {
    if (integration.metadata) metadata = JSON.parse(integration.metadata);
  } catch {
    /* ignore */
  }

  const now = new Date();
  if (integration.expiresAt && integration.expiresAt > now) {
    return {
      token: integration.accessToken,
      fitbitUserId: metadata.fitbitUserId ?? integration.accountLabel ?? "-",
    };
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
      metadata: JSON.stringify({
        ...metadata,
        fitbitUserId: tokens.user_id ?? metadata.fitbitUserId,
      }),
    },
  });

  return {
    token: tokens.access_token,
    fitbitUserId: tokens.user_id ?? metadata.fitbitUserId ?? "-",
  };
}

export async function saveFitbitTokens(
  userId: string,
  tokens: {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    scope: string;
    user_id: string;
  }
) {
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
  await prisma.userIntegration.upsert({
    where: { userId_provider: { userId, provider: "FITBIT" } },
    create: {
      userId,
      provider: "FITBIT",
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt,
      scope: tokens.scope,
      accountLabel: tokens.user_id,
      metadata: JSON.stringify({ fitbitUserId: tokens.user_id }),
    },
    update: {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt,
      scope: mergeScopes(undefined, tokens.scope),
      accountLabel: tokens.user_id,
      metadata: JSON.stringify({ fitbitUserId: tokens.user_id }),
    },
  });
}

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

export async function syncFitbitHealth(userId: string) {
  const session = await getFitbitAccessToken(userId);
  if (!session) throw new Error("Fitbit not connected.");

  const date = todayDateString();
  const headers = { Authorization: `Bearer ${session.token}` };
  const base = `https://api.fitbit.com/1/user/${session.fitbitUserId}`;

  const [activityRes, sleepRes] = await Promise.all([
    fetch(`${base}/activities/date/${date}.json`, { headers }),
    fetch(`https://api.fitbit.com/1.2/user/${session.fitbitUserId}/sleep/date/${date}.json`, {
      headers,
    }),
  ]);

  const metrics: HealthMetricInput[] = [];
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);

  if (activityRes.ok) {
    const activity = (await activityRes.json()) as {
      summary?: {
        steps?: number;
        lightlyActiveMinutes?: number;
        fairlyActiveMinutes?: number;
        veryActiveMinutes?: number;
        restingHeartRate?: number;
      };
    };
    const s = activity.summary;
    if (s?.steps != null) {
      metrics.push({
        source: "fitbit",
        metricType: "steps",
        value: s.steps,
        unit: "steps",
        periodStart: dayStart.toISOString(),
        externalId: `steps-${date}`,
      });
    }
    const active =
      (s?.lightlyActiveMinutes ?? 0) +
      (s?.fairlyActiveMinutes ?? 0) +
      (s?.veryActiveMinutes ?? 0);
    if (active > 0) {
      metrics.push({
        source: "fitbit",
        metricType: "active_minutes",
        value: active,
        unit: "minutes",
        periodStart: dayStart.toISOString(),
        externalId: `active-${date}`,
      });
    }
    if (s?.restingHeartRate != null) {
      metrics.push({
        source: "fitbit",
        metricType: "resting_hr",
        value: s.restingHeartRate,
        unit: "bpm",
        periodStart: dayStart.toISOString(),
        externalId: `rhr-${date}`,
      });
    }
  }

  if (sleepRes.ok) {
    const sleep = (await sleepRes.json()) as {
      sleep?: { minutesAsleep?: number; dateOfSleep?: string }[];
    };
    const main = sleep.sleep?.[0];
    if (main?.minutesAsleep != null) {
      metrics.push({
        source: "fitbit",
        metricType: "sleep_minutes",
        value: main.minutesAsleep,
        unit: "minutes",
        periodStart: dayStart.toISOString(),
        externalId: `sleep-${date}`,
      });
    }
  }

  if (metrics.length === 0) {
    throw new Error("Fitbit returned no health data for today yet.");
  }

  const count = await upsertHealthMetrics(userId, metrics);

  await prisma.userIntegration.update({
    where: { userId_provider: { userId, provider: "FITBIT" } },
    data: {
      metadata: JSON.stringify({
        fitbitUserId: session.fitbitUserId,
        lastSyncAt: new Date().toISOString(),
      }),
    },
  });

  return { count, metrics };
}
