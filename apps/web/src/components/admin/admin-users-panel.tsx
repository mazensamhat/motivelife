"use client";

import { useCallback, useEffect, useState } from "react";
import { Ban, Check, KeyRound, RefreshCw, Search, Shield, UserCheck } from "lucide-react";
import { Button } from "@/components/button";
import { Input } from "@/components/input";

type AdminUser = {
  id: string;
  email: string;
  name: string | null;
  plan: string;
  status: string;
  disabled: boolean;
  hasStripe: boolean;
  hasSubscription: boolean;
  tasks: number;
  goals: number;
  lastSeenAt: string | null;
  createdAt: string;
};

type StripeStatus = {
  configured: boolean;
  mode: string;
  webhookUrl: string;
  checklist: Array<{ ok: boolean; label: string }>;
};

type EmailStatus = {
  configured: boolean;
  from: string;
  fromAddress: string;
  resetUrlExample: string;
  setupNote: string;
  checklist: Array<{ ok: boolean; label: string }>;
};

export function AdminUsersPanel() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [stripeStatus, setStripeStatus] = useState<StripeStatus | null>(null);
  const [emailStatus, setEmailStatus] = useState<EmailStatus | null>(null);
  const [emailTestLoading, setEmailTestLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = useCallback(async (q = query) => {
    setLoading(true);
    setError("");
    try {
      const params = q ? `?q=${encodeURIComponent(q)}` : "";
      const [usersRes, stripeRes, emailRes] = await Promise.all([
        fetch(`/api/admin/users${params}`),
        fetch("/api/admin/stripe-status"),
        fetch("/api/admin/email-status"),
      ]);
      if (!usersRes.ok) throw new Error("Could not load users");
      const usersData = (await usersRes.json()) as { users: AdminUser[] };
      setUsers(usersData.users);
      if (stripeRes.ok) {
        setStripeStatus((await stripeRes.json()) as StripeStatus);
      }
      if (emailRes.ok) {
        setEmailStatus((await emailRes.json()) as EmailStatus);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void load("");
  }, [load]);

  async function patchUser(id: string, body: Record<string, unknown>) {
    setActionLoading(id);
    setMessage("");
    setError("");
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Update failed");
      setMessage("User updated.");
      setEditingId(null);
      setNewPassword("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setActionLoading(null);
    }
  }

  async function sendEmailTest() {
    setEmailTestLoading(true);
    setMessage("");
    setError("");
    try {
      const res = await fetch("/api/admin/email-test", { method: "POST" });
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) throw new Error(data.error ?? "Test email failed");
      setMessage(data.message ?? "Test email sent.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Test email failed");
    } finally {
      setEmailTestLoading(false);
    }
  }

  return (
    <section className="mb-6 rounded-xl border border-forward-800 bg-forward-900/60 p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Shield size={18} className="text-emerald-400" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-forward-400">
            User management
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-forward-500" />
            <Input
              className="w-56 pl-8"
              placeholder="Search email or name"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load(query)}
            />
          </div>
          <Button variant="secondary" onClick={() => load(query)} disabled={loading} className="bg-forward-800">
            <RefreshCw size={14} className="mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      {stripeStatus && (
        <div
          className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
            stripeStatus.configured
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
              : "border-amber-500/30 bg-amber-500/10 text-amber-100"
          }`}
        >
          <p className="font-medium">
            Stripe {stripeStatus.mode} mode — {stripeStatus.configured ? "ready for payments" : "not fully configured"}
          </p>
          <p className="mt-1 text-xs opacity-80">Webhook: {stripeStatus.webhookUrl}</p>
          <ul className="mt-2 space-y-1 text-xs">
            {stripeStatus.checklist.map((item) => (
              <li key={item.label} className="flex items-center gap-2">
                {item.ok ? <Check size={12} /> : <span className="h-3 w-3 rounded-full bg-amber-400" />}
                {item.label}
              </li>
            ))}
          </ul>
        </div>
      )}

      {emailStatus && (
        <div
          className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
            emailStatus.configured
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
              : "border-amber-500/30 bg-amber-500/10 text-amber-100"
          }`}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-medium">
                Password reset email — {emailStatus.configured ? "ready" : "needs setup"}
              </p>
              <p className="mt-1 text-xs opacity-80">From: {emailStatus.from}</p>
              <p className="mt-1 text-xs opacity-80">Reset links: {emailStatus.resetUrlExample}</p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              className="bg-forward-800 text-xs"
              disabled={emailTestLoading || !emailStatus.checklist[0]?.ok}
              onClick={() => void sendEmailTest()}
            >
              {emailTestLoading ? "Sending…" : "Send test email"}
            </Button>
          </div>
          <ul className="mt-2 space-y-1 text-xs">
            {emailStatus.checklist.map((item) => (
              <li key={item.label} className="flex items-center gap-2">
                {item.ok ? <Check size={12} /> : <span className="h-3 w-3 rounded-full bg-amber-400" />}
                {item.label}
              </li>
            ))}
          </ul>
          {!emailStatus.configured && (
            <p className="mt-2 text-xs opacity-90">{emailStatus.setupNote}</p>
          )}
        </div>
      )}

      {error && <p className="mb-3 text-sm text-red-300">{error}</p>}
      {message && <p className="mb-3 text-sm text-emerald-300">{message}</p>}

      {loading ? (
        <p className="text-forward-400">Loading users…</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-forward-800 text-forward-500">
                <th className="pb-2 pr-3">User</th>
                <th className="pb-2 pr-3">Plan</th>
                <th className="pb-2 pr-3">Status</th>
                <th className="pb-2 pr-3">Stripe</th>
                <th className="pb-2 pr-3">Account</th>
                <th className="pb-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-forward-800/60 text-forward-200">
                  <td className="py-3 pr-3">
                    <div className="font-medium text-white">{u.name ?? "—"}</div>
                    <div className="font-mono text-xs text-forward-500">{u.email}</div>
                  </td>
                  <td className="py-3 pr-3">{u.plan}</td>
                  <td className="py-3 pr-3">{u.status}</td>
                  <td className="py-3 pr-3 text-xs">
                    {u.hasSubscription ? "Subscribed" : u.hasStripe ? "Customer" : "—"}
                  </td>
                  <td className="py-3 pr-3">
                    {u.disabled ? (
                      <span className="text-red-300">Disabled</span>
                    ) : (
                      <span className="text-emerald-300">Active</span>
                    )}
                  </td>
                  <td className="py-3">
                    <div className="flex flex-wrap gap-1">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="bg-forward-800 text-xs"
                        disabled={actionLoading === u.id}
                        onClick={() => {
                          setEditingId(editingId === u.id ? null : u.id);
                          setNewPassword("");
                        }}
                      >
                        <KeyRound size={12} className="mr-1" />
                        Password
                      </Button>
                      {u.plan !== "plus" ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          className="bg-forward-800 text-xs"
                          disabled={actionLoading === u.id}
                          onClick={() =>
                            patchUser(u.id, { subscriptionPlan: "plus", subscriptionStatus: "active" })
                          }
                        >
                          Grant Pro
                        </Button>
                      ) : (
                        <Button
                          variant="secondary"
                          size="sm"
                          className="bg-forward-800 text-xs"
                          disabled={actionLoading === u.id}
                          onClick={() =>
                            patchUser(u.id, { subscriptionPlan: "trial", subscriptionStatus: "active" })
                          }
                        >
                          Revoke Pro
                        </Button>
                      )}
                      {u.disabled ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          className="bg-forward-800 text-xs"
                          disabled={actionLoading === u.id}
                          onClick={() => patchUser(u.id, { disabled: false })}
                        >
                          <UserCheck size={12} className="mr-1" />
                          Enable
                        </Button>
                      ) : (
                        <Button
                          variant="secondary"
                          size="sm"
                          className="bg-forward-800 text-xs text-red-200"
                          disabled={actionLoading === u.id}
                          onClick={() => patchUser(u.id, { disabled: true })}
                        >
                          <Ban size={12} className="mr-1" />
                          Disable
                        </Button>
                      )}
                    </div>
                    {editingId === u.id && (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Input
                          type="password"
                          className="w-48"
                          placeholder="New password (8+ chars)"
                          value={newPassword}
                          minLength={8}
                          onChange={(e) => setNewPassword(e.target.value)}
                        />
                        <Button
                          size="sm"
                          disabled={newPassword.length < 8 || actionLoading === u.id}
                          onClick={() => patchUser(u.id, { password: newPassword })}
                        >
                          Set password
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
