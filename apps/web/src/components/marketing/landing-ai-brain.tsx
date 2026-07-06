import { AI_BRAIN_INPUTS } from "@/lib/marketing-copy";
import { Brain } from "lucide-react";

export function LandingAiBrain() {
  return (
    <section id="how-it-works" className="border-b border-forward-200 bg-forward-50 py-20 sm:py-24">
      <div className="mx-auto max-w-3xl px-4 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-blue">The system</p>
        <h2 className="mt-3 text-3xl font-semibold text-forward-900 sm:text-4xl">The AI brain</h2>
        <p className="mt-4 text-lg text-forward-600">
          Your life signals flow in. Clear recommendations flow out. People love understanding how it works.
        </p>
      </div>

      <div className="mx-auto mt-14 max-w-lg px-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {AI_BRAIN_INPUTS.map((input) => (
            <div
              key={input}
              className="rounded-xl border border-forward-200 bg-white px-3 py-2.5 text-center text-sm font-medium text-forward-800"
            >
              {input}
            </div>
          ))}
        </div>

        <div className="flex flex-col items-center py-4 text-brand-blue" aria-hidden>
          <span className="text-2xl">↓</span>
        </div>

        <div className="flex items-center justify-center gap-3 rounded-2xl border border-brand-blue/30 bg-gradient-to-br from-forward-900 to-forward-950 px-6 py-6 text-white shadow-lg">
          <Brain className="h-10 w-10 shrink-0 text-brand-cyan" aria-hidden />
          <div>
            <p className="font-semibold">MotiveLife AI Brain</p>
            <p className="text-sm text-forward-300">Understands context across your whole life</p>
          </div>
        </div>

        <div className="flex flex-col items-center py-4 text-brand-blue" aria-hidden>
          <span className="text-2xl">↓</span>
        </div>

        <div className="space-y-2">
          {["Recommendations", "Predictions", "Your daily mission"].map((out) => (
            <div
              key={out}
              className="rounded-xl border border-brand-green/30 bg-brand-green/5 px-4 py-3 text-center font-medium text-forward-900"
            >
              {out}
            </div>
          ))}
        </div>

        <p className="mt-6 text-center text-lg font-semibold text-forward-800">Life gets easier.</p>
      </div>
    </section>
  );
}
