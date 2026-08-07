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

export type PostFamilyLocationResult =
  | { ok: true; state?: FamilyMapState }
  | { ok: false; error: string };

function isFamilyMapState(data: unknown): data is FamilyMapState {
  if (!data || typeof data !== "object") return false;
  const row = data as { household?: unknown; members?: unknown };
  return Boolean(row.household) && Array.isArray(row.members);
}

/**
 * POST a GPS fix to the family map (cookie session).
 * Server may return a light `{ ok, ingested }` ack — full map state is optional
 * (SSE / map poll refresh pins). Callers must tolerate missing `state`.
 */
export async function postFamilyLocationFix(
  fix: FamilyLocationFix
): Promise<PostFamilyLocationResult> {
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
    const data = (await res.json().catch(() => null)) as unknown;
    if (isFamilyMapState(data)) {
      return { ok: true, state: data };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Network error while sharing location." };
  }
}
