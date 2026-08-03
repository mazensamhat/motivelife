"use client";

import { useMemo } from "react";
import type { LocalHistoryPathPoint } from "@/lib/family-map/local-history-types";

/**
 * Tiny route preview (Life360-style trip card map) — SVG polyline, no Leaflet weight.
 */
export function TripRouteThumb({
  path,
  start,
  end,
  className = "",
}: {
  path?: LocalHistoryPathPoint[] | null;
  start?: { lat: number; lng: number } | null;
  end?: { lat: number; lng: number } | null;
  className?: string;
}) {
  const pts = useMemo(() => {
    if (path && path.length >= 2) {
      return path.map((p) => ({ lat: p.lat, lng: p.lng }));
    }
    if (
      start &&
      end &&
      Number.isFinite(start.lat) &&
      Number.isFinite(end.lat) &&
      (start.lat !== 0 || end.lat !== 0)
    ) {
      return [start, end];
    }
    return [];
  }, [path, start, end]);

  const geom = useMemo(() => {
    if (pts.length < 2) return null;
    let minLat = pts[0]!.lat;
    let maxLat = pts[0]!.lat;
    let minLng = pts[0]!.lng;
    let maxLng = pts[0]!.lng;
    for (const p of pts) {
      minLat = Math.min(minLat, p.lat);
      maxLat = Math.max(maxLat, p.lat);
      minLng = Math.min(minLng, p.lng);
      maxLng = Math.max(maxLng, p.lng);
    }
    const pad = 0.00035;
    minLat -= pad;
    maxLat += pad;
    minLng -= pad;
    maxLng += pad;
    const w = 280;
    const h = 120;
    const dx = Math.max(maxLng - minLng, 1e-6);
    const dy = Math.max(maxLat - minLat, 1e-6);
    const project = (lat: number, lng: number) => {
      const x = ((lng - minLng) / dx) * (w - 16) + 8;
      const y = ((maxLat - lat) / dy) * (h - 16) + 8;
      return { x, y };
    };
    const projected = pts.map((p) => project(p.lat, p.lng));
    const d = projected
      .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(" ");
    const a = projected[0]!;
    const b = projected[projected.length - 1]!;
    return { w, h, d, a, b };
  }, [pts]);

  if (!geom) {
    return (
      <div
        className={`flex h-16 items-center justify-center rounded-lg bg-[#e8eef5] text-[11px] text-forward-500 ${className}`}
      >
        Route preview when GPS path is available
      </div>
    );
  }

  return (
    <div
      className={`h-16 overflow-hidden rounded-lg border border-forward-100 bg-[#e8eef5] ${className}`}
    >
      <svg viewBox={`0 0 ${geom.w} ${geom.h}`} className="h-full w-full" aria-hidden>
        <rect width={geom.w} height={geom.h} fill="#e8eef5" />
        <path
          d={geom.d}
          fill="none"
          stroke="#0284c7"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx={geom.a.x} cy={geom.a.y} r="5" fill="#0f172a" stroke="#fff" strokeWidth="2" />
        <circle cx={geom.b.x} cy={geom.b.y} r="5" fill="#0284c7" stroke="#fff" strokeWidth="2" />
      </svg>
    </div>
  );
}
