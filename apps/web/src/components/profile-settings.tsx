"use client";

import { useState } from "react";
import { Button } from "./button";
import { Card, CardHeading } from "./card";
import { Input } from "./input";
import {
  GENERATIONS,
  GENERATION_THEMES,
  birthYearFromGeneration,
  getGenerationFromBirthYear,
  type Generation,
} from "@/lib/generation";
import { setGenerationPreviewCookie } from "@/lib/generation-preview-client";
import { cn } from "@/lib/utils";

export function ProfileSettings({
  name,
  email,
  birthYear,
}: {
  name: string | null;
  email: string;
  birthYear: number | null;
}) {
  const [displayName, setDisplayName] = useState(name ?? "");
  const [generation, setGeneration] = useState<Generation>(
    getGenerationFromBirthYear(birthYear)
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function save() {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: displayName.trim() || undefined,
          birthYear: birthYearFromGeneration(generation),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not save profile.");
        return;
      }
      setGenerationPreviewCookie(null);
      setMessage("Profile saved. Dashboard updated to match your generation.");
      window.location.reload();
    } catch {
      setError("Could not save profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeading>Profile</CardHeading>
      <p className="mt-1 text-sm text-forward-500">
        Your name and generation set your default dashboard layout and greeting.
      </p>

      <div className="mt-6 space-y-4">
        <div>
          <label className="text-sm font-medium text-forward-700" htmlFor="settings-name">
            Name
          </label>
          <Input
            id="settings-name"
            className="mt-1.5"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your name"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-forward-700" htmlFor="settings-email">
            Email
          </label>
          <Input id="settings-email" className="mt-1.5 bg-forward-50" value={email} disabled />
        </div>

        <div>
          <p className="text-sm font-medium text-forward-700">Your generation</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {GENERATIONS.map((gen) => {
              const t = GENERATION_THEMES[gen];
              const active = generation === gen;
              return (
                <button
                  key={gen}
                  type="button"
                  onClick={() => setGeneration(gen)}
                  className={cn(
                    "rounded-xl border p-3 text-left transition-all",
                    active && "ring-2 ring-offset-1"
                  )}
                  style={{
                    borderColor: active ? t.primary : "#d0dced",
                    backgroundColor: active ? `${t.primaryLight}99` : "#fff",
                    boxShadow: active ? `0 0 0 2px ${t.primary}` : undefined,
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: t.primary }}
                    />
                    <span className="text-sm font-medium text-forward-900">{t.label}</span>
                  </div>
                  <p className="mt-1 text-[11px] text-forward-500">{t.ageRange}</p>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      {message && <p className="mt-4 text-sm text-brand-blue">{message}</p>}

      <Button className="mt-6" onClick={save} disabled={saving}>
        {saving ? "Saving..." : "Save profile"}
      </Button>
    </Card>
  );
}
