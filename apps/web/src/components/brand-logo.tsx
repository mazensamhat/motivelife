import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

const LOGO_PATH = "/brand/motivelife-logo.png";

const HEIGHT_CLASS = {
  nav: "max-h-[52px]",
  sidebar: "max-h-[88px]",
  md: "max-h-[96px]",
  lg: "max-h-[160px]",
  xl: "max-h-[200px]",
} as const;

/** Official MotiveLife brand lockup (icon + wordmark + tagline). */
export function BrandLogo({
  href = "/",
  size = "md",
  className,
  priority = false,
  variant: _variant = "light",
}: {
  href?: string;
  size?: keyof typeof HEIGHT_CLASS;
  className?: string;
  priority?: boolean;
  /** Kept for API compatibility — lockup is designed for dark backgrounds. */
  variant?: "light" | "dark";
}) {
  return (
    <Link
      href={href}
      className={cn("inline-block transition-opacity hover:opacity-90", className)}
    >
      <Image
        src={LOGO_PATH}
        alt="MotiveLife — Live better. Grow every day."
        width={1024}
        height={1024}
        priority={priority}
        className={cn("h-auto w-auto object-contain", HEIGHT_CLASS[size])}
      />
    </Link>
  );
}
