import { TRUST_POINTS } from "@/lib/marketing";

export function LandingTrustBar() {
  return (
    <section className="border-b border-forward-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-8 gap-y-3 px-4 py-5">
        {TRUST_POINTS.map((point) => (
          <span
            key={point}
            className="text-sm font-medium text-forward-600 before:mr-2 before:inline-block before:h-1.5 before:w-1.5 before:rounded-full before:bg-brand-blue before:content-['']"
          >
            {point}
          </span>
        ))}
      </div>
    </section>
  );
}
