import type { ReactNode } from "react";
import { Check } from "lucide-react";

/**
 * Parent grid for pricing cards that share row tracks (CSS subgrid),
 * so titles / prices / meta / CTAs line up across columns.
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
      : "lg:grid-cols-3";

  return (
    <div
      className={`mt-12 grid grid-cols-1 gap-6 ${cols} sm:grid-rows-[auto_auto_auto_auto_1fr_auto] sm:gap-x-6 sm:gap-y-3 ${className}`}
    >
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
  /** Light surface (Family page non-highlight cards). */
  light?: boolean;
  children: ReactNode;
}) {
  const surface = highlighted
    ? "border-brand-cyan bg-forward-950 text-white shadow-xl"
    : light
      ? "border-forward-200 bg-white text-forward-900"
      : "border-forward-200 bg-forward-50 text-forward-900";

  return (
    <article
      className={`row-span-6 grid grid-rows-subgrid rounded-3xl border p-6 max-sm:flex max-sm:h-full max-sm:flex-col max-sm:gap-0 ${surface}`}
    >
      {children}
    </article>
  );
}

export function PricingCardName({ children }: { children: ReactNode }) {
  return (
    <p className="text-sm font-semibold uppercase tracking-widest opacity-80">{children}</p>
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
      className={`text-xs font-semibold uppercase tracking-wide max-sm:mt-2 ${
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
    <p className="font-display text-3xl font-semibold leading-none max-sm:mt-4">
      <span className="tabular-nums">{amount}</span>
      {period ? (
        <span className="ml-2 text-base font-normal opacity-70">{period}</span>
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
      className={`text-sm leading-snug max-sm:mt-3 ${
        highlighted ? "text-forward-300" : "opacity-80"
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
    <ul className="flex flex-col gap-3 max-sm:mt-6 max-sm:flex-1">
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
