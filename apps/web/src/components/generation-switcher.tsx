"use client";

import { useState } from "react";
import { Button } from "./button";
import { Card, CardHeading } from "./card";
import {
  GENERATIONS,
  GENERATION_THEMES,
  type Generation,
} from "@/lib/generation";
import { setGenerationPreviewCookie } from "@/lib/generation-preview-client";
import { cn } from "@/lib/utils";

export function GenerationSwitcher({
  activeGeneration,
  profileGeneration,
  compact = false,
}: {
  activeGeneration: Generation;
  profileGeneration: Generation;
  compact?: boolean;
}) {
  const [pending, setPending] = useState<Generation | null>(null);
  const isPreview = activeGeneration !== profileGeneration;

  function preview(generation: Generation) {
    if (generation === activeGeneration) return;
    setPending(generation);
    setGenerationPreviewCookie(generation);
  }

  function resetToProfile() {
    setPending(null);
    setGenerationPreviewCookie(null);
  }

  return (
    <Card className={compact ? "border-forward-200 p-4" : undefined}>
      {!compact && (
        <>
          <CardHeading>Dashboard view</CardHeading>
          <p className="mt-1 text-sm text-forward-500">
            Preview how motivelife.ai looks for each generation — without changing your saved profile.
          </p>
        </>
      )}

      {isPreview && (
        <p className={cn("text-xs font-medium text-brand-blue", compact ? "mb-3" : "mt-3")}>
          Previewing {GENERATION_THEMES[activeGeneration].label} ·{" "}
          <button
            type="button"
            onClick={resetToProfile}
            className="underline hover:text-forward-900"
          >
            back to my profile
          </button>
        </p>
      )}

      <div className={cn("grid gap-2", compact ? "grid-cols-2" : "mt-4 sm:grid-cols-2")}>
        {GENERATIONS.map((gen) => {
          const t = GENERATION_THEMES[gen];
          const selected = activeGeneration === gen;
          const isProfile = profileGeneration === gen;
          return (
            <button
              key={gen}
              type="button"
              disabled={pending != null}
              onClick={() => preview(gen)}
              className="rounded-xl border p-3 text-left transition-all disabled:opacity-60"
              style={{
                borderColor: selected ? t.primary : "#d0dced",
                backgroundColor: selected ? `${t.primaryLight}99` : "#fff",
                boxShadow: selected ? `0 0 0 2px ${t.primary}` : undefined,
              }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: t.primary }}
                />
                <span className="text-sm font-medium text-forward-900">{t.label}</span>
              </div>
              <p className="mt-1 text-[11px] text-forward-500">
                {t.ageRange}
                {isProfile ? " · your profile" : ""}
              </p>
            </button>
          );
        })}
      </div>

      {!compact && isPreview && (
        <Button variant="secondary" size="sm" className="mt-4" onClick={resetToProfile}>
          Use my profile view ({GENERATION_THEMES[profileGeneration].label})
        </Button>
      )}
    </Card>
  );
}
