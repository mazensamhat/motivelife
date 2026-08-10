/** Geofence math helpers — circle radius or square half-side (optionally rotated). */

export type GeofenceShape = "circle" | "square";

export function asGeofenceShape(raw: string | null | undefined): GeofenceShape {
  return raw === "square" ? "square" : "circle";
}

/** Normalize degrees into [0, 360). */
export function normalizeRotationDeg(deg: number | null | undefined): number {
  if (deg == null || !Number.isFinite(deg)) return 0;
  const n = deg % 360;
  return n < 0 ? n + 360 : n;
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

/**
 * Rotate a local north/east vector by rotationDeg (counter-clockwise).
 * 0° = axis-aligned with map north/east.
 */
export function rotateLocalMeters(
  northM: number,
  eastM: number,
  rotationDeg: number
): { northM: number; eastM: number } {
  const rad = (normalizeRotationDeg(rotationDeg) * Math.PI) / 180;
  if (rad === 0) return { northM, eastM };
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return {
    northM: northM * c - eastM * s,
    eastM: northM * s + eastM * c,
  };
}

/** Local (north,east) of a lat/lng relative to a place center, in the place's rotated frame. */
export function localMetersInPlaceFrame(opts: {
  placeLat: number;
  placeLng: number;
  lat: number;
  lng: number;
  rotationDeg?: number | null;
}): { northM: number; eastM: number } {
  const dn = metersNorth(opts.placeLat, opts.lat);
  const de = metersEast(opts.placeLat, opts.placeLng, opts.lng);
  return rotateLocalMeters(dn, de, -normalizeRotationDeg(opts.rotationDeg));
}

/** Distance used for “best match” — Euclidean for circle, Chebyshev for square. */
export function geofenceMatchDistanceM(opts: {
  shape: GeofenceShape;
  placeLat: number;
  placeLng: number;
  lat: number;
  lng: number;
  rotationDeg?: number | null;
}): number {
  if (opts.shape === "square") {
    const local = localMetersInPlaceFrame(opts);
    return Math.max(Math.abs(local.northM), Math.abs(local.eastM));
  }
  const dn = Math.abs(metersNorth(opts.placeLat, opts.lat));
  const de = Math.abs(metersEast(opts.placeLat, opts.placeLng, opts.lng));
  return Math.hypot(dn, de);
}

export function isInsideGeofence(opts: {
  shape: GeofenceShape;
  placeLat: number;
  placeLng: number;
  radiusM: number;
  lat: number;
  lng: number;
  rotationDeg?: number | null;
}): boolean {
  return (
    geofenceMatchDistanceM({
      shape: opts.shape,
      placeLat: opts.placeLat,
      placeLng: opts.placeLng,
      lat: opts.lat,
      lng: opts.lng,
      rotationDeg: opts.rotationDeg,
    }) <= opts.radiusM
  );
}

/** Leaflet rectangle corners for an axis-aligned square (half-side = radiusM). */
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

/**
 * Four corner lat/lngs for a square geofence, optionally rotated.
 * Order is clockwise starting NE in the place's local frame (after rotation).
 */
export function squarePolygonLatLngs(
  lat: number,
  lng: number,
  halfSideM: number,
  rotationDeg: number | null | undefined = 0
): [number, number][] {
  const rot = normalizeRotationDeg(rotationDeg);
  const corners: Array<[number, number]> = [
    [halfSideM, halfSideM],
    [halfSideM, -halfSideM],
    [-halfSideM, -halfSideM],
    [-halfSideM, halfSideM],
  ];
  return corners.map(([n, e]) => {
    const r = rotateLocalMeters(n, e, rot);
    const p = offsetLatLngMeters(lat, lng, r.northM, r.eastM);
    return [p.lat, p.lng];
  });
}

/** Point on the “east” edge midpoint in the rotated square (resize handle). */
export function squareResizeHandleLatLng(
  lat: number,
  lng: number,
  halfSideM: number,
  rotationDeg: number | null | undefined = 0
): { lat: number; lng: number } {
  const r = rotateLocalMeters(0, halfSideM, normalizeRotationDeg(rotationDeg));
  return offsetLatLngMeters(lat, lng, r.northM, r.eastM);
}

/** NE corner in the rotated square (rotate handle). */
export function squareRotateHandleLatLng(
  lat: number,
  lng: number,
  halfSideM: number,
  rotationDeg: number | null | undefined = 0
): { lat: number; lng: number } {
  const r = rotateLocalMeters(halfSideM, halfSideM, normalizeRotationDeg(rotationDeg));
  return offsetLatLngMeters(lat, lng, r.northM, r.eastM);
}

/** Bearing of a point from center, as map rotation degrees (0 = east, CCW). */
export function rotationDegFromHandle(
  placeLat: number,
  placeLng: number,
  handleLat: number,
  handleLng: number
): number {
  const dn = metersNorth(placeLat, handleLat);
  const de = metersEast(placeLat, placeLng, handleLng);
  // atan2(north, east): 0° = east, 90° = north (CCW) — matches rotateLocalMeters.
  const deg = (Math.atan2(dn, de) * 180) / Math.PI;
  // NE corner of an unrotated square sits at 45° — subtract that so 0° = axis-aligned.
  return normalizeRotationDeg(deg - 45);
}
