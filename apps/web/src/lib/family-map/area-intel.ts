/**
 * Area intelligence for the Family Map — weather at each driver's geolocation,
 * movement-based road feel, and condition alerts. Uses Open-Meteo (no API key).
 * Traffic is inferred from household driving speeds (not a paid crash vendor).
 */

export type AreaAlert = {
  id: string;
  title: string;
  body: string;
  severity: "info" | "watch" | "warning";
  kind: "weather" | "traffic" | "emergency" | "road";
  memberId?: string | null;
  memberName?: string | null;
};

export type MemberWeather = {
  memberId: string;
  memberName: string;
  lat: number;
  lng: number;
  weather: NonNullable<FamilyAreaIntel["weather"]>;
};

export type FamilyAreaIntel = {
  weather: {
    summary: string;
    tempC: number;
    feelsLikeC: number | null;
    windKmh: number;
    precipMm: number;
    code: number;
    severe: boolean;
  } | null;
  /** Weather at each active driver's current coordinates (e.g. Toronto → Windsor). */
  memberWeather: MemberWeather[];
  traffic: {
    level: "clear" | "slow" | "unknown";
    summary: string;
  };
  alerts: AreaAlert[];
  center: { lat: number; lng: number } | null;
  updatedAt: string;
};

const WEATHER_LABELS: Record<number, string> = {
  0: "Clear",
  1: "Mostly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Foggy",
  48: "Icy fog",
  51: "Light drizzle",
  53: "Drizzle",
  55: "Heavy drizzle",
  61: "Light rain",
  63: "Rain",
  65: "Heavy rain",
  71: "Light snow",
  73: "Snow",
  75: "Heavy snow",
  77: "Snow grains",
  80: "Rain showers",
  81: "Rain showers",
  82: "Violent rain showers",
  85: "Snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with hail",
  99: "Severe thunderstorm",
};

function weatherSummary(code: number): string {
  return WEATHER_LABELS[code] ?? "Local conditions";
}

function isSevereWeather(code: number, windKmh: number, precipMm: number): boolean {
  if (code >= 95) return true;
  if (code === 65 || code === 75 || code === 82 || code === 86) return true;
  if (windKmh >= 60) return true;
  if (precipMm >= 8) return true;
  return false;
}

