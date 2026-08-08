/**
 * Global air quality via Open-Meteo (no API key).
 * US AQI for the Americas; European AQI for Europe; US AQI elsewhere as the
 * more common consumer scale. Pollen is included when the model provides it.
 */

export type AirQualityScale = "us" | "european";

export type FamilyAirQuality = {
  /** Index used for display (US or European, based on location). */
  aqi: number;
  scale: AirQualityScale;
  category: string;
  /** Good → hazardous ladder used for UI severity. */
  level: "good" | "moderate" | "unhealthy_sensitive" | "unhealthy" | "very_unhealthy" | "hazardous";
  severity: "info" | "watch" | "warning";
  summary: string;
  pm25: number | null;
  pm10: number | null;
  ozone: number | null;
  nitrogenDioxide: number | null;
  /** Dominant pollen grains/m³ when available (Europe / seasonal). */
  pollenMax: number | null;
  pollenLabel: string | null;
  usAqi: number | null;
  europeanAqi: number | null;
};

export type MemberAirQuality = {
  memberId: string;
  memberName: string;
  lat: number;
  lng: number;
  airQuality: FamilyAirQuality;
};

/** Rough continental preference — not a geocoder. */
export function preferAirQualityScale(lat: number, lng: number): AirQualityScale {
  // Europe + nearby Atlantic fringe
  if (lat >= 34 && lat <= 72 && lng >= -25 && lng <= 45) return "european";
  return "us";
}

function usCategory(aqi: number): {
  category: string;
  level: FamilyAirQuality["level"];
  severity: FamilyAirQuality["severity"];
} {
  if (aqi <= 50) return { category: "Good", level: "good", severity: "info" };
  if (aqi <= 100)
    return { category: "Moderate", level: "moderate", severity: "info" };
  if (aqi <= 150)
    return {
      category: "Unhealthy for sensitive groups",
      level: "unhealthy_sensitive",
      severity: "watch",
    };
  if (aqi <= 200)
    return { category: "Unhealthy", level: "unhealthy", severity: "warning" };
  if (aqi <= 300)
    return {
      category: "Very unhealthy",
      level: "very_unhealthy",
      severity: "warning",
    };
  return { category: "Hazardous", level: "hazardous", severity: "warning" };
}

function europeanCategory(aqi: number): {
  category: string;
  level: FamilyAirQuality["level"];
  severity: FamilyAirQuality["severity"];
} {
  if (aqi < 20) return { category: "Good", level: "good", severity: "info" };
  if (aqi < 40) return { category: "Fair", level: "good", severity: "info" };
  if (aqi < 60)
    return { category: "Moderate", level: "moderate", severity: "info" };
  if (aqi < 80)
    return {
      category: "Poor",
      level: "unhealthy_sensitive",
      severity: "watch",
    };
  if (aqi < 100)
    return { category: "Very poor", level: "unhealthy", severity: "warning" };
  return {
    category: "Extremely poor",
    level: "hazardous",
    severity: "warning",
  };
}

function pickPollen(current: Record<string, number | null | undefined>): {
  pollenMax: number | null;
  pollenLabel: string | null;
} {
  const pairs: Array<[string, string]> = [
    ["ragweed_pollen", "Ragweed"],
    ["grass_pollen", "Grass"],
    ["birch_pollen", "Birch"],
    ["alder_pollen", "Alder"],
    ["mugwort_pollen", "Mugwort"],
    ["olive_pollen", "Olive"],
  ];
  let best: { label: string; value: number } | null = null;
  for (const [key, label] of pairs) {
    const v = current[key];
    if (typeof v === "number" && Number.isFinite(v) && v > 0) {
      if (!best || v > best.value) best = { label, value: v };
    }
  }
  if (!best) return { pollenMax: null, pollenLabel: null };
  return { pollenMax: Math.round(best.value), pollenLabel: best.label };
}

export function isElevatedAirQuality(aq: FamilyAirQuality): boolean {
  return aq.severity === "watch" || aq.severity === "warning";
}

export function airQualityEventTitle(aq: FamilyAirQuality): string {
  if (aq.level === "hazardous" || aq.level === "very_unhealthy") {
    return "Hazardous air";
  }
  if (aq.level === "unhealthy") return "Unhealthy air";
  if (aq.level === "unhealthy_sensitive") return "Sensitive air";
  if (aq.level === "moderate") return "Moderate air";
  return "Air looks fine";
}

export async function fetchAirQualityIntel(
  lat: number,
  lng: number
): Promise<FamilyAirQuality | null> {
  const url = new URL("https://air-quality-api.open-meteo.com/v1/air-quality");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lng));
  url.searchParams.set(
    "current",
    [
      "european_aqi",
      "us_aqi",
      "pm2_5",
      "pm10",
      "ozone",
      "nitrogen_dioxide",
      "alder_pollen",
      "birch_pollen",
      "grass_pollen",
      "mugwort_pollen",
      "olive_pollen",
      "ragweed_pollen",
    ].join(",")
  );
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
    current?: Record<string, number | null | undefined>;
  };
  const c = data.current;
  if (!c) return null;

  const usAqi = typeof c.us_aqi === "number" ? Math.round(c.us_aqi) : null;
  const europeanAqi =
    typeof c.european_aqi === "number" ? Math.round(c.european_aqi) : null;
  const scale = preferAirQualityScale(lat, lng);
  const aqi =
    scale === "european"
      ? (europeanAqi ?? usAqi)
      : (usAqi ?? europeanAqi);
  if (aqi == null) return null;

  const cats =
    scale === "european" ? europeanCategory(aqi) : usCategory(aqi);
  const { pollenMax, pollenLabel } = pickPollen(c);
  const pm25 =
    typeof c.pm2_5 === "number" ? Number(c.pm2_5.toFixed(1)) : null;
  const scaleLabel = scale === "european" ? "EAQI" : "US AQI";
  const pollenBit =
    pollenMax != null && pollenLabel && pollenMax >= 20
      ? ` · ${pollenLabel} pollen ${pollenMax}`
      : "";

  return {
    aqi,
    scale,
    category: cats.category,
    level: cats.level,
    severity: cats.severity,
    summary: `${cats.category} · ${scaleLabel} ${aqi}${pollenBit}`,
    pm25,
    pm10: typeof c.pm10 === "number" ? Number(c.pm10.toFixed(1)) : null,
    ozone: typeof c.ozone === "number" ? Math.round(c.ozone) : null,
    nitrogenDioxide:
      typeof c.nitrogen_dioxide === "number"
        ? Math.round(c.nitrogen_dioxide)
        : null,
    pollenMax,
    pollenLabel,
    usAqi,
    europeanAqi,
  };
}
