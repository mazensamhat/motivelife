import { haversineKm } from "@forward/shared";

export { haversineKm };

export function bearingDeg(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δλ = toRad(lng2 - lng1);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export function destinationPoint(
  lat: number,
  lng: number,
  bearing: number,
  distanceKm: number
): { lat: number; lng: number } {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const δ = distanceKm / R;
  const θ = toRad(bearing);
  const φ1 = toRad(lat);
  const λ1 = toRad(lng);
  const φ2 = Math.asin(
    Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ)
  );
  const λ2 =
    λ1 +
    Math.atan2(
      Math.sin(θ) * Math.sin(δ) * Math.cos(φ1),
      Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2)
    );
  return { lat: toDeg(φ2), lng: toDeg(λ2) };
}

export function speedKmhBetween(
  lat1: number,
  lng1: number,
  t1: Date,
  lat2: number,
  lng2: number,
  t2: Date
): number {
  const hours = Math.max(1 / 3600, (t2.getTime() - t1.getTime()) / 3_600_000);
  const raw = haversineKm(lat1, lng1, lat2, lng2) / hours;
  // Cap teleport glitches at the source (GPS jumps over short Δt).
  return raw > 200 ? 0 : raw;
}
