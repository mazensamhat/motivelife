import { cn } from "@/lib/utils";

const WIDTHS = {
  /** Today dashboard — wider on tablet/desktop */
  dashboard: "max-w-3xl md:max-w-4xl xl:max-w-7xl",
  /** Module pages (Money, Career, etc.) */
  module: "max-w-3xl md:max-w-5xl xl:max-w-7xl",
  /** Narrow forms and settings */
  narrow: "max-w-2xl md:max-w-3xl",
} as const;

type ResponsivePageWidth = keyof typeof WIDTHS;

export function ResponsivePage({
  children,
  className,
  width = "module",
}: {
  children: React.ReactNode;
  className?: string;
  width?: ResponsivePageWidth;
}) {
  return <div className={cn("mx-auto w-full", WIDTHS[width], className)}>{children}</div>;
}

/** Desktop sidebar + main + optional right rail (Money mockup). */
export function ResponsiveSplit({
  main,
  aside,
  className,
}: {
  main: React.ReactNode;
  aside?: React.ReactNode;
  className?: string;
}) {
  if (!aside) {
    return <div className={className}>{main}</div>;
  }

  return (
    <div className={cn("grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px] xl:gap-8", className)}>
      <div className="min-w-0 space-y-6">{main}</div>
      <aside className="min-w-0 space-y-6 xl:sticky xl:top-4 xl:self-start">{aside}</aside>
    </div>
  );
}

/** Metric cards row — 1 col phone, 2 col tablet, 3–5 col desktop */
export function ResponsiveMetricGrid({
  children,
  cols = "auto",
  className,
}: {
  children: React.ReactNode;
  cols?: "auto" | 3 | 5;
  className?: string;
}) {
  const colClass =
    cols === 5
      ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
      : cols === 3
        ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
        : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

  return <div className={cn("grid gap-3 md:gap-4", colClass, className)}>{children}</div>;
}
