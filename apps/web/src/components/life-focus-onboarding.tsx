"use client";

import { useState } from "react";
import { Button } from "./button";
import { Card, CardHeading } from "./card";
import {
  LIFE_FOCUS_OPTIONS,
  type LifeFocusId,
} from "@forward/shared";
import { modulesFromFocuses } from "@/lib/life-os-client";

export function LifeFocusOnboarding({ onComplete }: { onComplete?: () => void }) {
  const [selected, setSelected] = useState<Set<LifeFocusId>>(new Set());
  const [saving, setSaving] = useState(false);

  function toggle(id: LifeFocusId) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function save() {
    if (selected.size === 0) return;
    setSaving(true);
    const focuses = [...selected];
    const modules = modulesFromFocuses(focuses);
    await fetch("/api/user", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lifeFocuses: focuses, activeModules: modules }),
    });
    setSaving(false);
    onComplete?.();
    window.location.reload();
  }

  return (
    <Card className="border-brand-cyan/30 bg-gradient-to-br from-white to-forward-50">
      <CardHeading>What kind of life are you trying to build?</CardHeading>
      <p className="mt-2 text-sm text-forward-600">
        Pick everything MotiveLife should help you improve. Your Daily Operating System is built
        from this — not a generic dashboard.
      </p>
      <div className="mt-6 grid gap-2 sm:grid-cols-2">
        {LIFE_FOCUS_OPTIONS.map((opt) => {
          const active = selected.has(opt.id);
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => toggle(opt.id)}
              className={`rounded-xl border px-4 py-3 text-left text-sm transition-all ${
                active
                  ? "border-brand-blue bg-brand-blue/5 font-medium text-forward-900 shadow-sm"
                  : "border-forward-200 bg-white text-forward-700 hover:border-forward-300"
              }`}
            >
              <span className="mr-2">{active ? "☑" : "☐"}</span>
              {opt.label}
            </button>
          );
        })}
      </div>
      <Button className="mt-6" onClick={save} disabled={saving || selected.size === 0}>
        {saving ? "Building your OS…" : "Build my Daily Operating System"}
      </Button>
    </Card>
  );
}
