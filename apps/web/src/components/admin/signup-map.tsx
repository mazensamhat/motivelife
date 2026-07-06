"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import type { AdminDashboardSnapshot } from "@/lib/admin-analytics";
import { countryDisplayName } from "@/lib/geo/continents";

const SignupLeafletMap = dynamic(() => import("@/components/admin/signup-leaflet-map"), {
  ssr: false,
  loading: () => (
    <div
      className="flex items-center justify-center bg-[#0a1628] text-sm text-forward-500"
      style={{ height: 480 }}
    >
      Loading map…
    </div>
  ),
});

type SignupMapData = AdminDashboardSnapshot["signupMap"];

export function SignupMap({ data }: { data: SignupMapData }) {
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

  const cityCounts = useMemo(() => {
    const map = new Map<string, { city: string; country: string; region: string | null; count: number }>();
    for (const p of filteredPoints) {
      const name = p.city?.trim() || "Unknown";
      const key = `${p.country}|${p.region ?? ""}|${name}`;
      const row = map.get(key);
      if (row) row.count += 1;
      else map.set(key, { city: name, country: p.country, region: p.region ?? null, count: 1 });
    }
    return [...map.values()].sort((a, b) => b.count - a.count);
  }, [filteredPoints]);

  const regionOptions = data.filters.regions.filter(
    (r) => country === "all" || r.country === country
  );
  const cityOptions = data.filters.cities.filter(
    (c) =>
      (country === "all" || c.country === country) &&
      (region === "all" || (c.region ?? "") === region)
  );

  const fitKey = `${continent}|${country}|${region}|${city}`;

  return (
    <section className="rounded-xl border border-forward-800 bg-forward-900/60 p-5">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-forward-400">
            Global signup map
          </h2>
          <p className="mt-1 text-sm text-forward-500">
            {filteredPoints.length} signups on map · {data.locatedUsers} of {data.totalUsers}{" "}
            geolocated · scroll to zoom · drag to pan · click markers for details
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

      <div className="overflow-hidden rounded-xl border border-forward-800">
        <div className="w-full" style={{ height: 480 }}>
          <SignupLeafletMap key={fitKey} points={filteredPoints} fitKey={fitKey} />
        </div>

        {cityCounts.length > 0 && (
          <div className="border-t border-forward-800 bg-forward-950/80 px-4 py-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-forward-500">
              Cities ({cityCounts.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {cityCounts.slice(0, 16).map((c) => (
                <button
                  key={`${c.country}|${c.region ?? ""}|${c.city}`}
                  type="button"
                  onClick={() => {
                    setCountry(c.country);
                    setRegion(c.region ?? "all");
                    setCity(c.city);
                  }}
                  className="rounded-full border border-emerald-900/60 bg-emerald-950/40 px-3 py-1 text-xs text-emerald-200 transition hover:border-emerald-600 hover:bg-emerald-900/40"
                >
                  {c.city}{" "}
                  <span className="text-emerald-400">
                    ({c.count}) · {countryDisplayName(c.country)}
                  </span>
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
