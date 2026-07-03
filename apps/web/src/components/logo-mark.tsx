"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

const ICON_PATH = "/brand/logo-icon.png";

/** Official MotiveLife M icon — cyan-to-green gradient mark. */
export function LogoMark({
  className,
  size = 56,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <Image
      src={ICON_PATH}
      alt="MotiveLife"
      width={size}
      height={size}
      className={cn("shrink-0 rounded-2xl object-contain", className)}
      style={{ width: size, height: size }}
    />
  );
}
