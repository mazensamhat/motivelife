"use client";

import Link from "next/link";
import { Play } from "lucide-react";
import type { HeroBriefing } from "@forward/shared";
import { Button } from "./button";

function formatMinutes(m: number) {
  if (m < 60) return `${m} minutes`;
  const h = Math.floor(m / 60);
  const min = m % 60;
  return min ? `${h} hr ${min} min` : `${h} hour${h > 1 ? "s" : ""}`;
}

export function ChiefStaffHero({ hero }: { hero: HeroBriefing }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-brand-blue/20 bg-gradient-to-br from-forward-950 via-forward-900 to-forward-950 text-white shadow-xl">
      <div className="px-6 py-8 sm:px-8">
        <p className="text-2xl font-semibold sm:text-3xl">{hero.timeGreeting}</p>
        <p className="mt-3 text-lg font-medium text-brand-cyan sm:text-xl">{hero.dynamicOpening}</p>

        <p className="mt-4 text-sm leading-relaxed text-forward-300">{hero.chiefOfStaffLine}</p>

        <div className="mt-6 space-y-2 text-base sm:text-lg">
          <p className="text-forward-200">{hero.dayAssessment}</p>
          {hero.challengeLine && <p className="text-forward-300">{hero.challengeLine}</p>}
          <p className="font-medium text-white">{hero.goodNews}</p>
        </div>

        <div className="mt-8 flex flex-wrap items-end gap-8 border-t border-white/10 pt-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-forward-400">
              Estimated time
            </p>
            <p className="mt-1 text-xl font-semibold">{formatMinutes(hero.estimatedMinutes)}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-forward-400">
              Potential Life Score
            </p>
            <p className="mt-1 text-xl font-semibold text-brand-green">
              +{hero.potentialScoreGain}
            </p>
          </div>
        </div>

        <Link href={hero.startAction.href} className="mt-8 inline-block">
          <Button
            size="lg"
            className="gap-2 bg-brand-green text-forward-950 hover:bg-brand-green/90"
          >
            <Play className="h-4 w-4 fill-current" />
            {hero.startAction.label}
          </Button>
        </Link>
      </div>
    </section>
  );
}
