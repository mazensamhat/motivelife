import { Shield, Lock, Sliders, Eye } from "lucide-react";
import { MARKETING_TRUST_SIGNALS } from "@/lib/marketing-copy";

const ICONS = [Shield, Lock, Sliders, Eye] as const;

export function LandingMarketingPrivacy() {
  return (
    <section id="trust" className="scroll-mt-24 bg-[#070B14] py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#98A5B7]">
          Privacy
        </p>
        <h2 className="mt-3 max-w-2xl font-display text-3xl font-semibold tracking-tight text-[#F7F9FC] sm:text-5xl">
          Your data. Your control.
        </h2>
        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          {MARKETING_TRUST_SIGNALS.map((pillar, i) => {
            const Icon = ICONS[i] ?? Shield;
            return (
              <article key={pillar.title} className="ml-glass rounded-2xl p-6">
                <Icon className="h-6 w-6 text-[#2DD4BF]" aria-hidden />
                <h3 className="mt-4 font-display text-xl font-semibold text-[#F7F9FC]">
                  {pillar.title}
                </h3>
                <p className="mt-2 text-base leading-relaxed text-[#98A5B7]">{pillar.detail}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
