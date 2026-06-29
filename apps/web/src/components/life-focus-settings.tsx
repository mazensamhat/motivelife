"use client";

import { useEffect, useState } from "react";
import { Button } from "./button";
import { Card, CardHeading } from "./card";
import {
  LIFE_FOCUS_OPTIONS,
  LIFE_MODULES,
  type LifeFocusId,
  type LifeModuleId,
} from "@forward/shared";
import { modulesFromFocuses } from "@/lib/life-os-client";
import { parseJsonArray } from "@/lib/life-os-parse";

export function LifeFocusSettings() {
  const [focuses, setFocuses] = useState<Set<LifeFocusId>>(new Set());
  const [modules, setModules] = useState<Set<LifeModuleId>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/user")
      .then((r) => r.json())
      .then((d) => {
        const f = parseJsonArray<LifeFocusId>(d.user?.lifeFocuses);
        const m = parseJsonArray<LifeModuleId>(d.user?.activeModules);
        setFocuses(new Set(f));
        setModules(new Set(m.length ? m : modulesFromFocuses(f)));
        setLoading(false);
      });
  }, []);

  function toggleFocus(id: LifeFocusId) {
    setFocuses((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleModule(id: LifeModuleId) {
    setModules((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function save() {
    setSaving(true);
    setMessage("");
    const f = [...focuses];
    const m = modules.size > 0 ? [...modules] : modulesFromFocuses(f);
    await fetch("/api/user", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lifeFocuses: f, activeModules: m }),
    });
    setSaving(false);
    setMessage("Life OS updated.");
    window.location.reload();
  }

  if (loading) return <div className="h-24 animate-pulse rounded-xl bg-forward-100" />;

  return (
    <Card>
      <CardHeading>Life focus & modules</CardHeading>
      <p className="mt-1 text-sm text-forward-500">
        What MotiveLife helps you improve — and which Life Modules appear on your day.
      </p>

      <p className="mt-4 text-sm font-medium text-forward-700">I want to…</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {LIFE_FOCUS_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => toggleFocus(opt.id)}
            className={`rounded-lg border px-3 py-2 text-left text-sm ${
              focuses.has(opt.id)
                ? "border-brand-blue bg-brand-blue/5 font-medium"
                : "border-forward-200"
            }`}
          >
            {focuses.has(opt.id) ? "☑" : "☐"} {opt.label}
          </button>
        ))}
      </div>

      <p className="mt-6 text-sm font-medium text-forward-700">Active Life Modules</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {LIFE_MODULES.map((mod) => (
          <button
            key={mod.id}
            type="button"
            onClick={() => toggleModule(mod.id)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
              modules.has(mod.id)
                ? "border-brand-blue bg-brand-blue/10 text-forward-900"
                : "border-forward-200 text-forward-500"
            }`}
          >
            {mod.emoji} {mod.label.replace(" Module", "")}
          </button>
        ))}
      </div>

      {message && <p className="mt-4 text-sm text-brand-blue">{message}</p>}
      <Button className="mt-4" onClick={save} disabled={saving}>
        {saving ? "Saving…" : "Save Life OS"}
      </Button>
    </Card>
  );
}
