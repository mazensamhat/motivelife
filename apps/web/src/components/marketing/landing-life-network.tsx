"use client";

import { HERO_LIFE_NODES } from "@/lib/marketing-copy";

/** Full-bleed living network — YOU at center, life domains as nodes */
export function LandingLifeNetwork({ className = "" }: { className?: string }) {
  const nodes = HERO_LIFE_NODES;
  const positions = [
    { x: 18, y: 22 },
    { x: 78, y: 18 },
    { x: 88, y: 48 },
    { x: 72, y: 78 },
    { x: 28, y: 82 },
    { x: 10, y: 55 },
    { x: 50, y: 12 },
    { x: 50, y: 88 },
  ];

  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden>
      <svg className="h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
        <defs>
          <radialGradient id="twinGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgb(0 198 255)" stopOpacity="0.35" />
            <stop offset="55%" stopColor="rgb(0 114 255)" stopOpacity="0.08" />
            <stop offset="100%" stopColor="transparent" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="100" height="100" fill="url(#twinGlow)" />
        {positions.map((p, i) => (
          <line
            key={`line-${nodes[i]}`}
            x1="50"
            y1="50"
            x2={p.x}
            y2={p.y}
            stroke="rgb(0 198 255 / 0.28)"
            strokeWidth="0.2"
            className="landing-network-line"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
        <circle cx="50" cy="50" r="6" fill="rgb(5 13 24 / 0.85)" stroke="rgb(0 255 135 / 0.8)" strokeWidth="0.35" />
        <text
          x="50"
          y="51.5"
          textAnchor="middle"
          fill="white"
          fontSize="2.4"
          fontWeight="700"
          letterSpacing="0.08em"
        >
          YOU
        </text>
        {positions.map((p, i) => (
          <g key={nodes[i]} className="landing-network-node" style={{ animationDelay: `${i * 0.12}s` }}>
            <circle cx={p.x} cy={p.y} r="2.2" fill="rgb(0 114 255 / 0.35)" stroke="rgb(0 198 255 / 0.7)" strokeWidth="0.25" />
            <text
              x={p.x}
              y={p.y - 3.2}
              textAnchor="middle"
              fill="rgb(208 220 237 / 0.9)"
              fontSize="2.1"
              fontWeight="600"
            >
              {nodes[i]}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
