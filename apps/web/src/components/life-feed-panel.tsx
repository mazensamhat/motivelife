"use client";

import Link from "next/link";
import type { LifeFeedItem } from "@forward/shared";
import { cn } from "@/lib/utils";
import { PRODUCT_SUITE } from "@/lib/product-suite";
import { SignalsIcon } from "./product-icons";

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
          ? "border-brand-cyan/25 bg-gradient-to-br from-brand-cyan/5 via-white to-forward-50 p-5"
          : "border-forward-200 bg-white p-5"
      )}
    >
      <div className="flex items-start gap-3">
        {prominent ? (
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-cyan/10">
            <SignalsIcon className="h-5 w-5" color={PRODUCT_SUITE.signals.primary} />
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "text-xs font-semibold uppercase tracking-widest",
              prominent ? "text-brand-blue" : "text-forward-400"
            )}
          >
            Signals
          </p>
          <p
            className={cn(
              "mt-1 text-sm font-medium",
              prominent ? "text-forward-800" : "text-forward-800"
            )}
          >
            Your AI discovered {count} thing{count === 1 ? "" : "s"} today
            {more > 0 ? ` — ${more} more below` : " — what matters next"}
          </p>
        </div>
      </div>
      <ul className={cn("mt-4 divide-y", prominent ? "divide-forward-100" : "divide-forward-100")}>
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
                      ? "text-forward-800 hover:text-brand-blue"
                      : "text-forward-800 hover:text-brand-blue",
                    item.tone === "positive" && !prominent && "text-forward-900"
                  )}
                >
                  {inner}
                </Link>
              ) : (
                <p className="text-sm font-medium text-forward-800">
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
          className="mt-3 inline-block text-xs font-semibold text-brand-blue hover:underline"
        >
          See all discoveries →
        </a>
      ) : null}
    </section>
  );
}
