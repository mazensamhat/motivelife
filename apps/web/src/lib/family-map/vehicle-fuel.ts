/**
 * Vehicle profile + fuel cost estimates for MyMotiveFamily driving.
 * Make/model → fuel type & economy heuristics (no external API required).
 */

export type FuelType = "gas" | "diesel" | "hybrid" | "ev";

export type VehicleProfileInput = {
  make: string;
  model: string;
  year?: number | null;
  fuelType?: FuelType | null;
  litresPer100km?: number | null;
  kwhPer100km?: number | null;
  fuelPriceCadPerLitre?: number | null;
  evPriceCadPerKwh?: number | null;
};

export type VehicleProfile = {
  make: string;
  model: string;
  year: number | null;
  fuelType: FuelType;
  engineSummary: string;
  litresPer100km: number | null;
  kwhPer100km: number | null;
  fuelPriceCadPerLitre: number;
  evPriceCadPerKwh: number;
};

const DEFAULT_GAS_PRICE = 1.55;
const DEFAULT_EV_PRICE = 0.14;

/** Rough Canadian-market economy estimates by keyword. */
function estimateEconomy(make: string, model: string, year: number | null): {
  fuelType: FuelType;
  litresPer100km: number | null;
  kwhPer100km: number | null;
  engineSummary: string;
} {
  const blob = `${make} ${model}`.toLowerCase();
  const y = year ?? new Date().getFullYear();

  if (/\b(ev|electric|ioniq 5|ioniq 6|model [3ysx]|leaf|bolt|mach-?e|id\.?[34]|niro ev|soul ev)\b/.test(blob)) {
    const kwh = /model [sx]|ioniq 5|mach-?e|id\.?4/.test(blob) ? 20 : 16;
    return {
      fuelType: "ev",
      litresPer100km: null,
      kwhPer100km: kwh,
      engineSummary: `Battery EV · ~${kwh} kWh/100 km`,
    };
  }

  if (/\b(hybrid|prius|insight|rav4 hybrid|camry hybrid|accord hybrid|cr-?v hybrid|sportage hybrid|tucson hybrid|niro)\b/.test(blob)) {
    const l = y >= 2020 ? 5.2 : 5.8;
    return {
      fuelType: "hybrid",
      litresPer100km: l,
      kwhPer100km: null,
      engineSummary: `Hybrid · ~${l.toFixed(1)} L/100 km`,
    };
  }

  if (/\b(diesel|tdi|duramax|powerstroke|cummins)\b/.test(blob)) {
    const l = /\b(f-?250|f-?350|ram 2500|silverado 2500)\b/.test(blob) ? 12.5 : 7.8;
    return {
      fuelType: "diesel",
      litresPer100km: l,
      kwhPer100km: null,
      engineSummary: `Diesel · ~${l.toFixed(1)} L/100 km`,
    };
  }

  if (/\b(f-?150|silverado|sierra|ram 1500|tundra|tacoma|ranger|colorado|canyon)\b/.test(blob)) {
    const l = y >= 2021 ? 11.2 : 13.0;
    return {
      fuelType: "gas",
      litresPer100km: l,
      kwhPer100km: null,
      engineSummary: `Pickup · gasoline · ~${l.toFixed(1)} L/100 km`,
    };
  }

  if (/\b(suv|pilot|highlander|explorer|traverse|pathfinder|4runner|tahoe|yukon|expedition|suburban)\b/.test(blob)) {
    const l = y >= 2020 ? 10.4 : 11.8;
    return {
      fuelType: "gas",
      litresPer100km: l,
      kwhPer100km: null,
      engineSummary: `SUV · gasoline · ~${l.toFixed(1)} L/100 km`,
    };
  }

  if (/\b(civic|corolla|mazda3|elantra|sentra|impreza|golf|jetta|forte|rio)\b/.test(blob)) {
    const l = y >= 2019 ? 6.8 : 7.6;
    return {
      fuelType: "gas",
      litresPer100km: l,
      kwhPer100km: null,
      engineSummary: `Compact · gasoline · ~${l.toFixed(1)} L/100 km`,
    };
  }

  const l = y >= 2020 ? 8.5 : 9.4;
  return {
    fuelType: "gas",
    litresPer100km: l,
    kwhPer100km: null,
    engineSummary: `Gasoline · ~${l.toFixed(1)} L/100 km (estimated)`,
  };
}

