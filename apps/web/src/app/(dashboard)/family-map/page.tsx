import { FamilyMapPanel } from "@/components/family/family-map-panel";

export default function FamilyMapPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-blue">
          MyMotiveFamily
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-forward-900">
          Family Map
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-forward-600 sm:text-base">
          See where everyone is, who’s on the way home, and what’s changing — in one live view.
        </p>
      </div>
      <FamilyMapPanel />
    </div>
  );
}
