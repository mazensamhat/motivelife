import Link from "next/link";
import {
  DIGITAL_TWIN_MISSION,
  DIGITAL_TWIN_ONE_SENTENCE,
  DIGITAL_TWIN_PRODUCT_LINE,
  SIX_AI_ENGINES,
  TWIN_ACCURACY_LADDER,
  TWIN_ONBOARDING_PHASES,
} from "@/lib/digital-twin";

export function LandingDigitalTwin() {
  return (
    <section id="digital-twin" className="border-y border-forward-200 bg-white py-20">
      <div className="mx-auto max-w-6xl px-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-cyan">
          The Digital Twin
        </p>
        <h2 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight text-forward-900 sm:text-4xl">
          You&apos;re not creating an account.
          <span className="mt-2 block text-brand-blue">You&apos;re creating your Digital Twin.</span>
        </h2>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-forward-600">
          {DIGITAL_TWIN_ONE_SENTENCE}
        </p>
        <p className="mt-3 max-w-2xl text-base text-forward-500">{DIGITAL_TWIN_MISSION}</p>

        <div className="mt-10 rounded-2xl border border-forward-200 bg-forward-50/80 p-6 sm:p-8">
          <p className="text-sm font-semibold text-forward-900">{DIGITAL_TWIN_PRODUCT_LINE}</p>
          <p className="mt-2 text-sm text-forward-600">
            As information increases, predictions improve — so you always know why you&apos;re answering.
          </p>
          <div className="mt-6 flex flex-wrap items-end gap-2 sm:gap-3">
            {TWIN_ACCURACY_LADDER.map((pct, i) => (
              <div key={pct} className="flex items-end gap-2 sm:gap-3">
                <div className="flex flex-col items-center">
                  <span className="text-2xl font-bold tabular-nums text-forward-900 sm:text-3xl">
                    {pct}%
                  </span>
                  <span className="mt-1 text-[10px] uppercase tracking-wide text-forward-400">
                    accuracy
                  </span>
                </div>
                {i < TWIN_ACCURACY_LADDER.length - 1 ? (
                  <span className="mb-3 text-forward-300" aria-hidden>
                    →
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TWIN_ONBOARDING_PHASES.map((phase, index) => (
            <div key={phase.id} className="border-l-2 border-brand-cyan/50 pl-4">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-forward-400">
                Phase {index + 1}
              </p>
              <p className="mt-1 text-sm font-semibold text-forward-900">{phase.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-forward-500">{phase.detail}</p>
            </div>
          ))}
        </div>

        <div className="mt-16">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-cyan">
            The Six AI Engines
          </p>
          <h3 className="mt-2 text-2xl font-semibold text-forward-900">
            One Twin. Six engines that never stop learning.
          </h3>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {SIX_AI_ENGINES.map((engine) => (
              <div key={engine.id}>
                <p className="text-sm font-semibold text-forward-900">{engine.name}</p>
                <p className="mt-1 text-sm leading-relaxed text-forward-500">{engine.detail}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12">
          <Link
            href="/register"
            className="inline-flex text-sm font-semibold text-brand-blue underline-offset-4 hover:underline"
          >
            Start building your Digital Twin →
          </Link>
        </div>
      </div>
    </section>
  );
}
