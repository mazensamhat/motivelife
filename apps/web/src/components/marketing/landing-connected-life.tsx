import { CONNECTED_LIFE_NODES } from "@/lib/marketing-copy";

export function LandingConnectedLife() {
  return (
    <section id="connected" className="landing-hero-bg py-20 text-white sm:py-24">
      <div className="mx-auto max-w-3xl px-4 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-cyan">The difference</p>
        <h2 className="mt-3 text-3xl font-semibold sm:text-4xl">One AI. Every part of your life.</h2>
        <p className="mt-4 text-lg text-forward-300">
          Calendar, money, health, goals, habits, and relationships — connected in one system. Nobody else
          really does this.
        </p>
      </div>

      <div className="mx-auto mt-14 flex max-w-md flex-col items-center gap-0 px-4">
        {CONNECTED_LIFE_NODES.map((node, index) => (
          <div key={node} className="flex w-full flex-col items-center">
            <div className="w-full rounded-2xl border border-white/15 bg-white/5 px-6 py-4 text-center backdrop-blur-sm">
              <p className="font-semibold tracking-wide">{node}</p>
            </div>
            {index < CONNECTED_LIFE_NODES.length - 1 && (
              <p className="py-1.5 text-brand-cyan/80" aria-hidden>
                ↓
              </p>
            )}
          </div>
        ))}
        <div className="mt-4 w-full rounded-2xl border border-brand-cyan/40 bg-brand-cyan/10 px-6 py-5 text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-brand-cyan">MotiveLife AI</p>
          <p className="mt-1 text-forward-200">Everything connects. One intelligence.</p>
        </div>
      </div>
    </section>
  );
}
