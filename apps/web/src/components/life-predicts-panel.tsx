"use client";

import type { LifePredictItem } from "@forward/shared";
import { LifePredictionEnginePanel } from "./life-prediction-engine-panel";

/** @deprecated Use LifePredictionEnginePanel */
export function LifePredictsPanel({ items }: { items: LifePredictItem[] }) {
  return <LifePredictionEnginePanel items={items} compact />;
}
