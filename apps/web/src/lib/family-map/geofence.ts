/** Geofence math helpers — circle radius or axis-aligned square half-side. */

export type GeofenceShape = "circle" | "square";

export function asGeofenceShape(raw: string | null | undefined): GeofenceShape {
  return raw === "square" ? "square" : "circle";
}

/** Offset a lat/lng by north/east meters (local tangent approx). */
export function offsetLatLngMeters(
  lat: number,
  lng: number,
  northM: number,
  eastM: number
): { lat: number; lng: number } {
  const dLat = northM / 111_320;
  const cos = Math.cos((lat * Math.PI) / 180);
  const dLng = eastM / (111_320 * Math.max(0.2, cos));
  return { lat: lat + dLat, lng: lng + dLng };
}

export function metersNorth(fromLat: number, toLat: number) {
  return (toLat - fromLat) * 111_320;
}

export function metersEast(atLat: number, fromLng: number, toLng: number) {
  const cos = Math.cos((atLat * Math.PI) / 180);
  return (toLng - fromLng) * 111_320 * Math.max(0.2, cos);
}

/** Distance used for “best match” — Euclidean for circle, Chebyshev for square. */
export function geofenceMatchDistanceM(opts: {
  shape: GeofenceShape;
  placeLat: number;
  placeLng: number;
  lat: number;
  lng: number;
}): number {
  const dn = Math.abs(metersNorth(opts.placeLat, opts.lat));
  const de = Math.abs(metersEast(opts.placeLat, opts.placeLng, opts.lng));
  if (opts.shape === "square") return Math.max(dn, de);
  return Math.hypot(dn, de);
}

export function isInsideGeofence(opts: {
  shape: GeofenceShape;
  placeLat: number;
  placeLng: number;
  radiusM: number;
  lat: number;
  lng: number;
}): boolean {
  return (
    geofenceMatchDistanceM({
      shape: opts.shape,
      placeLat: opts.placeLat,
      placeLng: opts.placeLng,
      lat: opts.lat,
      lng: opts.lng,
    }) <= opts.radiusM
  );
}

/** Leaflet rectangle corners for a square geofence (half-side = radiusM). */
export function squareBounds(
  lat: number,
  lng: number,
  halfSideM: number
): [[number, number], [number, number]] {
  const sw = offsetLatLngMeters(lat, lng, -halfSideM, -halfSideM);
  const ne = offsetLatLngMeters(lat, lng, halfSideM, halfSideM);
  return [
    [sw.lat, sw.lng],
    [ne.lat, ne.lng],
  ];
}
