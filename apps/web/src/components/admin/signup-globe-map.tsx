"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  Graticule,
  Marker,
  Sphere,
} from "react-simple-maps";
import { Globe2, MapPin, Minus, Plus, RotateCcw } from "lucide-react";
import type { AdminDashboardSnapshot } from "@/lib/admin-analytics";
import { countryDisplayName } from "@/lib/geo/continents";
import { Button } from "@/components/button";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";
const DEFAULT_ROTATE: [number, number, number] = [-20, -20, 0];
const GLOBE_SCALE = 220;
const GLOBE_MIN = 120;
const GLOBE_MAX = 260;

const MAP_ZOOM_MIN = 800;
const MAP_ZOOM_MAX = 600_000;
const MAP_ZOOM_DEFAULT = 12_000;
const INDIVIDUAL_MARKER_ZOOM = 45_000;

type SignupMapData = AdminDashboardSnapshot["signupMap"];
type SignupPoint = SignupMapData["points"][number];
type ViewMode = "globe" | "map";
type Rotate = [number, number, number];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function clampRotate(rotate: Rotate): Rotate {
  return [rotate[0], clamp(rotate[1], -90, 90), rotate[2]];
}

function heatColor(value: number, max: number): string {
  if (max <= 0 || value <= 0) return "rgba(255,255,255,0.04)";
  const t = value / max;
  return `rgba(16, 185, 129, ${0.15 + t * 0.75})`;
}

function pinchDistance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function rotateToCenter(rotate: Rotate): [number, number] {
  return [-rotate[0], -rotate[1]];
}

type CityCluster = {
  key: string;
  city: string;
  region: string | null;
  country: string;
  lat: number;
  lng: number;
  count: number;
};

function clusterByCity(points: SignupPoint[]): CityCluster[] {
  const map = new Map<string, CityCluster & { latSum: number; lngSum: number }>();
  for (const p of points) {
    const city = p.city?.trim() || "Unknown city";
    const key = `${p.country}|${p.region ?? ""}|${city}`;
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
      existing.latSum += p.lat;
      existing.lngSum += p.lng;
      existing.lat = existing.latSum / existing.count;
      existing.lng = existing.lngSum / existing.count;
    } else {
      map.set(key, {
        key,
        city,
        region: p.region ?? null,
        country: p.country,
        lat: p.lat,
        lng: p.lng,
        count: 1,
        latSum: p.lat,
        lngSum: p.lng,
      });
    }
  }
  return [...map.values()];
}

function fitMapView(
  points: SignupPoint[],
  width: number,
  height: number
): { center: [number, number]; zoom: number } {
  if (points.length === 0) {
    return { center: [0, 20], zoom: MAP_ZOOM_DEFAULT };
  }
  if (points.length === 1) {
    return { center: [points[0].lng, points[0].lat], zoom: 90_000 };
  }

  const lngs = points.map((p) => p.lng);
  const lats = points.map((p) => p.lat);
  let minLng = Math.min(...lngs);
  let maxLng = Math.max(...lngs);
  let minLat = Math.min(...lats);
  let maxLat = Math.max(...lats);

  const minSpan = 0.08;
  if (maxLng - minLng < minSpan) {
    const mid = (minLng + maxLng) / 2;
    minLng = mid - minSpan / 2;
    maxLng = mid + minSpan / 2;
  }
  if (maxLat - minLat < minSpan) {
    const mid = (minLat + maxLat) / 2;
    minLat = mid - minSpan / 2;
    maxLat = mid + minSpan / 2;
  }

  const center: [number, number] = [(minLng + maxLng) / 2, (minLat + maxLat) / 2];
  const spanLng = maxLng - minLng;
  const spanLat = maxLat - minLat;
  const cosLat = Math.max(0.2, Math.cos((center[1] * Math.PI) / 180));
  const zoomLng = (width * 0.82) / (spanLng * cosLat);
  const zoomLat = (height * 0.82) / spanLat;
  const zoom = clamp(Math.min(zoomLng, zoomLat), MAP_ZOOM_MIN, MAP_ZOOM_MAX);

  return { center, zoom };
}

function projectPoint(
  lng: number,
  lat: number,
  center: [number, number],
  zoom: number,
  width: number,
  height: number
): [number, number] {
  const x = (lng - center[0]) * zoom + width / 2;
  const y = (center[1] - lat) * zoom + height / 2;
  return [x, y];
}

function clusterRadius(count: number, zoom: number): number {
  const base = clamp(8 + Math.sqrt(count) * 5, 10, 36);
  return clamp(base * (MAP_ZOOM_DEFAULT / zoom), 8, 40);
}

