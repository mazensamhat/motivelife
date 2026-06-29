import { LIFE_MODULES } from "@forward/shared";

export function LandingModules() {
  return (
    <section id="modules" className="scroll-mt-20 bg-forward-950 py-20 text-white sm:py-24">
      <div className="mx-auto max-w-6xl px-4">
        <div className="max-w-2xl">
          <p className="text-sm font-medium uppercase tracking-widest text-brand-cyan">
            Life modules
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            One platform for every part of your life
          </h2>
          <p className="mt-4 text-lg text-forward-300">
            Career, money, health, relationships, habits, and goals — connected in one private
            Life Graph. No more scattered notes and forgotten resolutions.
          </p>
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {LIFE_MODULES.map((mod) => (
            <div
              key={mod.id}
              className="flex items-start gap-4 rounded-xl border border-white/10 bg-white/5 p-5 transition-colors hover:border-brand-cyan/30 hover:bg-white/10"
            >
              <span className="text-2xl" aria-hidden>
                {mod.emoji}
              </span>
              <div>
                <h3 className="font-semibold text-white">{mod.label}</h3>
                <p className="mt-1 text-sm text-forward-400">
                  Goals, tasks, and coaching tailored to your {mod.id.replace("_", " ")} focus.
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
