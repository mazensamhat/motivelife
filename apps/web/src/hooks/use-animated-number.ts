"use client";

import { useEffect, useState } from "react";

export function useAnimatedNumber(target: number, durationMs = 1200) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    let frame = 0;
    const start = performance.now();

    function tick(now: number) {
      const progress = Math.min(1, (now - start) / durationMs);
      const eased = 1 - (1 - progress) ** 3;
      setValue(Math.round(target * eased));
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      }
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs]);

  return value;
}
