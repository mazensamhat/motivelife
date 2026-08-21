"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, CheckCheck, CheckSquare, Square } from "lucide-react";
import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { cn } from "@/lib/utils";
import { readApiError, readApiJson } from "@/lib/fetch-api";
import { notifyKashuUpdated, notifyMoneyUpdated } from "@/lib/money-events";

export type KashuRecurringCandidate = {
  id: string;
  title: string;
  amount: number;
  frequency: string;
  confidence: number;
  nextDueDate: string | null;
  priority: string;
  moneyItemId?: string | null;
};

type MoneyCommitment = {
  id: string;
  type: string;
  title: string;
  currentAmount: number;
  dueDay: number | null;
  frequency: string | null;
  priority: string | null;
  nextDueDate: string | null;
  source: string | null;
  notes: string | null;
};

type EditRow = {
  title: string;
  amount: string;
  frequency: string;
  priority: string;
  nextDueDate: string;
  dueDay: string;
  /** What this line is in the money model */
  moneyType: string;
};

function guessMoneyType(title: string, priority: string, frequency: string, existing?: string): string {
  if (existing && existing !== "COMMITMENT") return existing;
  if (/property\s*tax|municipal|city\s*of|windsor/i.test(title)) return "HOUSING";
  if (/mortgage|rent|\bmtg\b/i.test(title)) return "HOUSING";
  if (/loan|lincoln|auto|credit\s*card/i.test(title)) return "DEBT";
  if (priority === "LIFESTYLE" || priority === "DISCRETIONARY") return "LIVING_EXPENSE";
  if (/netflix|spotify|prime|gym|fitness|subscription/i.test(title)) return "SUBSCRIPTION";
  if (frequency === "ANNUAL") return "HOUSING";
  return "BILL";
}

function editFromCandidate(c: KashuRecurringCandidate): EditRow {
  const due =
    c.nextDueDate != null
      ? String(new Date(c.nextDueDate).getUTCDate())
      : "";
  return {
    title: c.title,
    amount: String(c.amount),
    frequency: c.frequency,
    priority: c.priority,
    nextDueDate: c.nextDueDate ? c.nextDueDate.slice(0, 10) : "",
    dueDay: due,
    moneyType: guessMoneyType(c.title, c.priority, c.frequency),
  };
}

function editFromMoney(m: MoneyCommitment): EditRow {
  return {
    title: m.title,
    amount: String(m.currentAmount),
    frequency: m.frequency ?? "MONTHLY",
    priority: m.priority ?? "MANDATORY",
    nextDueDate: m.nextDueDate ? m.nextDueDate.slice(0, 10) : "",
    dueDay: m.dueDay != null ? String(m.dueDay) : "",
    moneyType: guessMoneyType(m.title, m.priority ?? "MANDATORY", m.frequency ?? "MONTHLY", m.type),
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
    moneyType: edit.moneyType,
    nextDueDate: edit.nextDueDate
      ? new Date(`${edit.nextDueDate}T12:00:00`).toISOString()
      : null,
  };
  if (edit.frequency === "BIWEEKLY") body.intervalDays = 14;
  if (edit.frequency === "WEEKLY") body.intervalDays = 7;
  if (edit.dueDay) {
    const n = parseInt(edit.dueDay, 10);
    if (n >= 1 && n <= 31) body.dueDay = n;
  }
  return body;
}

type ReviewRow =
  | { kind: "candidate"; key: string; candidate: KashuRecurringCandidate }
  | { kind: "money"; key: string; money: MoneyCommitment };

const TIMING_READY_MARK = "timing-ready";
const COMMITMENT_TYPES = new Set([
  "BILL",
  "HOUSING",
  "SUBSCRIPTION",
  "COMMITMENT",
  "DEBT",
  "LIVING_EXPENSE",
]);

async function fetchJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  if (!res.ok) throw new Error(await readApiError(res));
  const data = await readApiJson<T>(res);
  if (!data) throw new Error("Empty response");
  return data;
}

