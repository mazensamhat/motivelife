"use client";

import { useState } from "react";
import { Button } from "./button";
import { Input } from "./input";
import { Card, CardHeading } from "./card";

export function DeleteAccountSettings() {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleDelete(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (confirmation !== "DELETE") {
      setError('Type DELETE in all caps to confirm.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password, confirmation }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not delete account.");
        return;
      }
      window.location.href = "/?accountDeleted=1";
    } catch {
      setError("Could not reach the server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="border-red-100">
      <CardHeading>Delete account</CardHeading>
      <p className="mt-1 text-sm text-forward-500">
        Permanently delete your MotiveLife account and associated personal data. This cannot be
        undone.
      </p>

      {!open ? (
        <Button
          type="button"
          variant="danger"
          className="mt-4"
          onClick={() => setOpen(true)}
        >
          Delete my account
        </Button>
      ) : (
        <form onSubmit={handleDelete} className="mt-4 space-y-3">
          <p className="text-sm text-forward-700">
            To confirm, type <span className="font-semibold">DELETE</span> and enter your password.
          </p>
          <div>
            <label className="mb-1 block text-sm font-medium text-forward-700">Confirmation</label>
            <Input
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              placeholder="DELETE"
              required
              autoComplete="off"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-forward-700">Password</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="danger" disabled={loading}>
              {loading ? "Deleting…" : "Permanently delete account"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={loading}
              onClick={() => {
                setOpen(false);
                setPassword("");
                setConfirmation("");
                setError("");
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}
