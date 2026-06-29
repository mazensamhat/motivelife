"use client";

import { useEffect, useState } from "react";
import { Button } from "./button";
import { Card, CardHeading } from "./card";
import {
  DEFAULT_LIFE_PREFERENCES,
  LIFE_BELIEF_PRESETS,
  LIFE_CONTEXTS,
  type LifeBelief,
  type LifeBeliefId,
  type LifeContextId,
  type LifePreference,
} from "@forward/shared";
import { previewCoachVoice } from "@/lib/coach-voice-preview";
import {
  buildPartnerInviteUrl,
  formatPartnerInviteMessage,
} from "@/lib/accountability-partner";

export function LifeBeliefsSettings() {
  const [beliefs, setBeliefs] = useState<Set<LifeBeliefId>>(new Set());
  const [customBelief, setCustomBelief] = useState("");
  const [customBeliefs, setCustomBeliefs] = useState<LifeBelief[]>([]);
  const [preferences, setPreferences] = useState<LifePreference>(DEFAULT_LIFE_PREFERENCES);
  const [contextId, setContextId] = useState<LifeContextId | "">("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [userName, setUserName] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [partnerName, setPartnerName] = useState("");
  const [partnerLinkedUserId, setPartnerLinkedUserId] = useState<string | null>(null);
  const [inviteCopied, setInviteCopied] = useState(false);

  useEffect(() => {
    fetch("/api/user")
      .then((r) => r.json())
      .then((d) => {
        try {
          const b: LifeBelief[] = d.user?.beliefs ? JSON.parse(d.user.beliefs) : [];
          const presetIds = b.filter((x) => !x.custom).map((x) => x.id as LifeBeliefId);
          setBeliefs(new Set(presetIds));
          setCustomBeliefs(b.filter((x) => x.custom));
        } catch {
          /* ignore */
        }
        try {
          if (d.user?.preferences) setPreferences(JSON.parse(d.user.preferences));
        } catch {
          /* ignore */
        }
        try {
          if (d.user?.activeContext) {
            const ctx = JSON.parse(d.user.activeContext);
            setContextId(ctx.id ?? "");
          }
        } catch {
          /* ignore */
        }
        setUserName(d.user?.name ?? null);
        setUserId(d.user?.id ?? null);
        try {
          if (d.user?.accountabilityPartner) {
            const p = JSON.parse(d.user.accountabilityPartner) as {
              name?: string;
              linkedUserId?: string;
            };
            setPartnerName(p.name ?? "");
            setPartnerLinkedUserId(p.linkedUserId ?? null);
          }
        } catch {
          /* ignore */
        }
        setLoading(false);
      });
  }, []);

  function toggleBelief(id: LifeBeliefId) {
    setBeliefs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function addCustomBelief() {
    const label = customBelief.trim();
    if (!label) return;
    setCustomBeliefs((prev) => [...prev, { id: `custom_${Date.now()}`, label, custom: true }]);
    setCustomBelief("");
  }

  async function copyPartnerInvite() {
    if (!partnerName.trim() || !userId) return;
    const url = buildPartnerInviteUrl(userId, window.location.origin);
    const text = formatPartnerInviteMessage(partnerName.trim(), userName, url);
    await navigator.clipboard.writeText(text);
    setInviteCopied(true);
    setTimeout(() => setInviteCopied(false), 2000);
  }

  function textPartnerInvite() {
    if (!partnerName.trim() || !userId) return;
    const url = buildPartnerInviteUrl(userId, window.location.origin);
    const text = formatPartnerInviteMessage(partnerName.trim(), userName, url);
    window.location.href = `sms:?body=${encodeURIComponent(text)}`;
  }

  async function save() {
    setSaving(true);
    setMessage("");
    const beliefPayload: LifeBelief[] = [
      ...LIFE_BELIEF_PRESETS.filter((p) => beliefs.has(p.id)).map((p) => ({
        id: p.id,
        label: p.label,
      })),
      ...customBeliefs,
    ];

    const res = await fetch("/api/user", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        beliefs: beliefPayload,
        preferences,
        activeContextId: contextId || null,
        accountabilityPartner: partnerName.trim()
          ? {
              name: partnerName.trim(),
              ...(partnerLinkedUserId ? { linkedUserId: partnerLinkedUserId } : {}),
            }
          : null,
      }),
    });

    setSaving(false);
    setMessage(res.ok ? "Saved — your AI will sound more like you." : "Could not save.");
  }

  if (loading) {
    return <div className="h-48 animate-pulse rounded-xl bg-forward-100" />;
  }

  const beliefPayload: LifeBelief[] = [
    ...LIFE_BELIEF_PRESETS.filter((p) => beliefs.has(p.id)).map((p) => ({
      id: p.id,
      label: p.label,
    })),
    ...customBeliefs,
  ];

  const voicePreview = previewCoachVoice(
    preferences,
    beliefPayload,
    userName?.split(" ")[0] ?? "Alex"
  );

  return (
    <Card className="p-6">
      <CardHeading>Beliefs & Preferences</CardHeading>
      <p className="mt-1 text-sm text-forward-500">
        Stable values that shape every recommendation — not what you did today, but who you are.
      </p>

      <div className="mt-6">
        <p className="text-sm font-medium text-forward-800">Beliefs</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {LIFE_BELIEF_PRESETS.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => toggleBelief(b.id)}
              className={`rounded-full border px-3 py-1.5 text-sm transition ${
                beliefs.has(b.id)
                  ? "border-brand-blue bg-brand-blue/10 text-brand-blue"
                  : "border-forward-200 text-forward-600 hover:border-forward-300"
              }`}
            >
              {b.label}
            </button>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <input
            type="text"
            value={customBelief}
            onChange={(e) => setCustomBelief(e.target.value)}
            placeholder="Add your own belief…"
            className="flex-1 rounded-lg border border-forward-200 px-3 py-2 text-sm"
          />
          <Button type="button" variant="ghost" size="sm" onClick={addCustomBelief}>
            Add
          </Button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium text-forward-800">Peak hours</span>
          <select
            className="mt-1 w-full rounded-lg border border-forward-200 px-3 py-2"
            value={preferences.peakHours}
            onChange={(e) =>
              setPreferences((p) => ({ ...p, peakHours: e.target.value as LifePreference["peakHours"] }))
            }
          >
            <option value="morning">Morning</option>
            <option value="afternoon">Afternoon</option>
            <option value="evening">Evening</option>
            <option value="night">Night owl</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="font-medium text-forward-800">Task length</span>
          <select
            className="mt-1 w-full rounded-lg border border-forward-200 px-3 py-2"
            value={preferences.taskLength}
            onChange={(e) =>
              setPreferences((p) => ({ ...p, taskLength: e.target.value as LifePreference["taskLength"] }))
            }
          >
            <option value="short">Short bursts</option>
            <option value="medium">Medium blocks</option>
            <option value="long">Deep work</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="font-medium text-forward-800">Coaching style</span>
          <select
            className="mt-1 w-full rounded-lg border border-forward-200 px-3 py-2"
            value={preferences.reminderStyle}
            onChange={(e) =>
              setPreferences((p) => ({
                ...p,
                reminderStyle: e.target.value as LifePreference["reminderStyle"],
              }))
            }
          >
            <option value="gentle">Gentle reminders</option>
            <option value="direct">Direct</option>
            <option value="statistics">Statistics-driven</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="font-medium text-forward-800">Notifications</span>
          <select
            className="mt-1 w-full rounded-lg border border-forward-200 px-3 py-2"
            value={preferences.notifications}
            onChange={(e) =>
              setPreferences((p) => ({
                ...p,
                notifications: e.target.value as LifePreference["notifications"],
              }))
            }
          >
            <option value="minimal">Minimal</option>
            <option value="normal">Normal</option>
            <option value="off">Off</option>
          </select>
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={preferences.encouragement}
            onChange={(e) => setPreferences((p) => ({ ...p, encouragement: e.target.checked }))}
          />
          Needs encouragement
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={preferences.humor}
            onChange={(e) => setPreferences((p) => ({ ...p, humor: e.target.checked }))}
          />
          Likes humor (Gen Z mode)
        </label>
      </div>

      <div className="mt-5 rounded-xl border border-brand-blue/20 bg-brand-blue/5 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-blue">
          AI voice preview
        </p>
        <p className="mt-2 text-sm italic leading-relaxed text-forward-700">&ldquo;{voicePreview}&rdquo;</p>
        <p className="mt-2 text-[11px] text-forward-400">
          Updates live as you change coaching style — no API call needed.
        </p>
      </div>

      <div className="mt-6">
        <p className="text-sm font-medium text-forward-800">Accountability partner</p>
        <p className="mt-1 text-xs text-forward-500">
          Duolingo-style — name someone who cheers on your Life Engine streak (optional).
        </p>
        {partnerLinkedUserId && (
          <p className="mt-2 inline-flex rounded-full bg-brand-green/10 px-2.5 py-1 text-[11px] font-semibold text-brand-green">
            Linked on MotiveLife — streaks sync on Today
          </p>
        )}
        <input
          type="text"
          value={partnerName}
          onChange={(e) => setPartnerName(e.target.value)}
          placeholder="Friend or partner's first name"
          className="mt-2 w-full rounded-lg border border-forward-200 px-3 py-2 text-sm"
        />
        {partnerName.trim() && userId && (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={copyPartnerInvite}>
              {inviteCopied ? "Copied!" : "Copy invite message"}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={textPartnerInvite}>
              Text invite
            </Button>
          </div>
        )}
      </div>

      <div className="mt-6">
        <p className="text-sm font-medium text-forward-800">Life context</p>
        <p className="mt-1 text-xs text-forward-500">
          Your dashboard adapts automatically — or set one manually.
        </p>
        <select
          className="mt-2 w-full rounded-lg border border-forward-200 px-3 py-2 text-sm"
          value={contextId}
          onChange={(e) => setContextId(e.target.value as LifeContextId | "")}
        >
          <option value="">Auto-detect</option>
          {LIFE_CONTEXTS.map((c) => (
            <option key={c.id} value={c.id}>
              {c.emoji} {c.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save beliefs & preferences"}
        </Button>
        {message && <p className="text-sm text-forward-600">{message}</p>}
      </div>
    </Card>
  );
}
