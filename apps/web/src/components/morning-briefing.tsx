"use client";

import { useEffect, useState } from "react";
import { Button } from "./button";
import { Card, CardHeading, CardTitle } from "./card";
import { AGENT_LABELS, type AgentType } from "@forward/shared";
import { readApiError, readApiJson } from "@/lib/fetch-api";

interface BriefingData {
  summary: string | null;
  mission: string | null;
  suggestedAction: string | null;
  priorities: string[];
}

interface Suggestion {
  id: string;
  agent: AgentType;
  title: string;
  reason: string | null;
}

export function MorningBriefing() {
  const [briefing, setBriefing] = useState<BriefingData | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load(refresh = false) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/briefing${refresh ? "?refresh=true" : ""}`);
      const data = await readApiJson<{ briefing?: BriefingData; suggestions?: Suggestion[] }>(res);

      if (!res.ok || !data?.briefing) {
        setError(await readApiError(res));
        setBriefing(null);
        setSuggestions([]);
        return;
      }

      setBriefing(data.briefing);
      setSuggestions(data.suggestions ?? []);
    } catch {
      setError("Could not load briefing.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSuggestion(id: string, status: "ACCEPTED" | "DISMISSED") {
    await fetch("/api/suggestions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    setSuggestions((prev) => prev.filter((s) => s.id !== id));
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-32 animate-pulse rounded-xl bg-forward-100" />
        <div className="h-24 animate-pulse rounded-xl bg-forward-100" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <p className="text-sm text-red-600">{error}</p>
        <Button variant="ghost" size="sm" className="mt-3" onClick={() => load(true)}>
          Try again
        </Button>
      </Card>
    );
  }

  if (!briefing) return null;

  return (
    <div className="space-y-6">
      <Card className="border-brand-blue/20 bg-gradient-to-br from-white to-forward-50">
        <CardTitle>Morning Briefing</CardTitle>
        <p className="mt-2 text-forward-700">{briefing.summary}</p>

        {briefing.mission && (
          <div className="mt-6 rounded-lg bg-forward-900 px-4 py-3 text-white">
            <p className="text-xs font-medium uppercase tracking-wide text-forward-300">
              Today&apos;s Mission
            </p>
            <p className="mt-1 text-lg font-medium">{briefing.mission}</p>
          </div>
        )}

        {briefing.suggestedAction && (
          <p className="mt-4 text-sm text-forward-600">{briefing.suggestedAction}</p>
        )}

        {briefing.priorities.length > 0 && (
          <div className="mt-6">
            <p className="text-xs font-medium uppercase tracking-wide text-forward-400">
              Top priorities
            </p>
            <ol className="mt-2 space-y-2">
              {briefing.priorities.map((p, i) => (
                <li key={i} className="flex gap-3 text-sm text-forward-800">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-forward-100 text-xs font-medium text-forward-600">
                    {i + 1}
                  </span>
                  {p}
                </li>
              ))}
            </ol>
          </div>
        )}

        <Button variant="ghost" size="sm" className="mt-4" onClick={() => load(true)}>
          Refresh briefing
        </Button>
      </Card>

      {suggestions.length > 0 && (
        <div>
          <CardHeading className="mb-3">Suggested for you</CardHeading>
          <div className="space-y-3">
            {suggestions.map((s) => (
              <Card key={s.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-medium brand-gradient-text">
                      {AGENT_LABELS[s.agent]}
                    </p>
                    <p className="mt-1 font-medium text-forward-900">{s.title}</p>
                    {s.reason && (
                      <p className="mt-1 text-sm text-forward-500">{s.reason}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button size="sm" onClick={() => handleSuggestion(s.id, "ACCEPTED")}>
                      Do it
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleSuggestion(s.id, "DISMISSED")}
                    >
                      Dismiss
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