export async function fetchWeatherIntel(
  lat: number,
  lng: number
): Promise<FamilyAreaIntel["weather"]> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lng));
  url.searchParams.set(
    "current",
    "temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m"
  );
  url.searchParams.set("wind_speed_unit", "kmh");
  url.searchParams.set("timezone", "auto");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2500);
  let res: Response;
  try {
    res = await fetch(url.toString(), {
      cache: "no-store",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) return null;

  const data = (await res.json()) as {
    current?: {
      temperature_2m?: number;
      apparent_temperature?: number;
      precipitation?: number;
      weather_code?: number;
      wind_speed_10m?: number;
    };
  };
  const c = data.current;
  if (!c || c.temperature_2m == null || c.weather_code == null) return null;

  const windKmh = c.wind_speed_10m ?? 0;
  const precipMm = c.precipitation ?? 0;
  const code = c.weather_code;
  return {
    summary: weatherSummary(code),
    tempC: Math.round(c.temperature_2m),
    feelsLikeC:
      c.apparent_temperature != null ? Math.round(c.apparent_temperature) : null,
    windKmh: Math.round(windKmh),
    precipMm: Number(precipMm.toFixed(1)),
    code,
    severe: isSevereWeather(code, windKmh, precipMm),
  };
}

export function buildTrafficIntel(
  members: Array<{
    presence: string;
    speedKmh: number | null;
    displayName: string;
  }>
): FamilyAreaIntel["traffic"] {
  const drivers = members.filter(
    (m) => m.presence === "driving" && m.speedKmh != null && m.speedKmh > 5
  );
  if (drivers.length === 0) {
    return {
      level: "unknown",
      summary: "No one actively driving to judge road pace.",
    };
  }

  const avg =
    drivers.reduce((sum, d) => sum + (d.speedKmh ?? 0), 0) / drivers.length;
  const slowCount = drivers.filter((d) => (d.speedKmh ?? 0) < 28).length;

  if (slowCount >= 2 || (drivers.length === 1 && avg < 22)) {
    const names = drivers
      .filter((d) => (d.speedKmh ?? 0) < 28)
      .map((d) => d.displayName)
      .slice(0, 2)
      .join(" & ");
    return {
      level: "slow",
      summary: `Slower movement on the road (${names || "family"} ~${Math.round(avg)} km/h). Could be traffic, a hazard, or road work.`,
    };
  }

  return {
    level: "clear",
    summary: `Family drivers moving ~${Math.round(avg)} km/h — roads look workable from household movement.`,
  };
}

export function buildAreaAlerts(opts: {
  weather: FamilyAreaIntel["weather"];
  memberWeather: MemberWeather[];
  traffic: FamilyAreaIntel["traffic"];
  lowBatteryMembers: string[];
  roadAlerts?: AreaAlert[];
}): AreaAlert[] {
  const alerts: AreaAlert[] = [...(opts.roadAlerts ?? [])];

  for (const mw of opts.memberWeather) {
    if (mw.weather.severe) {
      alerts.push({
        id: `weather-severe-${mw.memberId}`,
        title: `Weather on ${mw.memberName}'s route`,
        body: `${mw.weather.summary} where they are now · ${mw.weather.tempC}°C · wind ${mw.weather.windKmh} km/h. Drive carefully — not an SOS.`,
        severity: mw.weather.code >= 95 ? "warning" : "watch",
        kind: "weather",
        memberId: mw.memberId,
        memberName: mw.memberName,
      });
    } else if (mw.weather.precipMm >= 2) {
      alerts.push({
        id: `weather-wet-${mw.memberId}`,
        title: `Wet roads near ${mw.memberName}`,
        body: `${mw.weather.summary} with ${mw.weather.precipMm} mm precip at their current location.`,
        severity: "info",
        kind: "weather",
        memberId: mw.memberId,
        memberName: mw.memberName,
      });
    }
  }

  // Fallback household-center weather when no drivers
  if (opts.memberWeather.length === 0 && opts.weather?.severe) {
    alerts.push({
      id: "weather-severe",
      title: "Weather attention",
      body: `${opts.weather.summary} · ${opts.weather.tempC}°C · wind ${opts.weather.windKmh} km/h. Drive carefully — not an SOS.`,
      severity: opts.weather.code >= 95 ? "warning" : "watch",
      kind: "weather",
    });
  } else if (opts.memberWeather.length === 0 && opts.weather && opts.weather.precipMm >= 2) {
    alerts.push({
      id: "weather-wet",
      title: "Wet roads",
      body: `${opts.weather.summary} with ${opts.weather.precipMm} mm precip nearby.`,
      severity: "info",
      kind: "weather",
    });
  }

  if (opts.traffic.level === "slow") {
    alerts.push({
      id: "traffic-slow",
      title: "Possible traffic or hazard",
      body: opts.traffic.summary,
      severity: "watch",
      kind: "traffic",
    });
  }

  if (opts.lowBatteryMembers.length > 0) {
    alerts.push({
      id: "battery-low",
      title: "Low battery",
      body: `${opts.lowBatteryMembers.join(", ")} under 15% — may drop off the map soon.`,
      severity: "watch",
      kind: "emergency",
    });
  }

  return alerts;
}

export async function buildFamilyAreaIntel(opts: {
  lat: number | null;
  lng: number | null;
  members: Array<{
    id?: string;
    presence: string;
    speedKmh: number | null;
    displayName: string;
    batteryPercent: number | null;
    lat?: number | null;
    lng?: number | null;
  }>;
}): Promise<FamilyAreaIntel> {
  const center =
    opts.lat != null && opts.lng != null ? { lat: opts.lat, lng: opts.lng } : null;

  let weather: FamilyAreaIntel["weather"] = null;
  if (center) {
    try {
      weather = await fetchWeatherIntel(center.lat, center.lng);
    } catch {
      weather = null;
    }
  }

  // Weather at each driver's live coordinates (cap 4 to stay fast)
  const drivers = opts.members
    .filter(
      (m) =>
        (m.presence === "driving" || m.presence === "moving") &&
        m.lat != null &&
        m.lng != null &&
        m.id
    )
    .slice(0, 4);

  const memberWeather: MemberWeather[] = [];
  await Promise.all(
    drivers.map(async (d) => {
      try {
        const w = await fetchWeatherIntel(d.lat!, d.lng!);
        if (!w || !d.id) return;
        memberWeather.push({
          memberId: d.id,
          memberName: d.displayName,
          lat: d.lat!,
          lng: d.lng!,
          weather: w,
        });
      } catch {
        // skip this driver
      }
    })
  );

  const traffic = buildTrafficIntel(opts.members);
  const lowBatteryMembers = opts.members
    .filter((m) => m.batteryPercent != null && m.batteryPercent < 15)
    .map((m) => m.displayName);

  return {
    weather: memberWeather[0]?.weather ?? weather,
    memberWeather,
    traffic,
    alerts: buildAreaAlerts({ weather, memberWeather, traffic, lowBatteryMembers }),
    center,
    updatedAt: new Date().toISOString(),
  };
}
