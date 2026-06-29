"use client";

import { useEffect, useState } from "react";
import { MorningBriefing } from "./morning-briefing";
import { EveningReview } from "./evening-review";
import { WeeklyReviewPanel } from "./weekly-review";
import { MonthlyReviewPanel } from "./monthly-review";
import { QuarterlyReviewPanel } from "./quarterly-review";
import { cn } from "@/lib/utils";
import { isFirstDayOfQuarter } from "@/lib/api";

type Mode = "morning" | "evening" | "weekly" | "monthly" | "quarterly";

function getDefaultMode(): Mode {
  const now = new Date();
  if (isFirstDayOfQuarter(now)) return "quarterly";
  if (now.getDate() === 1) return "monthly";
  if (now.getDay() === 0) return "weekly";
  return now.getHours() >= 17 ? "evening" : "morning";
}

export function DailyExperience() {
  const [mode, setMode] = useState<Mode>("morning");

  useEffect(() => {
    setMode(getDefaultMode());
  }, []);

  const tabs: { id: Mode; label: string }[] = [
    { id: "morning", label: "Morning Briefing" },
    { id: "evening", label: "Evening Review" },
    { id: "weekly", label: "Weekly Review" },
    { id: "monthly", label: "Monthly Review" },
    { id: "quarterly", label: "Quarterly Review" },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-1 rounded-lg bg-forward-100 p-1 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setMode(tab.id)}
            className={cn(
              "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
              mode === tab.id
                ? "bg-white text-forward-900 shadow-sm"
                : "text-forward-500 hover:text-forward-900"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {mode === "morning" && <MorningBriefing />}
      {mode === "evening" && <EveningReview />}
      {mode === "weekly" && <WeeklyReviewPanel />}
      {mode === "monthly" && <MonthlyReviewPanel />}
      {mode === "quarterly" && <QuarterlyReviewPanel />}
    </div>
  );
}
