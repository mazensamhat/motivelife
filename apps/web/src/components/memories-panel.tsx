"use client";

import { useEffect, useState } from "react";
import { Button } from "./button";
import { Card, CardHeading } from "./card";
import { Input, Select, Textarea } from "./input";
import { DOMAIN_LABELS, LIFE_DOMAINS, type LifeDomain } from "@forward/shared";

interface Memory {
  id: string;
  content: string;
  type: string;
  domain: LifeDomain | null;
}

const MEMORY_TYPES = ["FACT", "PREFERENCE", "COMMITMENT", "ACHIEVEMENT"] as const;

export function MemoriesPanel() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [type, setType] = useState<(typeof MEMORY_TYPES)[number]>("COMMITMENT");
  const [domain, setDomain] = useState<LifeDomain | "">("");

  async function load() {
    const res = await fetch("/api/memories");
    const data = await res.json();
    setMemories(data.memories ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/memories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content,
        type,
        domain: domain || undefined,
      }),
    });
    setContent("");
    load();
  }

  async function remove(id: string) {
    await fetch("/api/memories", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    load();
  }

  if (loading) {
    return <div className="h-48 animate-pulse rounded-xl bg-forward-100" />;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeading>What motivelife.ai remembers</CardHeading>
        <p className="mt-1 text-sm text-forward-500">
          You control this list. Add commitments, preferences, and facts motivelife.ai should know.
        </p>
        <form onSubmit={add} className="mt-4 space-y-3">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="I want to save $10k for a home down payment by December"
            rows={2}
            required
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Select value={type} onChange={(e) => setType(e.target.value as typeof type)}>
              {MEMORY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.charAt(0) + t.slice(1).toLowerCase()}
                </option>
              ))}
            </Select>
            <Select value={domain} onChange={(e) => setDomain(e.target.value as LifeDomain | "")}>
              <option value="">Any domain</option>
              {LIFE_DOMAINS.map((d) => (
                <option key={d} value={d}>
                  {DOMAIN_LABELS[d]}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit" size="sm">
            Add memory
          </Button>
        </form>
      </Card>

      {memories.length === 0 ? (
        <Card>
          <p className="text-sm text-forward-500">No memories yet. Add what matters to you.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {memories.map((m) => (
            <Card key={m.id} className="flex items-start justify-between gap-4 p-4">
              <div>
                <p className="text-sm text-forward-900">{m.content}</p>
                <p className="mt-1 text-xs text-forward-400">
                  {m.type.toLowerCase()}
                  {m.domain ? ` · ${DOMAIN_LABELS[m.domain]}` : ""}
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => remove(m.id)}>
                Delete
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