export function buildVehicleProfile(input: VehicleProfileInput): VehicleProfile | null {
  const make = input.make.trim();
  const model = input.model.trim();
  if (!make || !model) return null;

  const year =
    input.year != null && input.year >= 1980 && input.year <= new Date().getFullYear() + 1
      ? input.year
      : null;

  const estimated = estimateEconomy(make, model, year);
  const fuelType = input.fuelType ?? estimated.fuelType;
  const litresPer100km =
    fuelType === "ev"
      ? null
      : input.litresPer100km != null && input.litresPer100km > 0
        ? input.litresPer100km
        : estimated.litresPer100km;
  const kwhPer100km =
    fuelType === "ev"
      ? input.kwhPer100km != null && input.kwhPer100km > 0
        ? input.kwhPer100km
        : estimated.kwhPer100km
      : null;

  return {
    make,
    model,
    year,
    fuelType,
    engineSummary:
      fuelType === "ev"
        ? `Battery EV · ~${(kwhPer100km ?? 16).toFixed(0)} kWh/100 km`
        : estimated.engineSummary.replace(/gasoline|diesel|Hybrid/, fuelType === "hybrid" ? "Hybrid" : fuelType === "diesel" ? "Diesel" : "Gasoline"),
    litresPer100km,
    kwhPer100km,
    fuelPriceCadPerLitre: input.fuelPriceCadPerLitre ?? DEFAULT_GAS_PRICE,
    evPriceCadPerKwh: input.evPriceCadPerKwh ?? DEFAULT_EV_PRICE,
  };
}

export function estimateTripFuelCost(opts: {
  distanceKm: number;
  fuelType: FuelType;
  litresPer100km: number | null;
  kwhPer100km: number | null;
  fuelPriceCadPerLitre: number;
  evPriceCadPerKwh: number;
}): { litres: number | null; kwh: number | null; costCad: number | null } {
  if (opts.distanceKm <= 0) return { litres: null, kwh: null, costCad: null };

  if (opts.fuelType === "ev") {
    const rate = opts.kwhPer100km ?? 16;
    const kwh = (opts.distanceKm / 100) * rate;
    return {
      litres: null,
      kwh: Number(kwh.toFixed(2)),
      costCad: Number((kwh * opts.evPriceCadPerKwh).toFixed(2)),
    };
  }

  const rate = opts.litresPer100km ?? 8.5;
  const litres = (opts.distanceKm / 100) * rate;
  return {
    litres: Number(litres.toFixed(2)),
    kwh: null,
    costCad: Number((litres * opts.fuelPriceCadPerLitre).toFixed(2)),
  };
}

export function summarizeFuelTrend(trips: Array<{ estimatedFuelCostCad: number | null; endedAt: Date | null }>) {
  const withCost = trips.filter((t) => t.estimatedFuelCostCad != null && t.endedAt);
  if (withCost.length === 0) {
    return { monthCad: 0, prevMonthCad: 0, direction: "flat" as const, tripCount: 0 };
  }

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const last30 = new Date(now.getTime() - 30 * 24 * 60 * 60_000);

  let monthCad = 0;
  let prevMonthCad = 0;
  let tripCount = 0;
  let recent30Cad = 0;
  let recent30Count = 0;
  for (const t of withCost) {
    const ended = t.endedAt!;
    const cost = t.estimatedFuelCostCad ?? 0;
    if (ended >= monthStart) {
      monthCad += cost;
      tripCount += 1;
    } else if (ended >= prevStart && ended < monthStart) {
      prevMonthCad += cost;
    }
    if (ended >= last30) {
      recent30Cad += cost;
      recent30Count += 1;
    }
  }

  // Calendar month empty but drives in the last 30 days → still show a real number.
  if (tripCount === 0 && recent30Count > 0) {
    monthCad = recent30Cad;
    tripCount = recent30Count;
  }

  const delta = monthCad - prevMonthCad;
  const direction =
    prevMonthCad <= 0 && monthCad <= 0
      ? ("flat" as const)
      : delta > 3
        ? ("up" as const)
        : delta < -3
          ? ("down" as const)
          : ("flat" as const);

  return {
    monthCad: Number(monthCad.toFixed(2)),
    prevMonthCad: Number(prevMonthCad.toFixed(2)),
    direction,
    tripCount,
  };
}
