import { FamilyMapPanel } from "@/components/family/family-map-panel";

export default function FamilyMapPage() {
  return (
    <div className="-mx-4 -mt-2 space-y-3 sm:-mx-6 sm:-mt-0">
      <div className="px-4 sm:px-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-blue">
          MyMotiveFamily
        </p>
        <h1 className="mt-0.5 font-display text-2xl font-semibold tracking-tight text-forward-900 sm:text-3xl">
          Family Map
        </h1>
      </div>
      <div className="px-4 sm:px-0">
        <FamilyMapPanel />
      </div>
    </div>
  );
}
