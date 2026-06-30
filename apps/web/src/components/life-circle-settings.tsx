"use client";

import { useEffect, useState } from "react";
import {
  MAX_LIFE_CIRCLE_MEMBERS,
  REFERRAL_BONUS_VOICE_UNITS,
  type LifeCircleMemberPayload,
  type LifeCircleRelationship,
  type LifeCircleSummary,
} from "@forward/shared";
import { Button } from "./button";
import { Card, CardHeading } from "./card";
import { Input, Select } from "./input";
import {
  buildLifeCircleInviteUrl,
  buildReferralInviteUrl,
  formatLifeCircleInviteMessage,
  relationshipLabel,
} from "@/lib/life-circle";

export function LifeCircleSettings() {
  const [circle, setCircle] = useState<LifeCircleSummary | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newRelationship, setNewRelationship] = useState<LifeCircleRelationship>("FRIEND");
  const [inviteRelationship, setInviteRelationship] = useState<LifeCircleRelationship>("FRIEND");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<"friend" | "referral" | null>(null);
  const [saving, setSaving] = useState(false);

  async function loadCircle() {
    const [circleRes, userRes] = await Promise.all([fetch("/api/life-circle"), fetch("/api/user")]);
    const circleData = (await circleRes.json()) as LifeCircleSummary;
    const userData = (await userRes.json()) as { user?: { name?: string; id?: string } };
    setCircle(circleData);
    setUserName(userData.user?.name ?? null);
    setUserId(userData.user?.id ?? null);
    setLoading(false);
  }

  useEffect(() => {
    loadCircle();
  }, []);

  async function addMember() {
    if (!newName.trim()) return;
    setSaving(true);
    setError("");
    const res = await fetch("/api/life-circle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: newName.trim(), relationship: newRelationship }),
    });
    const data = (await res.json()) as LifeCircleSummary & { error?: string };
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Could not add member.");
      return;
    }
    setCircle(data);
    setNewName("");
  }

  async function updateMember(member: LifeCircleMemberPayload, relationship: LifeCircleRelationship) {
    const res = await fetch("/api/life-circle", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: member.id, relationship }),
    });
    if (res.ok) setCircle((await res.json()) as LifeCircleSummary);
  }

  async function removeMember(id: string) {
    const res = await fetch("/api/life-circle", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) setCircle((await res.json()) as LifeCircleSummary);
  }

  async function copyCircleInvite() {
    if (!userId || !newName.trim()) {
      setError("Add their name first, then copy the invite.");
      return;
    }
    const url = buildLifeCircleInviteUrl(userId, inviteRelationship, window.location.origin);
    const text = formatLifeCircleInviteMessage(
      newName.trim(),
      userName,
      url,
      inviteRelationship
    );
    await navigator.clipboard.writeText(text);
    setCopied("friend");
    setTimeout(() => setCopied(null), 2000);
  }

  async function copyReferralInvite() {
    if (!userId) return;
    const url = buildReferralInviteUrl(userId, window.location.origin);
    const text = `Join me on MotiveLife — the AI life coach that helps you move forward every day. Sign up free: ${url}`;
    await navigator.clipboard.writeText(text);
    setCopied("referral");
    setTimeout(() => setCopied(null), 2000);
  }

  if (loading) {
    return <div className="h-48 animate-pulse rounded-xl bg-forward-100" />;
  }

  const members = circle?.members ?? [];
  const slotsLeft = MAX_LIFE_CIRCLE_MEMBERS - members.length;

  return (
    <Card className="p-6">
      <CardHeading>My Life Circle</CardHeading>
      <p className="mt-1 text-sm text-forward-500">
        Invite friends and family. See each other&apos;s streaks, say hello, and cheer each other on.
      </p>

      <div className="mt-4 rounded-xl border border-brand-purple/20 bg-brand-purple/5 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-purple">
          Invite & earn AI
        </p>
        <p className="mt-1 text-sm text-forward-700">
          Each friend who joins earns you{" "}
          <span className="font-semibold">+{REFERRAL_BONUS_VOICE_UNITS} voice organizes</span> this
          month.
          {circle && circle.referralCount > 0 && (
            <span className="text-forward-500"> · {circle.referralCount} joined so far</span>
          )}
        </p>
        <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={copyReferralInvite}>
          {copied === "referral" ? "Copied!" : "Copy referral link"}
        </Button>
      </div>

      <div className="mt-6 space-y-3">
        {members.map((member) => (
          <div
            key={member.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-forward-200 px-3 py-3"
          >
            <div>
              <p className="text-sm font-semibold text-forward-900">{member.displayName}</p>
              <p className="text-xs text-forward-500">
                {relationshipLabel(member.relationship)}
                {member.linkedUserId ? " · On MotiveLife" : " · Invite pending"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={member.relationship}
                onChange={(e) =>
                  updateMember(member, e.target.value as LifeCircleRelationship)
                }
                className="w-auto min-w-[7rem] text-sm"
              >
                <option value="FRIEND">Friend</option>
                <option value="FAMILY">Family</option>
              </Select>
              <Button type="button" variant="ghost" size="sm" onClick={() => removeMember(member.id)}>
                Remove
              </Button>
            </div>
          </div>
        ))}
      </div>

      {slotsLeft > 0 && (
        <div className="mt-6 rounded-xl border border-dashed border-forward-200 px-4 py-4">
          <p className="text-sm font-medium text-forward-800">Add someone ({slotsLeft} slots left)</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Their first name"
            />
            <Select
              value={newRelationship}
              onChange={(e) => setNewRelationship(e.target.value as LifeCircleRelationship)}
            >
              <option value="FRIEND">Friend</option>
              <option value="FAMILY">Family member</option>
            </Select>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" size="sm" disabled={saving || !newName.trim()} onClick={addMember}>
              {saving ? "..." : "Add to circle"}
            </Button>
            <Select
              value={inviteRelationship}
              onChange={(e) => setInviteRelationship(e.target.value as LifeCircleRelationship)}
              className="w-auto min-w-[8rem] text-sm"
            >
              <option value="FRIEND">Invite as friend</option>
              <option value="FAMILY">Invite as family</option>
            </Select>
            <Button type="button" variant="ghost" size="sm" onClick={copyCircleInvite}>
              {copied === "friend" ? "Copied!" : "Copy invite message"}
            </Button>
          </div>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </Card>
  );
}
