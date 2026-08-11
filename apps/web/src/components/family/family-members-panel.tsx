"use client";

import { useState } from "react";
import {
  FAMILY_RELATIONSHIP_PRESETS,
  type FamilyMapMemberView,
  type FamilyMapState,
} from "@forward/shared";
import { Bell, Trash2, UserRound } from "lucide-react";
import { Button } from "@/components/button";
import { FAMILY_MEMBER_COLOR_OPTIONS } from "@/lib/family-map/member-colors";
import { memberPresenceSubtitle } from "@/lib/family-map/member-presence-label";

function selectValue(label: string | null | undefined): string {
  if (!label) return "";
  if ((FAMILY_RELATIONSHIP_PRESETS as readonly string[]).includes(label)) return label;
  return "Other";
}

export function FamilyMembersPanel({
  members,
  isOwner,
  inviteCode,
  busy,
  onUpdated,
  onError,
  onShareInvite,
  previewPatch,
}: {
  members: FamilyMapMemberView[];
  isOwner: boolean;
  inviteCode: string | null;
  busy: boolean;
  onUpdated: (state: FamilyMapState) => void;
  onError: (msg: string) => void;
  onShareInvite?: () => void;
  /** Offline preview: apply patch locally instead of calling the API. */
  previewPatch?: (
    memberId: string,
    body: Record<string, unknown>
  ) => void;
}) {
  const [savingId, setSavingId] = useState<string | null>(null);
  const [customById, setCustomById] = useState<Record<string, string>>({});
  const [draftById, setDraftById] = useState<Record<string, string>>({});

  async function patchMember(memberId: string, body: Record<string, unknown>) {
    if (previewPatch) {
      previewPatch(memberId, body);
      return;
    }
    setSavingId(memberId);
    try {
      const res = await fetch(`/api/family/members/${encodeURIComponent(memberId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        onError(data?.error ?? "Could not update member.");
        return;
      }
      onUpdated((await res.json()) as FamilyMapState);
    } catch {
      onError("Could not update member.");
    } finally {
      setSavingId(null);
    }
  }

  async function removeMember(member: FamilyMapMemberView) {
    if (previewPatch) {
      onError("Leaving / removing is disabled in the public preview.");
      return;
    }
    const self = member.isYou;
    const label = member.relationshipLabel || member.displayName;
    const ok = window.confirm(
      self
        ? "Leave this family household? You’ll need a new invite to rejoin."
        : `Remove ${label} from the household?`
    );
    if (!ok) return;
    setSavingId(member.id);
    try {
      const res = await fetch(`/api/family/members/${encodeURIComponent(member.id)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        onError(data?.error ?? "Could not remove member.");
        return;
      }
      onUpdated((await res.json()) as FamilyMapState);
    } catch {
      onError("Could not remove member.");
    } finally {
      setSavingId(null);
    }
  }

  async function pingMember(member: FamilyMapMemberView) {
    if (previewPatch) {
      window.alert(`Preview: would ask ${member.displayName} to share location.`);
      return;
    }
    setSavingId(member.id);
    try {
      const res = await fetch(`/api/family/members/${encodeURIComponent(member.id)}/ping`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        onError(data?.error ?? "Could not ping them.");
        return;
      }
      window.alert(`Asked ${member.displayName} to turn on live location.`);
    } catch {
      onError("Could not ping them.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-3">
      <section className="relative overflow-hidden rounded-[1.5rem] bg-white p-4 shadow-[0_10px_28px_-18px_rgba(10,25,48,0.28)] ring-1 ring-forward-100/90">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-display text-base font-semibold text-forward-900">
              Family members
            </h3>
            <p className="mt-0.5 text-xs text-forward-500">
              Set relationships, ask someone to share location, or remove a member.
            </p>
          </div>
          <UserRound className="mt-0.5 h-4 w-4 text-forward-400" />
        </div>

        {isOwner && inviteCode && onShareInvite ? (
          <Button
            type="button"
            variant="secondary"
            className="mt-3 w-full"
            disabled={busy}
            onClick={onShareInvite}
          >
            Invite someone — share link
          </Button>
        ) : null}

        <ul className="mt-3 divide-y divide-forward-100 overflow-hidden rounded-2xl bg-forward-50/50 ring-1 ring-forward-100">
          {members.map((m) => {
            const draft = draftById[m.id] ?? selectValue(m.relationshipLabel);
            const custom =
              customById[m.id] ??
              (selectValue(m.relationshipLabel) === "Other"
                ? m.relationshipLabel ?? ""
                : "");
            const locationOff = m.lat == null || m.lng == null;
            const disabled = busy || savingId === m.id;

            return (
              <li key={m.id} className="space-y-2 px-3 py-3">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-bold text-white"
                    style={{ background: m.color }}
                  >
                    {m.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={m.avatarUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      m.displayName.slice(0, 1)
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-forward-900">
                      {m.displayName}
                      {m.isYou ? " · You" : ""}
                      {m.role === "OWNER" ? " · Owner" : ""}
                    </p>
                    <p className="truncate text-[11px] text-forward-500">
                      {m.relationshipLabel ? `${m.relationshipLabel} · ` : ""}
                      {memberPresenceSubtitle(m)}
                    </p>
                  </div>
                </div>

                <label className="block text-[11px] font-medium text-forward-600">
                  Relationship
                  <select
                    className="mt-1 w-full rounded-lg border border-forward-200 bg-white px-2.5 py-2 text-sm text-forward-900"
                    value={draft}
                    disabled={disabled}
                    onChange={(e) => {
                      const value = e.target.value;
                      setDraftById((prev) => ({ ...prev, [m.id]: value }));
                      if (!value) {
                        void patchMember(m.id, { relationshipLabel: null });
                        return;
                      }
                      if (value === "Other") return;
                      void patchMember(m.id, { relationshipLabel: value });
                    }}
                  >
                    <option value="">
                      {m.isYou ? "Your role…" : "Choose…"}
                    </option>
                    {FAMILY_RELATIONSHIP_PRESETS.map((label) => (
                      <option key={label} value={label}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>

                {draft === "Other" ? (
                  <div className="flex gap-2">
                    <input
                      value={custom}
                      onChange={(e) =>
                        setCustomById((prev) => ({
                          ...prev,
                          [m.id]: e.target.value,
                        }))
                      }
                      placeholder="Custom label"
                      maxLength={40}
                      disabled={disabled}
                      className="flex-1 rounded-lg border border-forward-200 px-2.5 py-2 text-sm"
                    />
                    <Button
                      type="button"
                      disabled={disabled || !custom.trim()}
                      onClick={() =>
                        void patchMember(m.id, {
                          relationshipLabel: custom.trim(),
                        })
                      }
                    >
                      Save
                    </Button>
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  {!m.isYou && locationOff ? (
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => void pingMember(m)}
                      className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-900"
                    >
                      <Bell className="h-3 w-3" />
                      Ask to share location
                    </button>
                  ) : null}
                  {(m.isYou && m.role !== "OWNER") ||
                  (isOwner && !m.isYou && m.role !== "OWNER") ? (
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => void removeMember(m)}
                      className="inline-flex items-center gap-1 rounded-full border border-forward-200 px-2.5 py-1 text-[11px] font-semibold text-forward-600 hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                    >
                      <Trash2 className="h-3 w-3" />
                      {m.isYou ? "Leave family" : "Remove"}
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="relative overflow-hidden rounded-[1.5rem] bg-white p-4 shadow-[0_10px_28px_-18px_rgba(10,25,48,0.28)] ring-1 ring-forward-100/90">
        <h3 className="font-display text-base font-semibold text-forward-900">
          Map colors
        </h3>
        <p className="mt-0.5 text-xs text-forward-500">
          Pick a pin color for each person.
        </p>
        <ul className="mt-3 space-y-3">
          {members.map((m) => {
            const disabled = busy || savingId === m.id;
            const selected = m.color.toLowerCase();
            return (
              <li key={`color-${m.id}`} className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                    style={{ background: m.color }}
                  >
                    {m.displayName.slice(0, 1)}
                  </span>
                  <p className="truncate text-sm font-semibold text-forward-900">
                    {m.displayName}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {FAMILY_MEMBER_COLOR_OPTIONS.map((color) => {
                    const active = color.toLowerCase() === selected;
                    return (
                      <button
                        key={`${m.id}-${color}`}
                        type="button"
                        disabled={disabled || active}
                        onClick={() => void patchMember(m.id, { color })}
                        aria-label={`Set ${m.displayName} color ${color}`}
                        className={`h-7 w-7 rounded-full transition ${
                          active
                            ? "ring-2 ring-forward-900 ring-offset-2"
                            : "ring-1 ring-black/10 hover:scale-105"
                        }`}
                        style={{ background: color }}
                      />
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
