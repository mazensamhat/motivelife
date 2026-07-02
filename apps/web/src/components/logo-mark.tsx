"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

const LOGO_PATH = "/brand/motivelife-logo.png";

/** Official MotiveLife M icon — cropped from the brand lockup PNG. */
export function LogoMark({
  className,
  size = 56,
}: {
  className?: string;
  size?: number;
}) {
  const box = Math.round(size * 1.08);

  return (
    <div
      className={cn("relative shrink-0 overflow-hidden rounded-xl", className)}
      style={{ width: box, height: box }}
      aria-hidden
    >
      <Image
        src={LOGO_PATH}
        alt=""
        width={512}
        height={512}
        className="pointer-events-none absolute left-1/2 top-[-2%] h-[125%] w-[125%] max-w-none -translate-x-1/2 object-contain"
      />
    </div>
  );
}
