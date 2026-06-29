import { prisma } from "@forward/database";
import { hasScope, mergeScopes } from "@/lib/integrations/types";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

export const GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.readonly";
export const GOOGLE_SCOPES = GOOGLE_CALENDAR_SCOPE;

export interface GoogleCalendarEvent {
  title: string;
  start: Date;
  end: Date;
}

export function isGoogleConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function getGoogleRedirectUri() {
  return (
    process.env.GOOGLE_REDIRECT_URI ??
    `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3002"}/api/integrations/google/callback`
  );
}

export function getGoogleAuthUrl(state: string) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: getGoogleRedirectUri(),
    response_type: "code",
    scope: GOOGLE_SCOPES,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export async function exchangeGoogleCode(code: string) {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: getGoogleRedirectUri(),
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) throw new Error("Failed to exchange Google auth code");
  return res.json() as Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope: string;
  }>;
}

export async function refreshGoogleToken(refreshToken: string) {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) throw new Error("Failed to refresh Google token");
  return res.json() as Promise<{ access_token: string; expires_in: number; scope?: string }>;
}

export async function getGoogleAccessToken(userId: string): Promise<string | null> {
  const integration = await prisma.userIntegration.findUnique({
    where: { userId_provider: { userId, provider: "GOOGLE" } },
  });
  if (!integration) return null;

  const now = new Date();
  if (integration.expiresAt && integration.expiresAt > now) {
    return integration.accessToken;
  }

  if (!integration.refreshToken) return integration.accessToken;

  try {
    const tokens = await refreshGoogleToken(integration.refreshToken);
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
    await prisma.userIntegration.update({
      where: { id: integration.id },
      data: {
        accessToken: tokens.access_token,
        expiresAt,
        scope: tokens.scope ? mergeScopes(integration.scope, tokens.scope) : undefined,
      },
    });
    return tokens.access_token;
  } catch {
    return null;
  }
}

export async function fetchGoogleCalendarEvents(
  accessToken: string,
  timeMin: Date,
  timeMax: Date
): Promise<GoogleCalendarEvent[]> {
  const params = new URLSearchParams({
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "20",
  });

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) return [];

  const data = (await res.json()) as {
    items?: {
      summary?: string;
      start?: { dateTime?: string; date?: string };
      end?: { dateTime?: string; date?: string };
    }[];
  };

  return (data.items ?? [])
    .map((item) => {
      const startStr = item.start?.dateTime ?? item.start?.date;
      const endStr = item.end?.dateTime ?? item.end?.date;
      if (!startStr) return null;
      return {
        title: item.summary ?? "Event",
        start: new Date(startStr),
        end: new Date(endStr ?? startStr),
      };
    })
    .filter((e): e is GoogleCalendarEvent => e !== null);
}

export async function getGoogleCalendarEvents(userId: string, days = 1) {
  const integration = await prisma.userIntegration.findUnique({
    where: { userId_provider: { userId, provider: "GOOGLE" } },
  });
  if (!integration || !hasScope(integration.scope, GOOGLE_CALENDAR_SCOPE)) return [];

  const token = await getGoogleAccessToken(userId);
  if (!token) return [];

  const timeMin = new Date();
  timeMin.setHours(0, 0, 0, 0);
  const timeMax = new Date(timeMin);
  timeMax.setDate(timeMax.getDate() + days);

  return fetchGoogleCalendarEvents(token, timeMin, timeMax);
}

/** @deprecated use getGoogleCalendarEvents */
export async function getUserCalendarEvents(userId: string, days = 1) {
  return getGoogleCalendarEvents(userId, days);
}

export function isGoogleCalendarConnected(scope: string | null | undefined) {
  return hasScope(scope, GOOGLE_CALENDAR_SCOPE);
}

export async function saveGoogleTokens(
  userId: string,
  tokens: { access_token: string; refresh_token?: string; expires_in: number; scope: string }
) {
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
  const existing = await prisma.userIntegration.findUnique({
    where: { userId_provider: { userId, provider: "GOOGLE" } },
  });

  let accountEmail = existing?.accountEmail ?? undefined;
  try {
    const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (profileRes.ok) {
      const profile = (await profileRes.json()) as { email?: string };
      accountEmail = profile.email ?? accountEmail;
    }
  } catch {
    /* optional */
  }

  await prisma.userIntegration.upsert({
    where: { userId_provider: { userId, provider: "GOOGLE" } },
    create: {
      userId,
      provider: "GOOGLE",
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt,
      scope: tokens.scope,
      accountEmail,
      accountLabel: accountEmail,
    },
    update: {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? existing?.refreshToken ?? undefined,
      expiresAt,
      scope: mergeScopes(existing?.scope, tokens.scope),
      accountEmail: accountEmail ?? existing?.accountEmail ?? undefined,
      accountLabel: accountEmail ?? existing?.accountLabel ?? undefined,
    },
  });
}
