import { Gift, Lock, MapPin, Shield, Sparkles, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { TRUST_POINTS } from "@/lib/marketing-copy";

const ICONS: Record<(typeof TRUST_POINTS)[number]["icon"], LucideIcon> = {
  gift: Gift,
  sparkles: Sparkles,
  shield: Shield,
  lock: Lock,
  map: MapPin,
  users: Users,
};

export function LandingTrustBar() {
  return (
    <section className="border-b border-forward-200 bg-white">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-x-4 gap-y-4 px-4 py-6 sm:grid-cols-3 lg:grid-cols-6">
        {TRUST_POINTS.map((point) => {
          const Icon = ICONS[point.icon];
          return (
            <div
              key={point.label}
              className="flex items-center gap-2.5 text-sm font-medium text-forward-700"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-blue/10 text-brand-blue">
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              <span className="leading-snug">{point.label}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