export function SignupGlobeMap({ data }: { data: SignupMapData }) {
  const [continent, setContinent] = useState("all");
  const [country, setCountry] = useState("all");
  const [region, setRegion] = useState("all");
  const [city, setCity] = useState("all");
  const [viewMode, setViewMode] = useState<ViewMode>("globe");

  const [rotate, setRotate] = useState<Rotate>(DEFAULT_ROTATE);
  const [globeScale, setGlobeScale] = useState(GLOBE_SCALE);
  const [mapCenter, setMapCenter] = useState<[number, number]>([0, 20]);
  const [mapZoom, setMapZoom] = useState(MAP_ZOOM_DEFAULT);
  const [dimensions, setDimensions] = useState({ width: 800, height: 480 });
  const [hoveredCluster, setHoveredCluster] = useState<string | null>(null);

  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ x: number; y: number; startRotate?: Rotate; startCenter?: [number, number] } | null>(
    null
  );
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{ distance: number; zoom: number } | null>(null);
  const rafRef = useRef<number | null>(null);
  const pendingGlobeRotate = useRef<Rotate | null>(null);
  const viewModeRef = useRef(viewMode);
  const mapCenterRef = useRef(mapCenter);
  const mapZoomRef = useRef(mapZoom);
  const globeScaleRef = useRef(globeScale);
  const rotateRef = useRef(rotate);

  viewModeRef.current = viewMode;
  mapCenterRef.current = mapCenter;
  mapZoomRef.current = mapZoom;
  globeScaleRef.current = globeScale;
  rotateRef.current = rotate;

  const filteredPoints = useMemo(() => {
    return data.points.filter((p) => {
      if (continent !== "all" && p.continent !== continent) return false;
      if (country !== "all" && p.country !== country) return false;
      if (region !== "all" && (p.region ?? "") !== region) return false;
      if (city !== "all" && (p.city ?? "") !== city) return false;
      return true;
    });
  }, [data.points, continent, country, region, city]);

  const cityClusters = useMemo(() => clusterByCity(filteredPoints), [filteredPoints]);

  const countryCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of filteredPoints) {
      map.set(p.country, (map.get(p.country) ?? 0) + 1);
    }
    return map;
  }, [filteredPoints]);

  const maxCountry = Math.max(...countryCounts.values(), 1);

  const regionOptions = data.filters.regions.filter(
    (r) => country === "all" || r.country === country
  );
  const cityOptions = data.filters.cities.filter(
    (c) =>
      (country === "all" || c.country === country) &&
      (region === "all" || (c.region ?? "") === region)
  );

  const showIndividualMarkers = mapZoom >= INDIVIDUAL_MARKER_ZOOM;

  const focusFilteredPoints = useCallback(() => {
    const fit = fitMapView(filteredPoints, dimensions.width, dimensions.height);
    setMapCenter(fit.center);
    setMapZoom(fit.zoom);
  }, [filteredPoints, dimensions]);

  const resetView = useCallback(() => {
    setViewMode("globe");
    setRotate(DEFAULT_ROTATE);
    setGlobeScale(GLOBE_SCALE);
    focusFilteredPoints();
  }, [focusFilteredPoints]);

  const switchToMap = useCallback(
    (center?: [number, number]) => {
      setViewMode("map");
      if (center) {
        setMapCenter(center);
        setMapZoom(Math.max(mapZoomRef.current, 25_000));
      } else {
        focusFilteredPoints();
      }
    },
    [focusFilteredPoints]
  );

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 800;
      setDimensions({
        width: Math.max(320, Math.round(width)),
        height: Math.max(360, Math.round(width * 0.56)),
      });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (city !== "all" || region !== "all" || country !== "all") {
      setViewMode("map");
      focusFilteredPoints();
    }
  }, [city, region, country, focusFilteredPoints]);

  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const applyGlobeRotate = useCallback((next: Rotate) => {
    pendingGlobeRotate.current = next;
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      if (pendingGlobeRotate.current) setRotate(pendingGlobeRotate.current);
      pendingGlobeRotate.current = null;
      rafRef.current = null;
    });
  }, []);

  const zoomGlobe = useCallback((factor: number) => {
    setGlobeScale((s) => {
      const next = clamp(s * factor, GLOBE_MIN, GLOBE_MAX);
      if (next >= GLOBE_MAX && factor > 1) {
        switchToMap(rotateToCenter(rotate));
      }
      return next;
    });
  }, [rotate, switchToMap]);

  const zoomMap = useCallback((factor: number) => {
    setMapZoom((z) => clamp(z * factor, MAP_ZOOM_MIN, MAP_ZOOM_MAX));
  }, []);

  const zoomBy = useCallback(
    (factor: number) => {
      if (viewModeRef.current === "globe") zoomGlobe(factor);
      else zoomMap(factor);
    },
    [zoomGlobe, zoomMap]
  );

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const factor = Math.exp(-e.deltaY * 0.0015);
      if (viewModeRef.current === "globe") {
        setGlobeScale((s) => {
          const next = clamp(s * factor, GLOBE_MIN, GLOBE_MAX);
          if (next >= GLOBE_MAX - 1 && factor > 1) {
            switchToMap(rotateToCenter(rotateRef.current));
            setMapZoom(20_000);
          }
          return next;
        });
      } else {
        setMapZoom((z) => clamp(z * factor, MAP_ZOOM_MIN, MAP_ZOOM_MAX));
      }
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [switchToMap]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size === 1 && e.button === 0) {
      dragRef.current = {
        x: e.clientX,
        y: e.clientY,
        startRotate: [...rotateRef.current] as Rotate,
        startCenter: [...mapCenterRef.current] as [number, number],
      };
    }

    if (pointersRef.current.size === 2) {
      dragRef.current = null;
      const pts = [...pointersRef.current.values()];
      pinchRef.current = {
        distance: pinchDistance(pts[0], pts[1]),
        zoom: viewModeRef.current === "globe" ? globeScaleRef.current : mapZoomRef.current,
      };
    }

    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!pointersRef.current.has(e.pointerId)) return;
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pointersRef.current.size >= 2 && pinchRef.current) {
        const pts = [...pointersRef.current.values()];
        const distance = pinchDistance(pts[0], pts[1]);
        const ratio = distance / pinchRef.current.distance;
        if (viewModeRef.current === "globe") {
          setGlobeScale(clamp(pinchRef.current.zoom * ratio, GLOBE_MIN, GLOBE_MAX));
        } else {
          setMapZoom(clamp(pinchRef.current.zoom * ratio, MAP_ZOOM_MIN, MAP_ZOOM_MAX));
        }
        return;
      }

      if (!dragRef.current?.startCenter) return;

      const dx = e.clientX - dragRef.current.x;
      const dy = e.clientY - dragRef.current.y;

      if (viewModeRef.current === "globe") {
        if (!dragRef.current.startRotate) return;
        const [r0, r1, r2] = dragRef.current.startRotate;
        applyGlobeRotate(clampRotate([r0 + dx * 0.4, r1 - dy * 0.4, r2]));
      } else {
        const zoom = mapZoomRef.current;
        setMapCenter([
          dragRef.current.startCenter[0] - dx / zoom,
          dragRef.current.startCenter[1] + dy / zoom,
        ]);
      }
    },
    [applyGlobeRotate]
  );

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    pointersRef.current.delete(e.pointerId);
    pinchRef.current = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    if (pointersRef.current.size === 0) {
      dragRef.current = null;
    } else if (pointersRef.current.size === 1) {
      const remaining = [...pointersRef.current.values()][0];
      dragRef.current = {
        x: remaining.x,
        y: remaining.y,
        startRotate: [...rotateRef.current] as Rotate,
        startCenter: [...mapCenterRef.current] as [number, number],
      };
    }
  }, []);

  const onDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      if (viewMode === "globe") {
        if (e.shiftKey) zoomGlobe(1 / 1.3);
        else {
          switchToMap(rotateToCenter(rotate));
          setMapZoom(35_000);
        }
      } else if (e.shiftKey) {
        zoomMap(1 / 1.45);
      } else {
        zoomMap(1.45);
      }
    },
    [viewMode, rotate, switchToMap, zoomGlobe, zoomMap]
  );

  const onClusterClick = useCallback(
    (cluster: CityCluster) => {
      setViewMode("map");
      setMapCenter([cluster.lng, cluster.lat]);
      setMapZoom(Math.max(80_000, mapZoomRef.current));
      setCity(cluster.city);
      if (cluster.region) setRegion(cluster.region);
      setCountry(cluster.country);
    },
    []
  );

  const zoomLabel =
    viewMode === "globe"
      ? `${Math.round(((globeScale - GLOBE_MIN) / (GLOBE_MAX - GLOBE_MIN)) * 100)}%`
      : mapZoom >= 100_000
        ? "City"
        : mapZoom >= 25_000
          ? "Region"
          : "Country";

  return (
    <section className="rounded-xl border border-forward-800 bg-forward-900/60 p-5">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-forward-400">
            Global signup map
          </h2>
          <p className="mt-1 text-sm text-forward-500">
            {filteredPoints.length} signups · {cityClusters.length} cities · switch to City map to
            zoom to clusters · click a city bubble · double-click to zoom in
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex rounded-lg border border-forward-700 bg-forward-950 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("globe")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                viewMode === "globe"
                  ? "bg-forward-800 text-forward-100"
                  : "text-forward-500 hover:text-forward-300"
              }`}
            >
              <Globe2 size={14} />
              Globe
            </button>
            <button
              type="button"
              onClick={() => switchToMap()}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                viewMode === "map"
                  ? "bg-forward-800 text-forward-100"
                  : "text-forward-500 hover:text-forward-300"
              }`}
            >
              <MapPin size={14} />
              City map
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <FilterSelect
              label="Continent"
              value={continent}
              onChange={(v) => {
                setContinent(v);
                setCountry("all");
                setRegion("all");
                setCity("all");
              }}
              options={[
                { value: "all", label: "All continents" },
                ...data.filters.continents.map((c) => ({
                  value: c.value,
                  label: `${c.value} (${c.count})`,
                })),
              ]}
            />
            <FilterSelect
              label="Country"
              value={country}
              onChange={(v) => {
                setCountry(v);
                setRegion("all");
                setCity("all");
              }}
              options={[
                { value: "all", label: "All countries" },
                ...data.filters.countries.map((c) => ({
                  value: c.value,
                  label: `${c.label} (${c.count})`,
                })),
              ]}
            />
            <FilterSelect
              label="Region"
              value={region}
              onChange={(v) => {
                setRegion(v);
                setCity("all");
              }}
              options={[
                { value: "all", label: "All regions" },
                ...regionOptions.map((r) => ({
                  value: r.value,
                  label: `${r.value} (${r.count})`,
                })),
              ]}
            />
            <FilterSelect
              label="City"
              value={city}
              onChange={setCity}
              options={[
                { value: "all", label: "All cities" },
                ...cityOptions.map((c) => ({
                  value: c.value,
                  label: `${c.value} (${c.count})`,
                })),
              ]}
            />
          </div>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-xl border border-forward-800 bg-[#0a1628]">
        <div className="absolute right-3 top-3 z-10 flex flex-col items-end gap-2">
          <div className="rounded-lg border border-forward-800 bg-forward-900/90 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-forward-400">
            {viewMode === "globe" ? "Globe" : "Map"} · {zoomLabel}
          </div>
          <div className="flex flex-col gap-1">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-8 w-8 bg-forward-900/90 p-0"
              onClick={() => zoomBy(1.35)}
              aria-label="Zoom in"
            >
              <Plus size={14} />
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-8 w-8 bg-forward-900/90 p-0"
              onClick={() => zoomBy(1 / 1.35)}
              aria-label="Zoom out"
            >
              <Minus size={14} />
            </Button>
            {viewMode === "map" && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-8 w-8 bg-forward-900/90 p-0"
                onClick={focusFilteredPoints}
                aria-label="Fit filtered signups"
                title="Fit to filtered signups"
              >
                <MapPin size={14} />
              </Button>
            )}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-8 w-8 bg-forward-900/90 p-0"
              onClick={resetView}
              aria-label="Reset view"
            >
              <RotateCcw size={14} />
            </Button>
          </div>
        </div>

        <div
          ref={viewportRef}
          tabIndex={0}
          role="application"
          aria-label="Interactive signup map"
          className="cursor-grab touch-none overscroll-contain outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 active:cursor-grabbing"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onDoubleClick={onDoubleClick}
        >
          {viewMode === "globe" ? (
            <ComposableMap
              projection="geoOrthographic"
              projectionConfig={{ rotate, scale: globeScale }}
              width={dimensions.width}
              height={dimensions.height}
              style={{ width: "100%", height: "auto", display: "block" }}
            >
              <Sphere id="sphere" fill="#0f172a" stroke="#334155" strokeWidth={0.4} />
              <Graticule stroke="#1e293b" strokeWidth={0.35} />
              <Geographies geography={GEO_URL}>
                {({ geographies }: { geographies: import("react-simple-maps").Geography[] }) =>
                  geographies.map((geo) => {
                    const iso = String(
                      (geo.properties as { ISO_A2?: string }).ISO_A2 ?? geo.id ?? ""
                    );
                    const count = iso ? countryCounts.get(iso) ?? 0 : 0;
                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        fill={heatColor(count, maxCountry)}
                        stroke="#334155"
                        strokeWidth={0.25}
                        style={{
                          default: { outline: "none" },
                          hover: { fill: "#34d399", outline: "none", opacity: 0.85 },
                          pressed: { outline: "none" },
                        }}
                      />
                    );
                  })
                }
              </Geographies>
              {cityClusters.map((c) => (
                <Marker key={c.key} coordinates={[c.lng, c.lat]}>
                  <circle
                    r={Math.min(6 + Math.sqrt(c.count) * 2, 14)}
                    fill="#34d399"
                    stroke="#ecfdf5"
                    strokeWidth={1}
                    opacity={0.9}
                  >
                    <title>
                      {c.city} ({c.count}) — {countryDisplayName(c.country)}
                    </title>
                  </circle>
                </Marker>
              ))}
            </ComposableMap>
          ) : (
            <svg
              width={dimensions.width}
              height={dimensions.height}
              viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
              className="block w-full"
              style={{ background: "#0a1628" }}
            >
              <defs>
                <pattern id="signup-map-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path
                    d="M 40 0 L 0 0 0 40"
                    fill="none"
                    stroke="#1e293b"
                    strokeWidth="0.5"
                  />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#signup-map-grid)" opacity={0.35} />

              {showIndividualMarkers
                ? filteredPoints.map((p) => {
                    const [x, y] = projectPoint(
                      p.lng,
                      p.lat,
                      mapCenter,
                      mapZoom,
                      dimensions.width,
                      dimensions.height
                    );
                    if (x < -20 || y < -20 || x > dimensions.width + 20 || y > dimensions.height + 20) {
                      return null;
                    }
                    return (
                      <g key={p.id}>
                        <circle cx={x} cy={y} r={5} fill="#34d399" stroke="#ecfdf5" strokeWidth={1.2}>
                          <title>
                            {[p.city, p.region, countryDisplayName(p.country)].filter(Boolean).join(", ")}
                          </title>
                        </circle>
                      </g>
                    );
                  })
                : cityClusters.map((c) => {
                    const [x, y] = projectPoint(
                      c.lng,
                      c.lat,
                      mapCenter,
                      mapZoom,
                      dimensions.width,
                      dimensions.height
                    );
                    if (x < -60 || y < -60 || x > dimensions.width + 60 || y > dimensions.height + 60) {
                      return null;
                    }
                    const r = clusterRadius(c.count, mapZoom);
                    const active = hoveredCluster === c.key;
                    return (
                      <g
                        key={c.key}
                        transform={`translate(${x}, ${y})`}
                        className="cursor-pointer"
                        onMouseEnter={() => setHoveredCluster(c.key)}
                        onMouseLeave={() => setHoveredCluster(null)}
                        onClick={() => onClusterClick(c)}
                      >
                        <circle
                          r={r}
                          fill={active ? "#6ee7b7" : "#34d399"}
                          fillOpacity={active ? 0.95 : 0.82}
                          stroke="#ecfdf5"
                          strokeWidth={active ? 2 : 1.2}
                        />
                        <text
                          y={4}
                          textAnchor="middle"
                          fill="#042f2e"
                          fontSize={clamp(r * 0.55, 9, 13)}
                          fontWeight={700}
                          pointerEvents="none"
                        >
                          {c.count}
                        </text>
                        {(active || mapZoom >= 20_000) && (
                          <text
                            y={r + 14}
                            textAnchor="middle"
                            fill="#a7f3d0"
                            fontSize={11}
                            fontWeight={600}
                            pointerEvents="none"
                          >
                            {c.city}
                          </text>
                        )}
                        <title>
                          {c.city}
                          {c.region ? `, ${c.region}` : ""}, {countryDisplayName(c.country)} · {c.count}{" "}
                          signup{c.count === 1 ? "" : "s"} · click to focus
                        </title>
                      </g>
                    );
                  })}
            </svg>
          )}
        </div>

        {viewMode === "map" && cityClusters.length > 0 && (
          <div className="border-t border-forward-800 bg-forward-950/80 px-4 py-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-forward-500">
              Cities in view
            </p>
            <div className="flex flex-wrap gap-2">
              {cityClusters.slice(0, 12).map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => onClusterClick(c)}
                  className="rounded-full border border-emerald-900/60 bg-emerald-950/40 px-3 py-1 text-xs text-emerald-200 transition hover:border-emerald-600 hover:bg-emerald-900/40"
                >
                  {c.city} <span className="text-emerald-400">({c.count})</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-forward-500">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-forward-700 bg-forward-950 px-2 py-1.5 text-sm text-forward-100"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
