import { FamilyMapPanel } from "@/components/family/family-map-panel";

export default function FamilyMapPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-blue">
          MyMotiveFamily™
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-forward-900">
          Intelligent Family Map
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-forward-600 sm:text-base">
          Live locations, presence, places, Drive Score, and Family Flow — a command center for your
          household. Not roadside. Not insurance. Intelligence.
        </p>
      </div>
      <FamilyMapPanel />
    </div>
  );
}
