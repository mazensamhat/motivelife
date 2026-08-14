"use client";

import Link from "next/link";
import { LIFE_MODULES } from "@forward/shared";
import { Card, CardHeading } from "./card";

const SUBTITLES: Record<string, string> = {
  career: "Jobs, resume, interviews",
  money: "Bills, cashflow, savings",
  health: "Sleep, fitness, wearables",
  learning: "Skills and growth",
  relationships: "People who matter",
  family: "Your family intelligence",
  habits: "Daily discipline",
  goals: "Your goals, elevated",
};

export function MyLifeHub({ activeModules }: { activeModules?: string[] }) {
  const modules = LIFE_MODULES.filter(
    (m) => !activeModules?.length || activeModules.includes(m.id)
  );

  return (
    <div className="space-y-6">
      <div>
        <CardHeading>LifeVue</CardHeading>
        <p className="mt-1 text-sm text-forward-500">
          Your life in one view — open what you need, when you need it.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {modules.map((m) => (
          <Link key={m.id} href={m.href}>
            <Card className="h-full p-5 transition hover:border-brand-blue/30 hover:shadow-md">
              <div className="flex items-start gap-3">
                <span className="text-2xl" aria-hidden>
                  {m.emoji}
                </span>
                <div>
                  <p className="font-semibold text-forward-900">{m.label.replace(" Module", "")}</p>
                  <p className="mt-1 text-sm text-forward-500">{SUBTITLES[m.id] ?? "Your life area"}</p>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      <Card className="border-dashed p-5">
        <p className="text-sm font-medium text-forward-800">Deep intelligence</p>
        <p className="mt-1 text-sm text-forward-500">
          Life Graph, AI Memory, predictions, and weekly reviews live in{" "}
          <Link href="/memory" className="text-brand-blue hover:underline">
            Intelligence
          </Link>
          .
        </p>
      </Card>
    </div>
  );
}
