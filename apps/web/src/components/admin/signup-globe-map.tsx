"use client";

import { useMemo, useState } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  Graticule,
  Marker,
  Sphere,
} from "react-simple-maps";
import type { AdminDashboardSnapshot } from "@/lib/admin-analytics";
import { countryDisplayName } from "@/lib/geo/continents";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

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

  return (
    <section className="rounded-xl border border-forward-800 bg-forward-900/60 p-5">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-forward-400">
            Global signup map
          </h2>
          <p className="mt-1 text-sm text-forward-500">
            {filteredPoints.length} signups on map · {data.locatedUsers} of {data.totalUsers} users
            geolocated
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

      <div className="overflow-hidden rounded-xl border border-forward-800 bg-[#0a1628]">
        <ComposableMap
          projection="geoOrthographic"
          projectionConfig={{ rotate: [-20, -20, 0], scale: 220 }}
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
