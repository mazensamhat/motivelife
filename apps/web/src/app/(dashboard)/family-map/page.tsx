import { FamilyMapPanel } from "@/components/family/family-map-panel";

export default function FamilyMapPage() {
  return (
    <div className="space-y-2 sm:space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <h1 className="font-display text-xl font-semibold tracking-tight text-forward-900 sm:text-3xl">
          Family Map
        </h1>
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-blue sm:text-[11px]">
          MyMotiveFamily
        </p>
      </div>
      {/*
        Do not negative-margin full-bleed the map. Dashboard already pads the page;
        those side gutters let phones scroll past the map without Leaflet stealing
        the gesture.
      */}
      <div className="px-1 sm:px-0">
        <FamilyMapPanel />
      </div>
    </div>
  );
}
