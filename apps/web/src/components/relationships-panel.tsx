"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "./button";
import { Card, CardHeading } from "./card";
import { Input, Select } from "./input";
import {
  RELATIONSHIP_ITEM_TYPES,
  RELATIONSHIP_TYPE_LABELS,
  type RelationshipItemType,
} from "@forward/shared";
import { cn } from "@/lib/utils";
import { readApiJson } from "@/lib/fetch-api";

interface RelationshipItem {
  id: string;
  type: RelationshipItemType;
  title: string;
  cadenceDays: number | null;
  lastContactAt: string | null;
  notes: string | null;
  goal?: { id: string; title: string } | null;
}

interface Goal {
  id: string;
  title: string;
  domain: string;
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

function contactStatus(item: RelationshipItem): { label: string; tone: "ok" | "due" | "overdue" | "unknown" } {
  const since = daysSince(item.lastContactAt);
  if (since === null) return { label: "No contact logged yet", tone: "unknown" };
  if (!item.cadenceDays) return { label: `Last contact ${since} day${since === 1 ? "" : "s"} ago`, tone: "ok" };
  if (since <= item.cadenceDays) return { label: `On track · ${since}d since last contact`, tone: "ok" };
  if (since <= item.cadenceDays + 3) return { label: `Due for check-in · ${since}d ago`, tone: "due" };
  return { label: `Overdue · ${since}d since last contact`, tone: "overdue" };
}

export function RelationshipsPanel() {
  const [items, setItems] = useState<RelationshipItem[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState<RelationshipItemType>("FAMILY");
  const [title, setTitle] = useState("");
  const [cadenceDays, setCadenceDays] = useState("14");
  const [goalId, setGoalId] = useState("");

  async function load() {
    const [relRes, goalsRes] = await Promise.all([fetch("/api/relationships"), fetch("/api/goals")]);
    const relData = await readApiJson<{ items?: RelationshipItem[] }>(relRes);
    const goalsData = await readApiJson<{ goals?: Goal[] }>(goalsRes);
    setItems(relData?.items ?? []);
    setGoals((goalsData?.goals ?? []).filter((g) => g.domain === "RELATIONSHIPS"));
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function createItem(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/relationships", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        title,
        cadenceDays: cadenceDays ? parseInt(cadenceDays, 10) : undefined,
        goalId: goalId || undefined,
        lastContactAt: new Date().toISOString(),
      }),
    });
    setTitle("");
    setShowForm(false);
    load();
  }

  async function markContact(id: string) {
    await fetch("/api/relationships", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, lastContactAt: new Date().toISOString() }),
    });
    load();
  }

  async function remove(id: string) {
    await fetch("/api/relationships", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    load();
  }

  if (loading) return <div className="h-48 animate-pulse rounded-xl bg-forward-100" />;

  const byType = RELATIONSHIP_ITEM_TYPES.map((t) => ({
    type: t,
    items: items.filter((i) => i.type === t),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <CardHeading>People & connections</CardHeading>
          <p className="mt-1 text-sm text-forward-500">
            Track who matters — family, friends, partner, and community.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "Add person"}
        </Button>
      </div>

      {items.length === 0 && !showForm && (
        <Card>
          <p className="text-sm text-forward-500">
            Add someone you want to stay connected with. MotiveLife coaches you when check-ins slip.
          </p>
          <Link href="/dashboard#life-gps" className="mt-2 inline-block text-sm text-accent hover:underline">
            Create a relationships goal →
          </Link>
        </Card>
      )}

      {showForm && (
        <Card>
          <form onSubmit={createItem} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">Type</label>
                <Select value={type} onChange={(e) => setType(e.target.value as RelationshipItemType)}>
                  {RELATIONSHIP_ITEM_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {RELATIONSHIP_TYPE_LABELS[t]}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Name or group</label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={type === "FAMILY" ? "Mom" : type === "FRIEND" ? "College friends" : "Name"}
                  required
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">Check-in every (days)</label>
                <Input
                  type="number"
                  min="1"
                  max="365"
                  value={cadenceDays}
                  onChange={(e) => setCadenceDays(e.target.value)}
                  placeholder="14"
                />
              </div>
              {goals.length > 0 && (
                <div>
                  <label className="mb-1 block text-sm font-medium">Link to goal</label>
                  <Select value={goalId} onChange={(e) => setGoalId(e.target.value)}>
                    <option value="">None</option>
                    {goals.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.title}
                      </option>
                    ))}
                  </Select>
                </div>
              )}
            </div>
            <Button type="submit">Add</Button>
          </form>
        </Card>
      )}

      {byType.map(
        ({ type: t, items: group }) =>
          group.length > 0 && (
            <div key={t}>
              <h3 className="mb-3 text-sm font-medium text-forward-500">{RELATIONSHIP_TYPE_LABELS[t]}</h3>
              <div className="space-y-3">
                {group.map((item) => {
                  const status = contactStatus(item);
                  return (
                    <Card key={item.id} className="p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-forward-900">{item.title}</p>
                          <p
                            className={cn(
                              "mt-1 text-sm",
                              status.tone === "overdue" && "text-red-600",
                              status.tone === "due" && "text-amber-600",
                              status.tone === "ok" && "text-forward-600",
                              status.tone === "unknown" && "text-forward-500"
                            )}
                          >
                            {status.label}
                            {item.cadenceDays ? ` · target every ${item.cadenceDays}d` : ""}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" onClick={() => markContact(item.id)}>
                            Mark contact
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => remove(item.id)}>
                            Remove
                          </Button>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          )
      )}
    </div>
  );
}
