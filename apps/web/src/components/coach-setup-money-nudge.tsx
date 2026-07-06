"use client";

import { useEffect, useState } from "react";
import type { CoachSetupReminder } from "@forward/shared";
import { CoachSetupRemindersPanel } from "./coach-setup-reminders-panel";
import { readApiJson } from "@/lib/fetch-api";

const MONEY_IDS = new Set(["financial_profile", "money_commitments"]);

export function CoachSetupMoneyNudge() {
  const [reminders, setReminders] = useState<CoachSetupReminder[]>([]);

  useEffect(() => {
    fetch("/api/life-os", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        const all = (data?.coachSetupReminders ?? []) as CoachSetupReminder[];
        setReminders(all.filter((r) => MONEY_IDS.has(r.id)));
      })
      .catch(() => setReminders([]));
  }, []);

  if (reminders.length === 0) return null;

  return <CoachSetupRemindersPanel reminders={reminders} compact className="mb-6" />;
}
