"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import type { LifeFeedItem } from "@forward/shared";
import { cn } from "@/lib/utils";

export function LifeFeedPanel({
  items,
  prominent = false,
  maxItems,
}: {
  items: LifeFeedItem[];
  prominent?: boolean;
  maxItems?: number;
}) {
  const shown = maxItems ? items.slice(0, maxItems) : items;
  const count = shown.length;
  const more = items.length - shown.length;

  if (count === 0) return null;

  return (
    <section
      className={cn(
        "rounded-2xl border shadow-sm",
        prominent
          ? "border-brand-cyan/30 bg-gradient-to-br from-forward-950 via-forward-900 to-forward-950 p-5 text-white"
          : "border-forward-200 bg-white p-5"
      )}
    >
      <div className="flex items-start gap-3">
        {prominent ? (
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-cyan/15">
            <Sparkles className="h-4 w-4 text-brand-cyan" />
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "text-xs font-semibold uppercase tracking-widest",
              prominent ? "text-brand-cyan" : "text-forward-400"
            )}
          >
            Life Feed
          </p>
          <p
            className={cn(
              "mt-1 text-sm font-medium",
              prominent ? "text-white" : "text-forward-800"
            )}
          >
            Your AI discovered {count} thing{count === 1 ? "" : "s"} today
            {more > 0 ? ` — ${more} more in Insights` : "."}
          </p>
        </div>
      </div>
      <ul className={cn("mt-4 divide-y", prominent ? "divide-white/10" : "divide-forward-100")}>
        {shown.map((item, i) => {
          const inner = (
            <>
              <span className={cn("mr-2", prominent ? "text-brand-green" : "text-brand-cyan")}>
                →
              </span>
              {item.text}
            </>
          );
          return (
            <li
              key={item.id}
              className="briefing-insight-enter py-3 first:pt-0 last:pb-0"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              {item.href ? (
                <Link
                  href={item.href}
                  className={cn(
                    "block text-sm font-medium hover:underline",
                    prominent
                      ? "text-forward-100 hover:text-brand-cyan"
                      : "text-forward-800 hover:text-brand-blue",
                    item.tone === "positive" && !prominent && "text-forward-900"
                  )}
                >
                  {inner}
                </Link>
              ) : (
                <p className={cn("text-sm font-medium", prominent ? "text-forward-100" : "text-forward-800")}>
                  {inner}
                </p>
              )}
            </li>
          );
        })}
      </ul>
      {prominent && items.length > (maxItems ?? items.length) ? (
        <a
          href="#insights-feed"
          className="mt-3 inline-block text-xs font-semibold text-brand-cyan hover:underline"
        >
          See all discoveries →
        </a>
      ) : null}
    </section>
  );
}
