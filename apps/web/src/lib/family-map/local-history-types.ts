/** On-device Family Map location history (IndexedDB) — not cloud-primary. */

export type LocalHistoryFix = {
  id: string;
  memberId: string;
  lat: number;
  lng: number;
  speedKmh: number | null;
  headingDeg: number | null;
  accuracyM: number | null;
  recordedAt: string; // ISO
};

export type LocalHistoryPathPoint = {
  lat: number;
  lng: number;
  t: string;
  speedKmh: number | null;
};

export type LocalHistoryTrip = {
  id: string;
  memberId: string;
  fromLabel: string;
  toLabel: string;
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  path: LocalHistoryPathPoint[];
  distanceKm: number;
  durationMinutes: number;
  avgSpeedKmh: number;
  maxSpeedKmh: number;
  estimatedFuelLitres: number | null;
  estimatedFuelKwh: number | null;
  estimatedFuelCostCad: number | null;
  driveScore: number;
  startedAt: string;
  endedAt: string;
  /** Active-draft only — last time speed looked like driving. */
  lastMovingAt?: string;
};

export type LocalHistoryRange = "day" | "month" | "year" | "all";
export type LocalHistorySort = "newest" | "oldest" | "longest" | "costliest";

export type VehicleFuelHints = {
  fuelType: "gas" | "diesel" | "hybrid" | "ev" | null;
  litresPer100km: number | null;
  kwhPer100km: number | null;
  fuelPriceCadPerLitre: number | null;
  evPriceCadPerKwh: number | null;
};