function needsTimingReview(m: MoneyCommitment) {
  if (!COMMITMENT_TYPES.has(m.type)) return false;
  if ((m.notes ?? "").includes(TIMING_READY_MARK)) return false;
  // Statement-sourced / auto-pinned / any bill without a locked due day review
  if (m.source === "statement") return true;
  if (/statement|auto-pinned|confirmed from/i.test(m.notes ?? "")) return true;
  if (m.dueDay == null && !m.nextDueDate) return true;
  return false;
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
 * Review / select / confirm bills so Timing & calendar unlock.
 * Shows pending statement suggestions AND statement-sourced money items
 * that still need a due-day confirm (auto-pin used to skip this step).
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
  const [moneyItems, setMoneyItems] = useState<MoneyCommitment[]>([]);
  const [loadingMoney, setLoadingMoney] = useState(true);
  const [incomeCredits, setIncomeCredits] = useState<
    Array<{
      id: string;
      postedAt: string;
      description: string;
      amount: number;
      classification: string | null;
      isTransfer: boolean;
    }>
  >([]);

  const loadMoney = useCallback(async () => {
    setLoadingMoney(true);
    try {
      const data = await fetchJson<{ items: MoneyCommitment[] }>("/api/money");
      setMoneyItems(
        (data.items ?? []).filter((i) => COMMITMENT_TYPES.has(i.type))
      );
    } catch {
      setMoneyItems([]);
    } finally {
      setLoadingMoney(false);
    }
  }, []);

  const loadIncomeCredits = useCallback(async () => {
    try {
      const to = new Date();
      const from = new Date();
      from.setUTCDate(from.getUTCDate() - 75);
      const data = await fetchJson<{
        transactions: Array<{
          id: string;
          postedAt: string;
          description: string;
          amount: number;
          direction: string;
          classification: string | null;
          isTransfer: boolean;
        }>;
      }>(
        `/api/kashu/transactions?from=${from.toISOString().slice(0, 10)}&to=${to.toISOString().slice(0, 10)}&limit=200`
      );
      setIncomeCredits(
        (data.transactions ?? [])
          .filter((t) => t.direction === "credit" && t.amount >= 400)
          .sort((a, b) => b.postedAt.localeCompare(a.postedAt))
          .slice(0, 24)
      );
    } catch {
      setIncomeCredits([]);
    }
  }, []);

  useEffect(() => {
    void loadMoney();
    void loadIncomeCredits();
  }, [loadMoney, loadIncomeCredits, candidates.length]);

  async function classifyIncome(
    id: string,
    classification: "income" | "transfer" | "refund" | "other"
  ) {
    setBusy(true);
    setError(null);
    try {
      await fetchJson("/api/kashu/transactions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          classification,
          isTransfer: classification === "transfer",
          isOneOff: classification !== "income",
        }),
      });
      await loadIncomeCredits();
      notifyKashuUpdated({ source: "income-classify" });
      setNotice(
        classification === "income"
          ? "Marked as payroll / income — calendar will treat it as payday."
          : classification === "transfer"
            ? "Marked as transfer (not payroll)."
            : "Classification updated."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not classify.");
    } finally {
      setBusy(false);
    }
  }

  const reviewMoney = useMemo(() => {
    const pendingTitles = new Set(
      candidates.map((c) => c.title.trim().toLowerCase())
    );
    return moneyItems.filter((m) => {
      if (!needsTimingReview(m)) return false;
      // Prefer the candidate row when the same bill is still pending
      if (pendingTitles.has(m.title.trim().toLowerCase())) return false;
      return true;
    });
  }, [moneyItems, candidates]);

  const rows: ReviewRow[] = useMemo(() => {
    const out: ReviewRow[] = [];
    for (const c of candidates) {
      out.push({ kind: "candidate", key: `c:${c.id}`, candidate: c });
    }
    for (const m of reviewMoney) {
      out.push({ kind: "money", key: `m:${m.id}`, money: m });
    }
    return out;
  }, [candidates, reviewMoney]);

  useEffect(() => {
    setEdits((prev) => {
      const next = { ...prev };
      for (const c of candidates) {
        if (!next[`c:${c.id}`]) next[`c:${c.id}`] = editFromCandidate(c);
      }
      for (const m of reviewMoney) {
        if (!next[`m:${m.id}`]) next[`m:${m.id}`] = editFromMoney(m);
      }
      return next;
    });
    setSelected((prev) => {
      const next: Record<string, boolean> = {};
      for (const row of [
        ...candidates.map((c) => `c:${c.id}`),
        ...reviewMoney.map((m) => `m:${m.id}`),
      ]) {
        next[row] = prev[row] ?? true;
      }
      return next;
    });
  }, [candidates, reviewMoney]);

  const selectedKeys = useMemo(
    () => rows.filter((r) => selected[r.key]).map((r) => r.key),
    [rows, selected]
  );
  const allSelected = rows.length > 0 && selectedKeys.length === rows.length;
  const someSelected = selectedKeys.length > 0;

  function toggleAll(on: boolean) {
    const next: Record<string, boolean> = {};
    for (const r of rows) next[r.key] = on;
    setSelected(next);
  }

  async function confirmCandidate(id: string, edit: EditRow) {
    await fetchJson("/api/kashu/recurring", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(confirmBody(id, edit)),
    });
  }

  async function confirmMoney(id: string, edit: EditRow, existingNotes: string | null) {
    const dueDay = edit.dueDay ? parseInt(edit.dueDay, 10) : null;
    const nextDueIso = edit.nextDueDate
      ? new Date(`${edit.nextDueDate}T12:00:00`).toISOString()
      : null;
    const notesBase = (existingNotes ?? "")
      .replace(/\s*·\s*timing-ready/gi, "")
      .trim();
    const notes = notesBase
      ? `${notesBase} · ${TIMING_READY_MARK}`
      : `User confirmed for Timing · ${TIMING_READY_MARK}`;
    await fetchJson("/api/money", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        type: edit.moneyType,
        title: edit.title.trim(),
        currentAmount: Number(edit.amount),
        frequency: edit.frequency,
        priority: edit.priority,
        dueDay: dueDay != null && dueDay >= 1 && dueDay <= 31 ? dueDay : null,
        nextDueDate: nextDueIso,
        notes,
      }),
    });
  }

  async function dismissCandidate(id: string) {
    setBusy(true);
    setError(null);
    try {
      await fetchJson("/api/kashu/recurring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "dismiss" }),
      });
      await onDone();
      await loadMoney();
      notifyKashuUpdated({ source: "recurring-confirm" });
      setNotice("Dismissed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmOne(row: ReviewRow) {
    setBusy(true);
    setError(null);
    try {
      const edit = edits[row.key];
      if (!edit) throw new Error("Missing edit row.");
      if (row.kind === "candidate") {
        await confirmCandidate(row.candidate.id, edit);
      } else {
        await confirmMoney(row.money.id, edit, row.money.notes);
      }
      await onDone();
      await loadMoney();
      notifyKashuUpdated({ source: "recurring-confirm" });
      notifyMoneyUpdated();
      setNotice("Confirmed — Timing can use this bill.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Confirm failed.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmSelected(openCalendar: boolean) {
    if (selectedKeys.length === 0) {
      if (openCalendar) onOpenCalendar?.();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      for (const key of selectedKeys) {
        const row = rows.find((r) => r.key === key);
        const edit = edits[key];
        if (!row || !edit) continue;
        if (row.kind === "candidate") {
          await confirmCandidate(row.candidate.id, edit);
        } else {
          await confirmMoney(row.money.id, edit, row.money.notes);
        }
      }
      await onDone();
      await loadMoney();
      notifyKashuUpdated({ source: "recurring-confirm-all" });
      notifyMoneyUpdated();
      setNotice(
        selectedKeys.length === 1
          ? "Confirmed 1 bill for Timing."
          : `Confirmed ${selectedKeys.length} bills for Timing.`
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
      id="kashu-confirm-bills"
      className={cn(
        "rounded-[1.75rem] border-2 border-slate-200 bg-white p-4 shadow-md md:p-6",
        compact && "rounded-2xl shadow-none"
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600">
            Required for Timing
          </p>
          <h3 className="text-base font-black text-slate-900">
            Review &amp; confirm bills
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            After upload, classify each line: income is set on credits below; bills need type
            (housing / tax / utility / subscription), frequency, and due day (1–28) so Timing can
            move them.
          </p>
        </div>
        {rows.length > 0 ? (
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
              onClick={() => void confirmSelected(true)}
              className="rounded-full bg-slate-900 hover:bg-slate-800"
            >
              <CheckCheck className="mr-1 h-3.5 w-3.5" />
              Confirm selected ({selectedKeys.length})
            </Button>
          </div>
        ) : null}
      </div>

      {loadingMoney && rows.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">Loading bills to confirm…</p>
      ) : rows.length === 0 ? (
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-900">
          <p className="font-semibold">No bills waiting for confirmation</p>
          <p className="mt-1 text-slate-700/80">
            Upload a statement on the Upload tab if this list is empty. If bills already appear on
            the calendar, open Timing after setting payday in Buffers.
          </p>
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {rows.map((row) => {
            const edit = edits[row.key] ?? {
              title: "",
              amount: "",
              frequency: "MONTHLY",
              priority: "MANDATORY",
              nextDueDate: "",
              dueDay: "",
              moneyType: "BILL",
            };
            const isOn = !!selected[row.key];
            const badge =
              row.kind === "candidate"
                ? `${Math.round(row.candidate.confidence * 100)}% from statement`
                : row.money.source === "statement"
                  ? "On calendar — confirm due day"
                  : "Needs due day for Timing";
            return (
              <li
                key={row.key}
                className={cn(
                  "space-y-3 rounded-2xl border p-3 transition",
                  isOn
                    ? "border-slate-200 bg-white shadow-sm ring-1 ring-slate-100"
                    : "border-slate-200 bg-slate-50/70 opacity-80"
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-800">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-slate-700 focus:ring-emerald-500"
                      checked={isOn}
                      onChange={(e) =>
                        setSelected((prev) => ({ ...prev, [row.key]: e.target.checked }))
                      }
                    />
                    <span>{edit.title || "Bill"}</span>
                  </label>
                  <p className="text-xs font-bold text-slate-700">{badge}</p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  <label className="text-xs font-semibold text-slate-600">
                    Name
                    <Input
                      className="mt-1"
                      value={edit.title}
                      onChange={(e) =>
                        setEdits((prev) => ({
                          ...prev,
                          [row.key]: { ...edit, title: e.target.value },
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
                          [row.key]: { ...edit, amount: e.target.value },
                        }))
                      }
                    />
                  </label>
                  <label className="text-xs font-semibold text-slate-600">
                    Due day (1–28)
                    <Input
                      className="mt-1"
                      type="number"
                      min={1}
                      max={28}
                      value={edit.dueDay}
                      onChange={(e) =>
                        setEdits((prev) => ({
                          ...prev,
                          [row.key]: { ...edit, dueDay: e.target.value },
                        }))
                      }
                      placeholder="e.g. 15"
                    />
                  </label>
                  <label className="text-xs font-semibold text-slate-600">
                    What is this?
                    <select
                      className="mt-1 w-full rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-sm"
                      value={edit.moneyType}
                      onChange={(e) =>
                        setEdits((prev) => ({
                          ...prev,
                          [row.key]: { ...edit, moneyType: e.target.value },
                        }))
                      }
                    >
                      <option value="HOUSING">Housing / rent / mortgage / property tax</option>
                      <option value="BILL">Bill / utility / insurance</option>
                      <option value="SUBSCRIPTION">Subscription</option>
                      <option value="DEBT">Debt / auto loan</option>
                      <option value="LIVING_EXPENSE">Lifestyle / living</option>
                      <option value="COMMITMENT">Other monthly obligation</option>
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-slate-600">
                    Frequency
                    <select
                      className="mt-1 w-full rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-sm"
                      value={edit.frequency}
                      onChange={(e) =>
                        setEdits((prev) => ({
                          ...prev,
                          [row.key]: { ...edit, frequency: e.target.value },
                        }))
                      }
                    >
                      <option value="WEEKLY">Weekly</option>
                      <option value="BIWEEKLY">Every 14 days</option>
                      <option value="SEMI_MONTHLY">Semi-monthly</option>
                      <option value="MONTHLY">Monthly</option>
                      <option value="ANNUAL">Annual (e.g. property tax)</option>
                      <option value="ONE_OFF">One-off</option>
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-slate-600">
                    Priority
                    <select
                      className="mt-1 w-full rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-sm"
                      value={edit.priority}
                      onChange={(e) =>
                        setEdits((prev) => ({
                          ...prev,
                          [row.key]: { ...edit, priority: e.target.value },
                        }))
                      }
                    >
                      <option value="MANDATORY">Mandatory</option>
                      <option value="NECESSARY">Necessary</option>
                      <option value="DISCRETIONARY">Discretionary</option>
                      <option value="LIFESTYLE">Lifestyle</option>
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-slate-600">
                    Next due
                    <Input
                      className="mt-1"
                      type="date"
                      value={edit.nextDueDate}
                      onChange={(e) =>
                        setEdits((prev) => ({
                          ...prev,
                          [row.key]: { ...edit, nextDueDate: e.target.value },
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
                    onClick={() => void confirmOne(row)}
                    className="rounded-full"
                  >
                    <Check className="mr-1 h-3.5 w-3.5" />
                    Confirm
                  </Button>
                  {row.kind === "candidate" ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      onClick={() => void dismissCandidate(row.candidate.id)}
                      className="rounded-full"
                    >
                      Not recurring
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {incomeCredits.length > 0 ? (
        <div className="mt-6 space-y-3 border-t border-amber-200/80 pt-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-700">
              Confirm income deposits
            </p>
            <h4 className="text-sm font-black text-slate-900">
              What&apos;s payroll vs a transfer?
            </h4>
            <p className="mt-1 text-xs text-slate-600">
              Large credits from your statement. Mark Cox / direct deposit as{" "}
              <span className="font-semibold text-slate-700">Income</span>, and family e-transfers
              as <span className="font-semibold text-rose-700">Transfer</span> so they never look like
              payday.
            </p>
          </div>
          <ul className="space-y-2">
            {incomeCredits.map((tx) => {
              const ymd = tx.postedAt.slice(0, 10);
              const label =
                tx.classification === "income"
                  ? "Income"
                  : tx.classification === "transfer" || tx.isTransfer
                    ? "Transfer"
                    : tx.classification === "refund"
                      ? "Refund"
                      : "Unclassified";
              return (
                <li
                  key={tx.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-100 bg-gradient-to-r from-white to-slate-50 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {tx.description.slice(0, 48)}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {ymd} · ${Math.round(tx.amount).toLocaleString()} · {label}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      disabled={busy || tx.classification === "income"}
                      className="rounded-full bg-[var(--kashu-pay)] px-3 text-xs hover:bg-slate-900"
                      onClick={() => void classifyIncome(tx.id, "income")}
                    >
                      Income
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      className="rounded-full px-3 text-xs"
                      onClick={() => void classifyIncome(tx.id, "transfer")}
                    >
                      Transfer
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      className="rounded-full px-3 text-xs"
                      onClick={() => void classifyIncome(tx.id, "other")}
                    >
                      Other
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
