"use client";

import type { BriefingInsight, LifeNotice } from "@forward/shared";

export function AiBriefingInsights({
  insights,
  briefingInsights,
  notices,
}: {
  insights: string[];
  briefingInsights?: BriefingInsight[];
  notices: LifeNotice[];
}) {
  const structured =
    briefingInsights && briefingInsights.length > 0
      ? briefingInsights
      : insights.slice(0, 3).map((text, i) => ({
          domain: (["Career", "Money", "Health"] as const)[i] ?? "Career",
          text,
        }));

  const fallbackNotices = notices
    .slice(0, Math.max(0, 3 - structured.length))
    .map((n, i) => ({
      domain: (["Career", "Money", "Health"] as const)[structured.length + i] ?? "Insight",
      text: n.text,
    }));

  const items = [...structured, ...fallbackNotices].slice(0, 3);

  if (items.length === 0) return null;

  return (
    <section className="rounded-2xl border border-forward-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-widest text-forward-400">Today&apos;s Brief</p>
      <p className="mt-1 text-sm text-forward-500">Pulled from your calendar, habits, goals, and progress</p>
      <ul className="mt-4 space-y-3">
        {items.map((item, i) => (
          <li
            key={`${item.domain}-${item.text.slice(0, 24)}`}
            className="briefing-insight-enter rounded-xl border border-forward-100 bg-forward-50/80 px-4 py-3"
            style={{ animationDelay: `${i * 120}ms` }}
          >
            <p className="text-[10px] font-bold uppercase tracking-wider text-brand-blue">{item.domain}</p>
            <p className="mt-1 text-sm leading-relaxed text-forward-800">{item.text}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
