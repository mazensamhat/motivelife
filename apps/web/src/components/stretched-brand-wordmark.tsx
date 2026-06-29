"use client";

import { useLayoutEffect, useRef } from "react";
import { cn } from "@/lib/utils";

const TAGLINE = "Your AI partner for a better life";

function LogoWordmarkSpans({ variant }: { variant: "light" | "dark" }) {
  const onDark = variant === "dark";

  return (
    <>
      <span className={onDark ? "text-white" : "text-forward-900"}>motive</span>
      <span className="brand-gradient-text">life</span>
      <span className={onDark ? "text-[#A78BFA]" : "text-brand-purple"}>.</span>
      <span className="brand-dot-ai">ai</span>
    </>
  );
}

/** Wordmark stretched to exactly match tagline width in the sidebar */
export function StretchedBrandWordmark({
  variant = "dark",
  widthClass = "w-[216px] max-w-full",
}: {
  variant?: "light" | "dark";
  widthClass?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tagRef = useRef<HTMLParagraphElement>(null);
  const wordRef = useRef<HTMLParagraphElement>(null);
  const onDark = variant === "dark";

  useLayoutEffect(() => {
    const container = containerRef.current;
    const tag = tagRef.current;
    const word = wordRef.current;
    if (!container || !tag || !word) return;

    function fit() {
      if (!tag || !word) return;
      const targetWidth = tag.offsetWidth;
      if (targetWidth <= 0) return;

      word.style.width = `${targetWidth}px`;
      word.style.letterSpacing = "0.04em";

      let size = 28;
      word.style.fontSize = `${size}px`;

      while (word.scrollWidth > targetWidth && size > 14) {
        size -= 0.5;
        word.style.fontSize = `${size}px`;
      }

      let spacing = 0.04;
      while (word.scrollWidth < targetWidth && spacing < 0.35) {
        spacing += 0.005;
        word.style.letterSpacing = `${spacing}em`;
      }

      while (word.scrollWidth > targetWidth && spacing > 0) {
        spacing -= 0.005;
        word.style.letterSpacing = `${spacing}em`;
      }
    }

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className={cn("flex flex-col", widthClass)}>
      <p
        ref={wordRef}
        className="font-bold leading-none whitespace-nowrap"
        style={{ width: "100%" }}
      >
        <LogoWordmarkSpans variant={variant} />
      </p>
      <p
        ref={tagRef}
        className={cn(
          "mt-1.5 w-full font-medium uppercase leading-snug tracking-[0.18em] text-[7.5px]",
          onDark ? "text-forward-400" : "text-forward-500"
        )}
      >
        {TAGLINE}
      </p>
    </div>
  );
}
