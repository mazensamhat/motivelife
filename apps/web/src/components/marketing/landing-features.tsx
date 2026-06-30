import {
  BarChart3,
  Compass,
  Flame,
  Mail,
  Mic,
  Sunrise,
  type LucideIcon,
} from "lucide-react";
import { FEATURE_PILLARS } from "@/lib/marketing-copy";

const ICONS: Record<(typeof FEATURE_PILLARS)[number]["icon"], LucideIcon> = {
  sunrise: Sunrise,
  mic: Mic,
  compass: Compass,
  flame: Flame,
  chart: BarChart3,
  mail: Mail,
};

export function LandingFeatures() {
  return (
    <section id="features" className="scroll-mt-20 bg-white py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-medium uppercase tracking-widest text-brand-blue">
            Built for real life
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-forward-900 sm:text-4xl">
            Everything you need to make better decisions — every day
          </h2>
          <p className="mt-4 text-lg text-forward-600">
            Not generic AI advice. MotiveLife knows your goals, tracks your progress, and pushes
            you toward the next right move.
          </p>
        </div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURE_PILLARS.map((feature) => {
            const Icon = ICONS[feature.icon];
            return (
              <article
                key={feature.title}
                className="group rounded-2xl border border-forward-200 bg-forward-50/50 p-6 transition-all hover:border-brand-blue/30 hover:bg-white hover:shadow-md"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl brand-gradient text-white shadow-sm">
                  <Icon className="h-5 w-5" aria-hidden />
                </div>
                <h3 className="mt-5 text-lg font-semibold text-forward-900">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-forward-600">{feature.description}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
