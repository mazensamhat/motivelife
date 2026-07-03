"use client";

export function CelebrationBurst() {
  const particles = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden" aria-hidden>
      {particles.map((i) => (
        <span
          key={i}
          className="celebration-particle absolute left-1/2 top-1/2 h-2 w-2 rounded-full"
          style={{
            ["--angle" as string]: `${(i / particles.length) * 360}deg`,
            ["--delay" as string]: `${(i % 6) * 40}ms`,
            backgroundColor: i % 3 === 0 ? "#22d3ee" : i % 3 === 1 ? "#10B981" : "#7C3AED",
          }}
        />
      ))}
    </div>
  );
}
