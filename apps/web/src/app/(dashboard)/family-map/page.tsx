import { FamilyMapPanel } from "@/components/family/family-map-panel";

export default function FamilyMapPage() {
  return (
    <div className="-mx-4 -mt-1 space-y-2 sm:-mx-6 sm:-mt-0 sm:space-y-3">
      <div className="flex items-baseline justify-between gap-2 px-4 sm:px-0">
        <h1 className="font-display text-xl font-semibold tracking-tight text-forward-900 sm:text-3xl">
          Family Map
        </h1>
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-blue sm:text-[11px]">
          MyMotiveFamily
        </p>
      </div>
      <div className="px-4 sm:px-0">
        <FamilyMapPanel />
      </div>
    </div>
  );
}
