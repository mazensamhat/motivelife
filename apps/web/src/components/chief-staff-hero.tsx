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
    <section className="overflow-hidden rounded-2xl border border-forward-200 bg-white shadow-sm">
      <div className="px-6 py-8 sm:px-8">
        <p className="text-2xl font-semibold text-forward-900 sm:text-3xl">{hero.timeGreeting}</p>
        <p className="mt-2 text-sm font-medium text-brand-blue">Today matters.</p>
        <p className="mt-3 text-base leading-relaxed text-forward-600 sm:text-lg">
          {hero.chiefOfStaffLine}
        </p>

        <div className="mt-6 rounded-xl border border-forward-100 bg-forward-50 px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-blue">
            Today has one priority
          </p>
          <p className="mt-2 text-xl font-semibold text-forward-900 sm:text-2xl">{hero.dayAssessment}</p>
          {hero.challengeLine ? (
            <p className="mt-2 text-sm text-forward-600">{hero.challengeLine}</p>
          ) : null}
          <p className="mt-3 text-sm font-medium text-brand-green">{hero.goodNews}</p>
        </div>

        <p className="mt-4 text-sm text-forward-500">{hero.dynamicOpening}</p>

        <div className="mt-8 flex flex-wrap items-end gap-8 border-t border-forward-100 pt-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-forward-500">
              Estimated time
            </p>
            <p className="mt-1 text-xl font-semibold text-forward-900">
              {formatMinutes(hero.estimatedMinutes)}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-forward-500">
              Potential Life Score
            </p>
            <p className="mt-1 text-xl font-semibold text-brand-green">
              +{hero.potentialScoreGain}
            </p>
          </div>
        </div>

        <Link href={hero.startAction.href} className="mt-8 inline-block">
          <Button size="lg" className="gap-2">
            <Play className="h-4 w-4 fill-current" />
            {hero.startAction.label}
          </Button>
        </Link>
        {hero.closingLine ? (
          <p className="mt-5 text-sm italic text-forward-500">{hero.closingLine}</p>
        ) : null}
      </div>
    </section>
  );
}
