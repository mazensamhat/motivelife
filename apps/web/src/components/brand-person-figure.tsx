import { cn } from "@/lib/utils";

/** Head + raised-arms accent from the brand M logo (not a smile) */
export function BrandPersonFigure({
  className,
  size = 18,
  color = "#00C6FF",
}: {
  className?: string;
  size?: number;
  color?: string;
}) {
  const height = Math.round(size * 0.58);

  return (
    <svg
      viewBox="0 0 24 14"
      width={size}
      height={height}
      className={cn("shrink-0", className)}
      aria-hidden
    >
      <circle cx="12" cy="4.5" r="2.2" fill={color} />
      <path
        d="M5 7 Q12 12 19 7"
        stroke={color}
        strokeWidth="2.25"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
