"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Input } from "./input";

interface VoiceSearchHit {
  id: string;
  summary: string | null;
  transcript: string;
  createdAt: string;
  snippet?: string;
}

export function VoiceCaptureSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<VoiceSearchHit[]>([]);
  const [searching, setSearching] = useState(false);

  async function search(q: string) {
    setQuery(q);
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`/api/voice-capture?q=${encodeURIComponent(q.trim())}`);
      const data = await res.json();
      setResults(data.captures ?? []);
    } finally {
      setSearching(false);
    }
  }

  return (
    <section className="rounded-2xl border border-forward-200 bg-white p-4">
      <h2 className="text-lg font-semibold text-forward-900">Search voice captures</h2>
      <p className="mt-1 text-sm text-forward-500">
        &ldquo;When did I say I wanted to move to Calgary?&rdquo; — search what you spoke.
      </p>
      <div className="relative mt-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-forward-400" />
        <Input
          className="pl-9"
          placeholder="Search transcripts…"
          value={query}
          onChange={(e) => search(e.target.value)}
        />
      </div>
      {searching && <p className="mt-3 text-sm text-forward-500">Searching…</p>}
      {results.length > 0 && (
        <ul className="mt-4 space-y-3">
          {results.map((hit) => (
            <li key={hit.id} className="rounded-lg bg-forward-50 px-3 py-2.5 text-sm">
              <p className="text-[10px] font-medium uppercase tracking-widest text-forward-400">
                {new Date(hit.createdAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
              <p className="mt-1 text-forward-800">{hit.snippet ?? hit.summary ?? hit.transcript}</p>
            </li>
          ))}
        </ul>
      )}
      {query.trim().length >= 2 && !searching && results.length === 0 && (
        <p className="mt-3 text-sm text-forward-500">No voice captures match yet — hold the mic and say it.</p>
      )}
    </section>
  );
}
