import { PLATFORM_PROOF } from "@/lib/marketing-copy";

export function LandingSocialProof() {
  return (
    <section className="border-b border-forward-200 bg-forward-50 py-16 sm:py-20">
      <div className="mx-auto max-w-3xl px-4 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-forward-500">Built for real life</p>
        <h2 className="mt-3 text-2xl font-semibold text-forward-900 sm:text-3xl">
          One system. Every domain. No noise.
        </h2>
      </div>

      <div className="mx-auto mt-10 grid max-w-4xl grid-cols-2 gap-6 px-4 sm:grid-cols-4">
        {PLATFORM_PROOF.map((stat) => (
          <div key={stat.label} className="text-center">
            <p className="text-3xl font-bold text-brand-blue sm:text-4xl">
              {stat.value}
              {stat.suffix}
            </p>
            <p className="mt-1 text-sm text-forward-600">{stat.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
