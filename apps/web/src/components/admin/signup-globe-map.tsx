"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  Graticule,
  Marker,
  Sphere,
} from "react-simple-maps";
import { Minus, Plus, RotateCcw } from "lucide-react";
import type { AdminDashboardSnapshot } from "@/lib/admin-analytics";
import { countryDisplayName } from "@/lib/geo/continents";
import { Button } from "@/components/button";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";
const DEFAULT_ROTATE: [number, number, number] = [-20, -20, 0];
const DEFAULT_SCALE = 220;
const MIN_SCALE = 120;
const MAX_SCALE = 400;

type SignupMapData = AdminDashboardSnapshot["signupMap"];

function heatColor(value: number, max: number): string {
  if (max <= 0 || value <= 0) return "rgba(255,255,255,0.04)";
  const t = value / max;
  return `rgba(16, 185, 129, ${0.15 + t * 0.75})`;
}

export function SignupGlobeMap({ data }: { data: SignupMapData }) {
  const [continent, setContinent] = useState("all");
  const [country, setCountry] = useState("all");
  const [region, setRegion] = useState("all");
  const [city, setCity] = useState("all");
  const [rotate, setRotate] = useState<[number, number, number]>(DEFAULT_ROTATE);
  const [scale, setScale] = useState(DEFAULT_SCALE);
  const dragRef = useRef<{ x: number; y: number; rotate: [number, number, number] } | null>(null);

  const filteredPoints = useMemo(() => {
    return data.points.filter((p) => {
      if (continent !== "all" && p.continent !== continent) return false;
      if (country !== "all" && p.country !== country) return false;
      if (region !== "all" && (p.region ?? "") !== region) return false;
      if (city !== "all" && (p.city ?? "") !== city) return false;
      return true;
    });
  }, [data.points, continent, country, region, city]);

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

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      dragRef.current = { x: e.clientX, y: e.clientY, rotate: [...rotate] as [number, number, number] };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [rotate]
  );

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.x;
    const dy = e.clientY - dragRef.current.y;
    const [r0, r1, r2] = dragRef.current.rotate;
    setRotate([r0 + dx * 0.35, Math.max(-90, Math.min(90, r1 - dy * 0.35)), r2]);
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    dragRef.current = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
  }, []);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setScale((s) => Math.max(MIN_SCALE, Math.min(MAX_SCALE, s - e.deltaY * 0.25)));
  }, []);

  function resetView() {
    setRotate(DEFAULT_ROTATE);
    setScale(DEFAULT_SCALE);
  }

  return (
    <section className="rounded-xl border border-forward-800 bg-forward-900/60 p-5">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-forward-400">
            Global signup map
          </h2>
          <p className="mt-1 text-sm text-forward-500">
            {filteredPoints.length} signups on map · {data.locatedUsers} of {data.totalUsers} users
            geolocated · drag to spin · scroll to zoom
          </p>
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

      <div className="relative overflow-hidden rounded-xl border border-forward-800 bg-[#0a1628]">
        <div className="absolute right-3 top-3 z-10 flex flex-col gap-1">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-8 w-8 bg-forward-900/90 p-0"
            onClick={() => setScale((s) => Math.min(MAX_SCALE, s + 30))}
            aria-label="Zoom in"
          >
            <Plus size={14} />
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-8 w-8 bg-forward-900/90 p-0"
            onClick={() => setScale((s) => Math.max(MIN_SCALE, s - 30))}
            aria-label="Zoom out"
          >
            <Minus size={14} />
          </Button>
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

        <div
          className="cursor-grab touch-none active:cursor-grabbing"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          onWheel={onWheel}
        >
          <ComposableMap
            projection="geoOrthographic"
            projectionConfig={{ rotate, scale }}
            width={800}
            height={420}
            style={{ width: "100%", height: "auto" }}
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
            {filteredPoints.map((p) => (
              <Marker key={p.id} coordinates={[p.lng, p.lat]}>
                <circle r={4} fill="#34d399" stroke="#ecfdf5" strokeWidth={1} opacity={0.9}>
                  <title>
                    {[p.city, p.region, countryDisplayName(p.country)].filter(Boolean).join(", ")}
                  </title>
                </circle>
              </Marker>
            ))}
          </ComposableMap>
        </div>
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
