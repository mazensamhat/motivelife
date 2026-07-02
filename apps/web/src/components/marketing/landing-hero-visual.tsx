import { CheckCircle2, Mic, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const FLOW_STEPS = [
  "Speak your thoughts",
  "AI organizes your day",
  "One clear next action",
] as const;

export function LandingHeroVisual({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "landing-product-frame relative aspect-[9/16] w-full overflow-hidden rounded-2xl border border-white/10 bg-forward-900/90 shadow-2xl sm:aspect-video",
        className
      )}
    >
      <div className="absolute inset-0 landing-hero-glow opacity-60" aria-hidden />
      <div className="relative flex h-full flex-col">
        <div className="border-b border-white/10 px-4 py-3 text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-cyan">
            MotiveLife · Today
          </p>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <div className="relative mb-5">
            <span className="absolute inset-0 animate-ping rounded-full bg-brand-purple/25" />
            <span className="relative flex h-20 w-20 items-center justify-center rounded-full brand-gradient shadow-lg">
              <Mic className="h-9 w-9 text-white" aria-hidden />
            </span>
          </div>
          <p className="text-lg font-semibold leading-snug text-white">
            Voice → plans → briefing → action
          </p>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-forward-300">
            Your AI Chief of Staff turns what you say into goals, tasks, and your daily mission.
          </p>
        </div>

        <ul className="space-y-2 border-t border-white/10 bg-forward-950/70 px-4 py-4">
          {FLOW_STEPS.map((step) => (
            <li key={step} className="flex items-center gap-2 text-left text-xs text-forward-200 sm:text-sm">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-brand-green" aria-hidden />
              {step}
            </li>
          ))}
        </ul>

        <div className="border-t border-white/10 bg-forward-950/90 px-4 py-2.5">
          <p className="flex items-center justify-center gap-1.5 text-[11px] font-medium text-forward-400">
            <Sparkles className="h-3.5 w-3.5 text-brand-cyan" aria-hidden />
            Web app live now · native apps very soon
          </p>
        </div>
      </div>
    </div>
  );
}
