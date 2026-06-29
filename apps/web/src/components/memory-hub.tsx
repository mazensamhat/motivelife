"use client";

import { useEffect, useState } from "react";
import { DomainNextActionHero } from "./domain-next-action-hero";
import { LifeMomentsPanel } from "./life-moments-panel";
import { MemoriesPanel } from "./memories-panel";
import { VoiceCaptureSearch } from "./voice-capture-search";
import { VoiceActivityFeed } from "./voice-activity-feed";
import { VoiceWeeklyRecapPanel } from "./voice-weekly-recap-panel";
import { LifeReplayPanel } from "./life-replay-panel";
import { SundayWeeklyLetter } from "./sunday-weekly-letter";
import { MonthlyReviewPanel } from "./monthly-review";
import { QuarterlyReviewPanel } from "./quarterly-review";
import { PremiumGate } from "./premium-gate";
import { isFirstWeekOfQuarter } from "@/lib/api";
import { LifeGraphSnippet } from "./life-graph-snippet";
import { LifeTimelinePanel } from "./life-timeline-panel";
import { BeliefsSnapshot } from "./beliefs-snapshot";
import { LifeXpGrowthPanel } from "./life-xp-growth-panel";
import type {
  LifeBelief,
  LifeGraphPayload,
  LifePreference,
  LifeReplayPayload,
  LifeTimelineEntry,
  LifeXpGrowthPayload,
} from "@forward/shared";

export function MemoryHub() {
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState<string | null>(null);
  const [beliefs, setBeliefs] = useState<LifeBelief[]>([]);
  const [preferences, setPreferences] = useState<LifePreference | null>(null);
  const [timeline, setTimeline] = useState<LifeTimelineEntry[]>([]);
  const [lifeGraph, setLifeGraph] = useState<LifeGraphPayload | null>(null);
  const [replay, setReplay] = useState<LifeReplayPayload | null>(null);
  const [xpGrowth, setXpGrowth] = useState<LifeXpGrowthPayload | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/life-os").then((r) => r.json()),
      fetch("/api/life-replay").then((r) => r.json()),
      fetch("/api/life-xp?growth=true").then((r) => r.json()),
    ])
      .then(([os, replayData, growth]) => {
        setUserName(os.userName ?? null);
        setBeliefs(os.beliefs ?? []);
        setPreferences(os.preferences ?? null);
        setTimeline(os.timeline ?? []);
        setLifeGraph(os.lifeGraph ?? null);
        setReplay(replayData.replay ?? null);
        setXpGrowth(growth);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-24 animate-pulse rounded-xl bg-forward-100" />
        <div className="h-64 animate-pulse rounded-xl bg-forward-100" />
      </div>
    );
  }

  const showMonthlyReview = new Date().getDate() <= 7;
  const showQuarterlyReview = isFirstWeekOfQuarter();

  return (
    <div className="space-y-8">
      <BeliefsSnapshot beliefs={beliefs} preferences={preferences} />

      {xpGrowth && <LifeXpGrowthPanel growth={xpGrowth} />}

      {replay && <LifeReplayPanel replay={replay} userName={userName} />}

      {showQuarterlyReview && (
        <section>
          <h2 className="text-lg font-semibold text-forward-900">Quarterly review</h2>
          <p className="mt-1 text-sm text-forward-500">First week of the quarter — reset priorities.</p>
          <div className="mt-4">
            <PremiumGate feature="Quarterly life reviews">
              <QuarterlyReviewPanel />
            </PremiumGate>
          </div>
        </section>
      )}

      {showMonthlyReview && !showQuarterlyReview && (
        <section>
          <h2 className="text-lg font-semibold text-forward-900">Monthly review</h2>
          <p className="mt-1 text-sm text-forward-500">First week of the month — zoom out on your progress.</p>
          <div className="mt-4">
            <PremiumGate feature="Monthly life reviews">
              <MonthlyReviewPanel />
            </PremiumGate>
          </div>
        </section>
      )}

      <section>
        <h2 className="text-lg font-semibold text-forward-900">Weekly letter</h2>
        <p className="mt-1 text-sm text-forward-500">Your week in review — available any day on Memory.</p>
        <div className="mt-4">
          <SundayWeeklyLetter />
        </div>
      </section>

      <DomainNextActionHero domain="memory" />

      <LifeMomentsPanel />

      {timeline.length > 0 && (
        <section>
          <LifeTimelinePanel entries={timeline} />
        </section>
      )}

      {lifeGraph && (lifeGraph.edges.length > 0 || lifeGraph.destination) && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-forward-900">Life Graph</h2>
          <LifeGraphSnippet graph={lifeGraph} />
        </section>
      )}

      <VoiceWeeklyRecapPanel />

      <VoiceActivityFeed />

      <VoiceCaptureSearch />

      <MemoriesPanel />
    </div>
  );
}
