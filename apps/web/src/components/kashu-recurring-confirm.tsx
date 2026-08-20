"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, CheckCheck, CheckSquare, Square } from "lucide-react";
import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { cn } from "@/lib/utils";
import { readApiError, readApiJson } from "@/lib/fetch-api";
import { notifyKashuUpdated } from "@/lib/money-events";

export type KashuRecurringCandidate = {
  id: string;
  title: string;
  amount: number;
  frequency: string;
  confidence: number;
  nextDueDate: string | null;
  priority: string;
};

type EditRow = {
  title: string;
  amount: string;
  frequency: string;
  priority: string;
  nextDueDate: string;
};

async function fetchJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  if (!res.ok) throw new Error(await readApiError(res));
  const data = await readApiJson<T>(res);
  if (!data) throw new Error("Empty response");
  return data;
}

function editFromCandidate(c: KashuRecurringCandidate): EditRow {
  return {
    title: c.title,
    amount: String(c.amount),
    frequency: c.frequency,
    priority: c.priority,
    nextDueDate: c.nextDueDate ? c.nextDueDate.slice(0, 10) : "",
  };
}

function confirmBody(id: string, edit: EditRow) {
  const body: Record<string, unknown> = {
    id,
    action: "confirm",
    title: edit.title.trim(),
    amount: Number(edit.amount),
    frequency: edit.frequency,
    priority: edit.priority,
    nextDueDate: edit.nextDueDate
      ? new Date(`${edit.nextDueDate}T12:00:00`).toISOString()
      : null,
  };
  if (edit.frequency === "BIWEEKLY") body.intervalDays = 14;
  if (edit.frequency === "WEEKLY") body.intervalDays = 7;
  return body;
}

/** Confirm every pending candidate with default/edited fields (no UI). */
export async function confirmAllRecurringCandidates(
  candidates: KashuRecurringCandidate[],
  edits?: Record<string, EditRow>
) {
  for (const c of candidates) {
    const edit = edits?.[c.id] ?? editFromCandidate(c);
    await fetchJson("/api/kashu/recurring", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(confirmBody(c.id, edit)),
    });
  }
}

/**
 * Review / select / confirm pending statement recurrings so Timing & calendar unlock.
 */
