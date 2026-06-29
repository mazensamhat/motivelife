"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { LifeMomentPayload } from "@forward/shared";
import { Button } from "./button";
import { Input, Textarea } from "./input";
import { cn } from "@/lib/utils";

const CATEGORY_LABEL: Record<string, string> = {
  LIFE_EVENT: "Life event",
  CAREER: "Career",
  MONEY: "Money",
  HEALTH: "Health",
  LEARNING: "Learning",
  RELATIONSHIPS: "Relationships",
  PERSONAL: "Personal",
};

export function LifeMomentsPanel({ compact = false }: { compact?: boolean }) {
  const [moments, setMoments] = useState<LifeMomentPayload[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/life-moments?limit=${compact ? 8 : 60}`);
      const data = (await res.json()) as { moments?: LifeMomentPayload[] };
      setMoments(data.moments ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [compact]);

  async function addMoment(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/life-moments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), description: description.trim() || undefined }),
      });
      if (res.ok) {
        setTitle("");
        setDescription("");
        await load();
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="h-48 animate-pulse rounded-2xl bg-forward-100" />;
  }

  return (
    <section className="rounded-2xl border border-forward-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-forward-400">
            Life Moments™
          </p>
          <p className="mt-1 text-sm text-forward-500">
            Your permanent timeline — wins, milestones, and memories that never fade.
          </p>
        </div>
        {compact && (
          <Link href="/memory" className="text-xs font-medium text-brand-blue hover:underline">
            View all →
          </Link>
        )}
      </div>

      {!compact && (
        <form onSubmit={addMoment} className="mt-4 space-y-3 rounded-xl border border-forward-100 bg-forward-50/60 p-4">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What happened? e.g. Closed on our first home"
            required
          />
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional details you want to remember"
            rows={2}
          />
          <Button type="submit" size="sm" disabled={saving}>
            {saving ? "Saving…" : "Add to Life Moments"}
          </Button>
        </form>
      )}

      {moments.length === 0 ? (
        <p className="mt-4 text-sm text-forward-500">
          Complete actions on Today or add a moment manually — your story starts here.
        </p>
      ) : (
        <ul className="mt-4 space-y-0">
          {moments.map((m, i) => (
            <li key={m.id} className="relative flex gap-4 pb-5 last:pb-0">
              {i < moments.length - 1 && (
                <span className="absolute left-[5.5rem] top-8 h-full w-px bg-forward-200" />
              )}
              <div className="w-[5.5rem] shrink-0 text-right">
                <p className="text-xs font-semibold text-forward-500">
                  {new Date(m.occurredAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </p>
                <p className="text-[10px] text-forward-400">
                  {CATEGORY_LABEL[m.category] ?? m.category}
                </p>
              </div>
              <div className="min-w-0 flex-1 rounded-xl border border-forward-100 bg-forward-50/80 px-4 py-3">
                <p className="text-sm font-medium text-forward-900">{m.title}</p>
                {m.description && (
                  <p className="mt-1 text-xs text-forward-500">{m.description}</p>
                )}
              </div>
              {m.scoreDelta != null && m.scoreDelta !== 0 && (
                <span
                  className={cn(
                    "shrink-0 self-center text-sm font-bold tabular-nums",
                    m.scoreDelta > 0 ? "text-brand-green" : "text-red-500"
                  )}
                >
                  {m.scoreDelta > 0 ? `+${m.scoreDelta}` : m.scoreDelta}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
