import type { FamilyMapState } from "@forward/shared";

export type FamilyLocationFix = {
  lat: number;
  lng: number;
  accuracyM?: number | null;
  speedKmh?: number | null;
  headingDeg?: number | null;
  batteryPercent?: number | null;
  recordedAt?: string;
  motionActivity?: "stationary" | "walking" | "driving" | "unknown" | null;
};

/** POST a GPS fix to the family map (cookie session). */
export async function postFamilyLocationFix(
  fix: FamilyLocationFix
): Promise<{ ok: true; state: FamilyMapState } | { ok: false; error: string }> {
  try {
    const res = await fetch("/api/family/location", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(fix),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      return { ok: false, error: data?.error ?? "Could not share location." };
    }
    return { ok: true, state: (await res.json()) as FamilyMapState };
  } catch {
    return { ok: false, error: "Network error while sharing location." };
  }
}
