"use client";

import { useState } from "react";
import { Button } from "./button";
import { Card, CardHeading } from "./card";
import { GENERATIONS, GENERATION_THEMES, birthYearFromGeneration, type Generation } from "@/lib/generation";

export function GenerationSetup({ onSaved }: { onSaved?: () => void }) {
  const [selected, setSelected] = useState<Generation>("MILLENNIAL");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await fetch("/api/user", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ birthYear: birthYearFromGeneration(selected) }),
    });
    setSaving(false);
    onSaved?.();
    window.location.reload();
  }

  return (
    <Card className="border-brand-cyan/30 bg-white">
      <CardHeading>Personalize your dashboard</CardHeading>
      <p className="mt-2 text-sm text-forward-600">
        motivelife.ai adapts to your life stage — pick the generation that fits you best.
      </p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {GENERATIONS.map((gen) => {
          const t = GENERATION_THEMES[gen];
          const active = selected === gen;
          return (
            <button
              key={gen}
              type="button"
              onClick={() => setSelected(gen)}
              className="rounded-xl border p-4 text-left transition-all"
              style={{
                borderColor: active ? t.primary : "#d0dced",
                backgroundColor: active ? `${t.primaryLight}80` : "#fff",
              }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: t.primary }}
                />
                <span className="font-medium text-forward-900">{t.label}</span>
              </div>
              <p className="mt-1 text-xs text-forward-500">Ages {t.ageRange}</p>
            </button>
          );
        })}
      </div>
      <Button className="mt-4" onClick={save} disabled={saving}>
        {saving ? "Saving..." : "Apply my dashboard"}
      </Button>
    </Card>
  );
}