export function KashuRecurringConfirmPanel({
  candidates,
  busy,
  setBusy,
  setNotice,
  setError,
  onDone,
  onOpenCalendar,
  compact = false,
}: {
  candidates: KashuRecurringCandidate[];
  busy: boolean;
  setBusy: (v: boolean) => void;
  setNotice: (v: string | null) => void;
  setError: (v: string | null) => void;
  onDone: () => Promise<void>;
  onOpenCalendar?: () => void;
  compact?: boolean;
}) {
  const [edits, setEdits] = useState<Record<string, EditRow>>({});
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setEdits((prev) => {
      const next = { ...prev };
      for (const c of candidates) {
        if (!next[c.id]) {
          next[c.id] = {
            title: c.title,
            amount: String(c.amount),
            frequency: c.frequency,
            priority: c.priority,
            nextDueDate: c.nextDueDate ? c.nextDueDate.slice(0, 10) : "",
          };
        }
      }
      return next;
    });
    setSelected((prev) => {
      const next: Record<string, boolean> = {};
      for (const c of candidates) {
        next[c.id] = prev[c.id] ?? true;
      }
      return next;
    });
  }, [candidates]);

  const selectedIds = useMemo(
    () => candidates.filter((c) => selected[c.id]).map((c) => c.id),
    [candidates, selected]
  );
  const allSelected = candidates.length > 0 && selectedIds.length === candidates.length;
  const someSelected = selectedIds.length > 0;

  function toggleAll(on: boolean) {
    const next: Record<string, boolean> = {};
    for (const c of candidates) next[c.id] = on;
    setSelected(next);
  }

  async function act(id: string, action: "confirm" | "dismiss") {
    setBusy(true);
    setError(null);
    try {
      const edit = edits[id];
      const body: Record<string, unknown> =
        action === "confirm" && edit
          ? confirmBody(id, edit)
          : { id, action };
      await fetchJson("/api/kashu/recurring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      await onDone();
      notifyKashuUpdated({ source: "recurring-confirm" });
      setNotice(action === "confirm" ? "Added to your cash calendar." : "Dismissed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmIds(ids: string[], openCalendar: boolean) {
    if (ids.length === 0) {
      if (openCalendar) onOpenCalendar?.();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      for (const id of ids) {
        const c = candidates.find((x) => x.id === id);
        if (!c) continue;
        const edit = edits[id] ?? {
          title: c.title,
          amount: String(c.amount),
          frequency: c.frequency,
          priority: c.priority,
          nextDueDate: c.nextDueDate ? c.nextDueDate.slice(0, 10) : "",
        };
        await fetchJson("/api/kashu/recurring", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(confirmBody(id, edit)),
        });
      }
      await onDone();
      notifyKashuUpdated({ source: "recurring-confirm-all" });
      setNotice(
        ids.length === 1
          ? "Confirmed 1 bill — Timing can use it now."
          : `Confirmed ${ids.length} bills — Timing can use them now.`
      );
      if (openCalendar) onOpenCalendar?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not confirm bills.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={cn(
        "rounded-[1.75rem] border border-rose-100 bg-white p-4 shadow-sm md:p-6",
        compact && "rounded-2xl shadow-none"
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-black text-slate-900">
            Review &amp; confirm bills
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Confirm recurrings so Timing, calendar, and Safe to Spend unlock. Select all or confirm
            one at a time.
          </p>
        </div>
        {candidates.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() => toggleAll(!allSelected)}
              className="rounded-full"
            >
              {allSelected ? (
                <>
                  <Square className="mr-1 h-3.5 w-3.5" />
                  Deselect all
                </>
              ) : (
                <>
                  <CheckSquare className="mr-1 h-3.5 w-3.5" />
                  Select all
                </>
              )}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={busy || !someSelected}
              onClick={() => void confirmIds(selectedIds, true)}
              className="rounded-full"
            >
              <CheckCheck className="mr-1 h-3.5 w-3.5" />
              Confirm selected ({selectedIds.length})
            </Button>
          </div>
        ) : null}
      </div>

      {candidates.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">
          No pending suggestions. Upload a statement on the Upload tab, then come back here to
          confirm.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {candidates.map((c) => {
            const edit = edits[c.id] ?? {
              title: c.title,
              amount: String(c.amount),
              frequency: c.frequency,
              priority: c.priority,
              nextDueDate: c.nextDueDate ? c.nextDueDate.slice(0, 10) : "",
            };
            const isOn = !!selected[c.id];
            return (
              <li
                key={c.id}
                className={cn(
                  "space-y-3 rounded-2xl border p-3 transition",
                  isOn
                    ? "border-rose-200 bg-gradient-to-br from-rose-50/90 to-orange-50/50 ring-1 ring-rose-100"
                    : "border-slate-200 bg-slate-50/60 opacity-80"
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-800">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-500"
                      checked={isOn}
                      onChange={(e) =>
                        setSelected((prev) => ({ ...prev, [c.id]: e.target.checked }))
                      }
                    />
                    <span>{edit.title || c.title}</span>
                  </label>
                  <p className="text-xs font-bold text-rose-600">
                    {Math.round(c.confidence * 100)}% confidence · {c.frequency}
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="text-xs font-semibold text-slate-600">
                    Name
                    <Input
                      className="mt-1"
                      value={edit.title}
                      onChange={(e) =>
                        setEdits((prev) => ({
                          ...prev,
                          [c.id]: { ...edit, title: e.target.value },
                        }))
                      }
                    />
                  </label>
                  <label className="text-xs font-semibold text-slate-600">
                    Amount
                    <Input
                      className="mt-1"
                      type="number"
                      min={0}
                      step="0.01"
                      value={edit.amount}
                      onChange={(e) =>
                        setEdits((prev) => ({
                          ...prev,
                          [c.id]: { ...edit, amount: e.target.value },
                        }))
                      }
                    />
                  </label>
                  <label className="text-xs font-semibold text-slate-600">
                    Frequency
                    <select
                      className="mt-1 w-full rounded-xl border border-forward-200 px-3 py-2 text-sm"
                      value={edit.frequency}
                      onChange={(e) =>
                        setEdits((prev) => ({
                          ...prev,
                          [c.id]: { ...edit, frequency: e.target.value },
                        }))
                      }
                    >
                      <option value="WEEKLY">Weekly</option>
                      <option value="BIWEEKLY">Every 14 days</option>
                      <option value="SEMI_MONTHLY">Semi-monthly</option>
                      <option value="MONTHLY">Monthly</option>
                      <option value="ANNUAL">Annual</option>
                      <option value="ONE_OFF">One-off</option>
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-slate-600">
                    Priority
                    <select
                      className="mt-1 w-full rounded-xl border border-forward-200 px-3 py-2 text-sm"
                      value={edit.priority}
                      onChange={(e) =>
                        setEdits((prev) => ({
                          ...prev,
                          [c.id]: { ...edit, priority: e.target.value },
                        }))
                      }
                    >
                      <option value="MANDATORY">Mandatory</option>
                      <option value="NECESSARY">Necessary</option>
                      <option value="DISCRETIONARY">Discretionary</option>
                      <option value="LIFESTYLE">Lifestyle</option>
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-slate-600 sm:col-span-2">
                    Next due
                    <Input
                      className="mt-1"
                      type="date"
                      value={edit.nextDueDate}
                      onChange={(e) =>
                        setEdits((prev) => ({
                          ...prev,
                          [c.id]: { ...edit, nextDueDate: e.target.value },
                        }))
                      }
                    />
                  </label>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={busy}
                    onClick={() => void act(c.id, "confirm")}
                    className="rounded-full"
                  >
                    <Check className="mr-1 h-3.5 w-3.5" />
                    Confirm
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => void act(c.id, "dismiss")}
                    className="rounded-full"
                  >
                    Not recurring
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
