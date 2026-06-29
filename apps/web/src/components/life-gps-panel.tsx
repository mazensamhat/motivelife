"use client";

import { useEffect, useState } from "react";
import { MapPin, Pencil } from "lucide-react";
import { Button } from "./button";
import { Card } from "./card";
import { LifeGpsGoals } from "./life-gps-goals";
import type { LifeGpsPayload } from "@forward/shared";

export function LifeGpsPanel({
  gps: initial,
  onUpdate,
  expandGoals = false,
}: {
  gps: LifeGpsPayload;
  onUpdate?: () => void;
  expandGoals?: boolean;
}) {
  const [gps, setGps] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initial.destination ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setGps(initial);
    setDraft(initial.destination ?? "");
  }, [initial]);

  useEffect(() => {
    if (expandGoals) {
      document.getElementById("life-gps")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [expandGoals]);

  async function saveDestination() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await fetch("/api/user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lifeDestination: trimmed, lifeDestinationGoalId: null }),
      });
      setGps((prev) => ({ ...prev, destination: trimmed, goalId: null }));
      setEditing(false);
      onUpdate?.();
    } finally {
      setSaving(false);
    }
  }

  function refreshGps() {
    onUpdate?.();
  }

  if (!gps.destination && !editing) {
    return (
      <section id="life-gps" className="scroll-mt-24">
        <Card className="border-dashed border-forward-300 bg-forward-50/50 p-5">
          <div className="flex items-start gap-3">
            <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-brand-blue" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-forward-900">Life GPS</p>
              <p className="mt-1 text-sm text-forward-600">{gps.subtitle}</p>
              <Button size="sm" className="mt-3" onClick={() => setEditing(true)}>
                Set destination
              </Button>
            </div>
          </div>
          <LifeGpsGoals compact onChange={refreshGps} />
        </Card>
      </section>
    );
  }

  if (editing) {
    return (
      <section id="life-gps" className="scroll-mt-24">
        <Card className="border-brand-blue/30 p-5">
          <p className="text-sm font-semibold text-forward-900">Where are you headed?</p>
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="e.g. Buy a house, Launch my business"
            className="mt-3 w-full rounded-xl border border-forward-200 px-4 py-2.5 text-sm focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
            autoFocus
          />
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={saveDestination} disabled={saving || !draft.trim()}>
              {saving ? "Saving…" : "Save destination"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </Card>
      </section>
    );
  }

  return (
    <section id="life-gps" className="scroll-mt-24">
      <Card className="overflow-hidden border-brand-blue/20 p-0">
        <div className="bg-gradient-to-r from-brand-blue/10 via-white to-brand-cyan/10 px-5 py-5 sm:px-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-brand-blue/10 p-2.5">
                <MapPin className="h-5 w-5 text-brand-blue" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-forward-500">
                  Life GPS
                </p>
                <p className="mt-1 text-xl font-semibold text-forward-900">{gps.destination}</p>
                <p className="mt-1 text-sm text-forward-600">{gps.subtitle}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setDraft(gps.destination ?? "");
                setEditing(true);
              }}
              className="rounded-lg p-2 text-forward-400 hover:bg-forward-100 hover:text-forward-700"
              aria-label="Edit destination"
            >
              <Pencil className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-5">
            <div className="flex items-end justify-between gap-2">
              <p className="text-sm text-forward-500">You&apos;re</p>
              <p className="text-3xl font-bold tabular-nums text-forward-900">
                {gps.percentComplete}%
              </p>
            </div>
            <p className="text-right text-xs font-medium uppercase tracking-wide text-forward-400">
              Complete
            </p>
            <div className="mt-2 h-3 overflow-hidden rounded-full bg-forward-200">
              <div
                className="h-full rounded-full bg-gradient-to-r from-brand-blue to-brand-cyan transition-all duration-700"
                style={{ width: `${gps.percentComplete}%` }}
              />
            </div>
            {gps.etaLabel && <p className="mt-2 text-xs text-forward-500">{gps.etaLabel}</p>}
          </div>

          <LifeGpsGoals
            compact
            linkedGoalId={gps.goalId}
            destination={gps.destination}
            onChange={refreshGps}
          />
        </div>
      </Card>
    </section>
  );
}
