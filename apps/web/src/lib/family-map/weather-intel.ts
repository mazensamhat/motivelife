/**
 * Open-Meteo weather — safe for client + server (no Prisma / Node fs).
 */

import type { FamilyAreaIntel } from "@forward/shared";

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
