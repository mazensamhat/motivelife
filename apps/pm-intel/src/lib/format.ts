import type { HealthLabel, TemperatureReading } from "./types";

export function pillClass(label: HealthLabel | string): string {
  if (label === "Healthy") return "health-healthy";
  if (label === "Watch") return "health-watch";
  if (label === "At Risk") return "health-atrisk";
  return "temp-unknown";
}

export function tempClass(label: TemperatureReading["label"] | string): string {
  if (label === "Hot") return "temp-hot";
  if (label === "Warm") return "temp-warm";
  if (label === "Mixed") return "temp-mixed";
  if (label === "Cool") return "temp-cool";
  if (label === "Cold") return "temp-cold";
  return "temp-unknown";
}

export function formatPct(n: number): string {
  return `${Math.round(n)}%`;
}

export function slugPm(name: string): string {
  return `pm-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}
