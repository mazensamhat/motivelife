import Image from "next/image";
import { logoAlt, type Platform } from "@/lib/platforms";

export type BrandLogoSize = "sm" | "md" | "lg";

const SIZES: Record<
  BrandLogoSize,
  { box: string; px: number; frame: string }
> = {
  sm: {
    box: "size-16",
    px: 64,
    frame: "rounded-xl p-2",
  },
  md: {
    box: "size-[200px] sm:size-[220px]",
    px: 220,
    frame: "rounded-2xl p-3",
  },
  lg: {
    box: "size-[180px] sm:size-[220px] lg:size-[280px]",
    px: 280,
    frame: "rounded-2xl p-3 sm:rounded-3xl sm:p-4",
  },
};

type BrandLogoProps = {
  platform: Platform;
  size?: BrandLogoSize;
  /** Accent-framed black plate used on lanes / grid / bridge / match */
  framed?: boolean;
  priority?: boolean;
  className?: string;
};

/**
 * Renders a platform logo in a fixed square so all four brands
 * share the same visual footprint regardless of PNG padding.
 */
export function BrandLogo({
  platform,
  size = "md",
  framed = false,
  priority = false,
  className = "",
}: BrandLogoProps) {
  const { box, px, frame } = SIZES[size];

  const image = (
    <span className={`relative block shrink-0 overflow-hidden ${box}`}>
      <Image
        src={platform.logo}
        alt={logoAlt(platform)}
        fill
        sizes={`${px}px`}
        className="object-contain"
        priority={priority}
      />
    </span>
  );

  if (!framed) {
    return <span className={`inline-flex ${className}`.trim()}>{image}</span>;
  }

  return (
    <span
      className={`inline-flex border border-white/10 bg-black ${frame} ${className}`.trim()}
      style={{
        boxShadow: `0 0 0 1px ${platform.accentSoft}, 0 12px 40px rgba(0,0,0,0.45)`,
      }}
    >
      {image}
    </span>
  );
}
