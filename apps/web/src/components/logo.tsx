import Link from "next/link";
import { LogoMark } from "./logo-mark";
import { StretchedBrandWordmark } from "./stretched-brand-wordmark";
import { cn } from "@/lib/utils";

const TAGLINE = "Live better. Grow every day.";
const SIDEBAR_WIDTH = "w-[216px] max-w-full";

const SIZES = {
  sm: { mark: 40, width: "", tag: "text-[6.5px]", word: "text-[1.05rem]" },
  md: { mark: 48, width: "", tag: "text-[7.5px]", word: "text-xl" },
  lg: { mark: 56, width: "", tag: "text-[8px]", word: "text-2xl" },
  xl: { mark: 64, width: "", tag: "text-[9px]", word: "text-[1.75rem]" },
  sidebar: { mark: 52, width: SIDEBAR_WIDTH, tag: "text-[7.5px]", word: "" },
} as const;

function LogoWordmarkSpans({ variant }: { variant: "light" | "dark" }) {
  const onDark = variant === "dark";

  return (
    <>
      <span className={onDark ? "text-white" : "text-forward-900"}>MOTIVE</span>
      <span className="brand-gradient-text">LIFE</span>
      <span className={onDark ? "text-forward-300" : "text-forward-400"}>.</span>
      <span className={onDark ? "text-forward-300" : "text-forward-500"}>AI</span>
    </>
  );
}

function LogoWordmark({
  variant,
  tagClass,
  wordClass,
  widthClass,
  showTagline = true,
}: {
  variant: "light" | "dark";
  tagClass: string;
  wordClass: string;
  widthClass: string;
  showTagline?: boolean;
}) {
  const onDark = variant === "dark";

  return (
    <div className={cn("min-w-0", widthClass)}>
      <p className={cn("font-bold leading-none tracking-tight whitespace-nowrap", wordClass)}>
        <LogoWordmarkSpans variant={variant} />
      </p>
      {showTagline && (
        <p
          className={cn(
            "mt-1.5 font-medium uppercase leading-snug tracking-[0.18em]",
            tagClass,
            onDark ? "text-forward-400" : "text-forward-500"
          )}
        >
          {TAGLINE}
        </p>
      )}
    </div>
  );
}

export function Logo({
  className,
  variant = "light",
  size = "md",
  showTagline = true,
  showMark = true,
  href = "/dashboard",
}: {
  className?: string;
  variant?: "light" | "dark";
  size?: keyof typeof SIZES;
  showTagline?: boolean;
  showMark?: boolean;
  href?: string;
}) {
  const s = SIZES[size];

  return (
    <Link
      href={href}
      className={cn(
        "inline-flex flex-col items-start transition-opacity hover:opacity-90",
        showMark ? "gap-2.5" : "gap-0",
        s.width,
        className
      )}
    >
      {showMark && <LogoMark size={s.mark} />}
      {size === "sidebar" ? (
        <StretchedBrandWordmark variant={variant} widthClass={s.width} />
      ) : (
        <LogoWordmark
          variant={variant}
          wordClass={s.word}
          tagClass={s.tag}
          widthClass={s.width}
          showTagline={showTagline}
        />
      )}
    </Link>
  );
}
