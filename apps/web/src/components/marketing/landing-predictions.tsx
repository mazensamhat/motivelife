import { PREDICTION_EXAMPLES } from "@/lib/marketing-copy";
import { cn } from "@/lib/utils";

const TONE_STYLES = {
  warning: "border-amber-300/50 bg-amber-50 text-amber-950",
  positive: "border-brand-green/40 bg-emerald-50 text-forward-900",
  neutral: "border-brand-blue/30 bg-forward-50 text-forward-900",
} as const;

export function LandingPredictions() {
  return (
    <section id="predictions" className="bg-white py-20 sm:py-24">
      <div className="mx-auto max-w-3xl px-4 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-blue">Life Prediction Engine</p>
        <h2 className="mt-3 text-3xl font-semibold text-forward-900 sm:text-4xl">
          This doesn&apos;t feel like software. It feels intelligent.
        </h2>
        <p className="mt-4 text-lg text-forward-600">
          MotiveLife predicts what&apos;s coming — savings slips, burnout, missed bills, late arrivals — before
          they hit.
        </p>
      </div>

      <div className="mx-auto mt-12 grid max-w-4xl gap-4 px-4 sm:grid-cols-2">
        {PREDICTION_EXAMPLES.map((card) => (
          <div
            key={card.text.slice(0, 40)}
            className={cn(
              "rounded-2xl border px-5 py-4 text-sm leading-relaxed shadow-sm",
              TONE_STYLES[card.tone]
            )}
          >
            {card.text}
          </div>
        ))}
      </div>
    </section>
  );
}
