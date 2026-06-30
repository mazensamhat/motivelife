"use client";

import { useRef, useState } from "react";
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
import { resizeImageFile } from "@/lib/avatar";
import { initialsForName } from "@/lib/life-circle";
import { cn } from "@/lib/utils";

export function ProfileSettings({
  name,
  email,
  birthYear,
  avatarUrl: initialAvatarUrl,
}: {
  name: string | null;
  email: string;
  birthYear: number | null;
  avatarUrl: string | null;
}) {
  const [displayName, setDisplayName] = useState(name ?? "");
  const [generation, setGeneration] = useState<Generation>(
    getGenerationFromBirthYear(birthYear)
  );
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function onPhotoSelected(file: File | null) {
    if (!file) return;
    setAvatarLoading(true);
    setError("");
    try {
      const avatarDataUrl = await resizeImageFile(file);
      const res = await fetch("/api/user/avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarDataUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not upload photo.");
        return;
      }
      setAvatarUrl(data.avatarUrl ?? avatarDataUrl);
      setMessage("Profile photo updated.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not upload photo.");
    } finally {
      setAvatarLoading(false);
    }
  }

  async function removePhoto() {
    setAvatarLoading(true);
    setError("");
    const res = await fetch("/api/user/avatar", { method: "DELETE" });
    setAvatarLoading(false);
    if (!res.ok) {
      setError("Could not remove photo.");
      return;
    }
    setAvatarUrl(null);
    setMessage("Profile photo removed.");
  }

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
        Your photo appears in Life Circle. Name and generation shape your dashboard.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <div className="relative">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt=""
              className="h-20 w-20 rounded-full border-2 border-forward-200 object-cover shadow-sm"
            />
          ) : (
            <span className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-forward-200 bg-brand-cyan/15 text-xl font-bold text-brand-cyan">
              {initialsForName(displayName || name || "?")}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(e) => onPhotoSelected(e.target.files?.[0] ?? null)}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={avatarLoading}
            onClick={() => fileRef.current?.click()}
          >
            {avatarLoading ? "..." : avatarUrl ? "Change photo" : "Add photo"}
          </Button>
          {avatarUrl && (
            <Button type="button" variant="ghost" size="sm" disabled={avatarLoading} onClick={removePhoto}>
              Remove
            </Button>
          )}
        </div>
      </div>

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
