"use client";

import { Brain, Compass, Flame, Sparkles } from "lucide-react";

/** Sample Pro modules shown blurred behind PremiumGate. */
export function LifeProLockedPreview() {
  return (
    <div className="space-y-2.5 p-3">
      <div className="grid grid-cols-2 gap-2">
        <Tile
          icon={<Sparkles className="h-3 w-3" />}
          label="Life Momentum"
          value="82%"
          detail="Trending up"
        />
        <Tile
          icon={<Brain className="h-3 w-3" />}
          label="Invisible Pattern"
          value="Workday +43 min"
          detail="Gym visits ↓22%"
        />
        <Tile
          icon={<Compass className="h-3 w-3" />}
          label="Places + Movement"
          value="21.6 hrs commute"
          detail="Home arrival 24m later"
        />
        <Tile
          icon={<Flame className="h-3 w-3" />}
          label="Next best decision"
          value="Salary review"
          detail="+CA$310k lifetime"
        />
      </div>
      <div className="rounded-xl border border-forward-100 bg-forward-50 px-3 py-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-forward-500">
          Daily Life Brief™
        </p>
        <p className="mt-1 text-sm font-semibold text-forward-900">
          Your office move is quietly reshaping sleep and spending.
        </p>
        <p className="mt-0.5 text-xs text-forward-600">
          Transportation +$94/mo · Sleep −19 min · Life Momentum −4
        </p>
      </div>
    </div>
  );
}

function Tile({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-xl border border-forward-100 bg-forward-50/80 px-3 py-2.5 text-left">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-forward-500">
        {icon}
        {label}
      </div>
      <p className="mt-1 text-sm font-semibold text-forward-900">{value}</p>
      <p className="mt-0.5 text-[11px] text-forward-600">{detail}</p>
    </div>
  );
}
