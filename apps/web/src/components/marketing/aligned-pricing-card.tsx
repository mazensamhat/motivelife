import type { ReactNode } from "react";
import { Check } from "lucide-react";

/**
 * Identical row tracks on every card so Pro / Family / Member line up
 * on homepage and /family (same component, same FAMILY_PLANS data).
 */
const CARD_ROWS =
  "grid-rows-[1.25rem_1.25rem_2.5rem_2.5rem_minmax(16rem,1fr)_3rem]";

export function AlignedPricingGrid({
  columns,
  children,
  className = "",
}: {
  columns: 2 | 3;
  children: ReactNode;
  className?: string;
}) {
  const cols =
    columns === 2
      ? "mx-auto max-w-4xl sm:grid-cols-2"
      : "sm:grid-cols-2 lg:grid-cols-3";

  return (
    <div className={`mt-12 grid grid-cols-1 items-stretch gap-6 ${cols} ${className}`}>
      {children}
    </div>
  );
}

export function AlignedPricingCard({
  highlighted,
  light,
  children,
}: {
  highlighted?: boolean;
  light?: boolean;
  children: ReactNode;
}) {
  const surface = highlighted
    ? "border-brand-cyan bg-forward-950 text-white ring-1 ring-brand-cyan"
    : light
      ? "border-forward-200 bg-white text-forward-900"
      : "border-forward-200 bg-white text-forward-900";

  return (
    <article
      className={`grid h-full gap-3 rounded-3xl border p-6 ${CARD_ROWS} ${surface}`}
    >
      {children}
    </article>
  );
}

export function PricingCardName({ children }: { children: ReactNode }) {
  return (
    <p className="truncate text-sm font-semibold uppercase leading-5 tracking-widest opacity-80">
      {children}
    </p>
  );
}

export function PricingCardEyebrow({
  children,
  highlighted,
}: {
  children: ReactNode;
  highlighted?: boolean;
}) {
  return (
    <p
      className={`truncate text-xs font-semibold uppercase leading-5 tracking-wide ${
        highlighted ? "text-brand-cyan" : "text-brand-blue"
      }`}
    >
      {children}
    </p>
  );
}

export function PricingCardPrice({
  amount,
  period = "CAD / month",
}: {
  amount: string;
  period?: string;
}) {
  return (
    <p className="flex h-full items-end font-display text-3xl font-semibold leading-none">
      <span className="tabular-nums">{amount}</span>
      {period ? (
        <span className="ml-2 pb-0.5 text-base font-normal opacity-70">{period}</span>
      ) : null}
    </p>
  );
}

export function PricingCardMeta({
  children,
  highlighted,
}: {
  children: ReactNode;
  highlighted?: boolean;
}) {
  return (
    <p
      className={`line-clamp-2 h-full text-sm leading-5 ${
        highlighted ? "text-forward-300" : "text-forward-600"
      }`}
    >
      {children}
    </p>
  );
}

export function PricingCardFeatures({
  items,
  highlighted,
}: {
  items: readonly string[];
  highlighted?: boolean;
}) {
  return (
    <ul className="flex h-full flex-col gap-3 self-stretch">
      {items.map((item) => (
        <li key={item} className="flex min-h-[2.5rem] gap-2 text-sm leading-5">
          <Check
            className={`mt-0.5 h-4 w-4 shrink-0 ${
              highlighted ? "text-brand-green" : "text-brand-blue"
            }`}
            aria-hidden
          />
          <span className="line-clamp-2">{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function pricingCtaClassName(extra = "") {
  return `!mt-0 flex h-12 w-full shrink-0 items-center justify-center !py-0 text-sm ${extra}`.trim();
}
