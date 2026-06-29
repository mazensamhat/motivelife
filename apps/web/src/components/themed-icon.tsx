import type { LucideIcon } from "lucide-react";
import { BrandPersonFigure } from "./brand-person-figure";
import { cn } from "@/lib/utils";
interface ThemedIconProps {
  icon: LucideIcon;
  active?: boolean;
  primary: string;
  primaryLight: string;
  primaryDark?: string;
  size?: "sm" | "md" | "lg";
  variant?: "nav" | "widget";
  className?: string;
}

export function ThemedIcon({
  icon: Icon,
  active = false,
  primary,
  primaryLight,
  primaryDark,
  size = "md",
  variant = "widget",
  className,
}: ThemedIconProps) {
  const dark = primaryDark ?? primary;
  const sizes = {
    sm: { box: "h-9 w-9", icon: "h-[18px] w-[18px]" },
    md: { box: "h-10 w-10", icon: "h-5 w-5" },
    lg: { box: "h-11 w-11", icon: "h-5 w-5" },
  };
  const s = sizes[size];

  if (variant === "nav") {
    return (
      <span
        className={cn(
          "relative flex shrink-0 items-center justify-center rounded-xl transition-all duration-200",
          s.box,
          active
            ? "border border-white/25 shadow-md"
            : "border border-white/10 bg-white/[0.06]",
          className
        )}
        style={
          active
            ? {
                background: `linear-gradient(145deg, ${primaryLight} 0%, rgba(255,255,255,0.92) 50%, ${primaryLight}cc 100%)`,
                boxShadow: `0 6px 16px -6px ${primary}55`,
                color: dark,
              }
            : {
                color: primaryLight,
              }
        }
      >
        <Icon className={cn(s.icon, active && "drop-shadow-sm")} strokeWidth={active ? 2.25 : 2} />
        {active && (
          <span
            className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border-2 border-forward-950"
            style={{ backgroundColor: dark }}
          />
        )}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-xl shadow-sm",
        s.box,
        className
      )}
      style={{
        background: `linear-gradient(145deg, ${primaryLight} 0%, ${primary}22 100%)`,
        color: primary,
        border: `1px solid ${primary}33`,
      }}
    >
      <Icon className={s.icon} strokeWidth={2} />
    </span>
  );
}

interface WidgetIconProps {
  icon: LucideIcon;
  primary: string;
  primaryLight: string;
}

export function WidgetIcon({ icon, primary, primaryLight }: WidgetIconProps) {
  return (
    <ThemedIcon
      icon={icon}
      primary={primary}
      primaryLight={primaryLight}
      size="md"
      variant="widget"
    />
  );
}

interface LifeScoreRingProps {
  score: number;
  primary: string;
  primaryLight: string;
  size?: number;
}

export function LifeScoreRing({ score, primary, primaryLight, size = 72 }: LifeScoreRingProps) {
  const stroke = 6;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={primaryLight}
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={primary}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="absolute text-center">
          <p className="text-lg font-bold leading-none text-black">
            {score}
          </p>
        </div>
      </div>
      <BrandPersonFigure size={20} color={primary} />
    </div>
  );
}
