import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

const LOGO_PATH = "/brand/motivelife-logo.png";

const HEIGHT_CLASS = {
  nav: "max-h-[52px]",
  sidebar: "max-h-[72px]",
  md: "max-h-[80px]",
  lg: "max-h-[148px]",
  xl: "max-h-[176px]",
} as const;

/** Official MotiveLife brand lockup (icon + wordmark + tagline). */
export function BrandLogo({
  href = "/",
  size = "md",
  className,
  priority = false,
  variant = "light",
}: {
  href?: string;
  size?: keyof typeof HEIGHT_CLASS;
  className?: string;
  priority?: boolean;
  /** Dark sidebar uses a light pad behind the full-color lockup. */
  variant?: "light" | "dark";
}) {
  const onDark = variant === "dark";

  return (
    <Link
      href={href}
      className={cn("inline-block transition-opacity hover:opacity-90", className)}
    >
      <span
        className={cn(
          "inline-flex rounded-xl",
          onDark && "bg-white px-2.5 py-2 shadow-sm"
        )}
      >
        <Image
          src={LOGO_PATH}
          alt="MotiveLife — Your AI partner for a better life"
          width={512}
          height={512}
          priority={priority}
          className={cn("h-auto w-auto object-contain", HEIGHT_CLASS[size])}
        />
      </span>
    </Link>
  );
}
