import { LIFE_SCALE_STEPS } from "@/lib/marketing-copy";

export function LandingLifeScale() {
  return (
    <section id="story" className="border-b border-forward-200 bg-white py-20 sm:py-24">
      <div className="mx-auto max-w-3xl px-4 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-blue">How it scales</p>
        <h2 className="mt-3 text-3xl font-semibold text-forward-900 sm:text-4xl">
          From today&apos;s decision to your life&apos;s direction
        </h2>
        <p className="mt-4 text-lg text-forward-600">
          MotiveLife doesn&apos;t stop at a to-do list. It connects daily actions to long-term outcomes.
        </p>
      </div>

      <div className="mx-auto mt-14 flex max-w-lg flex-col items-center px-4">
        {LIFE_SCALE_STEPS.map((step, index) => (
          <div key={step.label} className="flex w-full flex-col items-center">
            <div className="w-full rounded-2xl border border-forward-200 bg-forward-50 px-6 py-5 text-center shadow-sm">
              <p className="text-lg font-semibold text-forward-900">{step.label}</p>
              <p className="mt-1 text-sm leading-relaxed text-forward-600">{step.detail}</p>
            </div>
            {index < LIFE_SCALE_STEPS.length - 1 && (
              <div className="flex flex-col items-center py-2 text-brand-blue" aria-hidden>
                <span className="h-6 w-px bg-brand-blue/40" />
                <span className="text-lg leading-none">↓</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
