"use client";

import Link from "next/link";
import type { LifeFeedItem } from "@forward/shared";
import { cn } from "@/lib/utils";

export function LifeFeedPanel({ items }: { items: LifeFeedItem[] }) {
  return (
    <section className="rounded-2xl border border-forward-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-widest text-forward-400">
        Life Feed
      </p>
      <p className="mt-1 text-sm text-forward-500">
        Useful discoveries — not notifications.
      </p>
      <ul className="mt-4 divide-y divide-forward-100">
        {items.map((item) => {
          const inner = (
            <>
              <span className="mr-2 text-brand-cyan">→</span>
              {item.text}
            </>
          );
          return (
            <li key={item.id} className="py-3 first:pt-0 last:pb-0">
              {item.href ? (
                <Link
                  href={item.href}
                  className={cn(
                    "block text-sm font-medium text-forward-800 hover:text-brand-blue",
                    item.tone === "positive" && "text-forward-900"
                  )}
                >
                  {inner}
                </Link>
              ) : (
                <p className="text-sm font-medium text-forward-800">{inner}</p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
