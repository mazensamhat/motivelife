import type { ReactNode } from "react";
import { Check } from "lucide-react";

/**
 * Pricing cards with fixed header slots so name / price / meta / CTA
 * line up across columns on every marketing page (no subgrid quirks).
 */
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
      : "md:grid-cols-2 lg:grid-cols-3";

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
    ? "border-brand-cyan bg-forward-950 text-white shadow-xl"
    : light
      ? "border-forward-200 bg-white text-forward-900"
      : "border-forward-200 bg-white text-forward-900";

  return (
    <article
      className={`flex h-full flex-col rounded-3xl border p-6 ${surface}`}
    >
      {children}
    </article>
  );
}

export function PricingCardName({ children }: { children: ReactNode }) {
  return (
    <p className="h-5 truncate text-sm font-semibold uppercase tracking-widest opacity-80">
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
      className={`mt-2 h-5 truncate text-xs font-semibold uppercase tracking-wide ${
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
    <p className="mt-4 flex h-10 items-end font-display text-3xl font-semibold leading-none">
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
      className={`mt-3 line-clamp-2 h-10 text-sm leading-5 ${
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
    <ul className="mt-6 flex flex-1 flex-col gap-3">
      {items.map((item) => (
        <li key={item} className="flex gap-2 text-sm">
          <Check
            className={`mt-0.5 h-4 w-4 shrink-0 ${
              highlighted ? "text-brand-green" : "text-brand-blue"
            }`}
            aria-hidden
          />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

/** Same height primary/secondary CTA on every card. */
export function pricingCtaClassName(extra = "") {
  return `mt-8 flex h-12 w-full items-center justify-center ${extra}`.trim();
}
