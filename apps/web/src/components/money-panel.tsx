"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "./button";
import { Card } from "./card";
import { Input, Select } from "./input";
import {
  MONEY_ITEM_TYPES,
  MONEY_TYPE_GROUPS,
  MONEY_TYPE_LABELS,
  isBalanceAccountType,
  type MoneyItemType,
} from "@forward/shared";
import { cn } from "@/lib/utils";
import { readApiJson } from "@/lib/fetch-api";
import { deriveMoneyActionLabel } from "@/lib/action-rewards";
import { DomainItemActionStrip } from "./domain-item-action-strip";
import { notifyMoneyUpdated } from "@/lib/money-events";

interface MoneyItem {
  id: string;
  type: MoneyItemType;
  title: string;
  targetAmount: number | null;
  currentAmount: number;
  dueDay: number | null;
  targetDate: string | null;
  notes: string | null;
  frequency?: string | null;
  intervalDays?: number | null;
  nextDueDate?: string | null;
  priority?: string | null;
  goal?: { id: string; title: string } | null;
}

interface Goal {
  id: string;
  title: string;
  domain: string;
}

type FormState = {
  type: MoneyItemType;
  title: string;
  targetAmount: string;
  currentAmount: string;
  dueDay: string;
  goalId: string;
  frequency: string;
  intervalDays: string;
  nextDueDate: string;
  priority: string;
};

const EMPTY_FORM: FormState = {
  type: "SUBSCRIPTION",
  title: "",
  targetAmount: "",
  currentAmount: "",
  dueDay: "",
  goalId: "",
  frequency: "MONTHLY",
  intervalDays: "",
  nextDueDate: "",
  priority: "MANDATORY",
};

function formatMoney(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function frequencyLabel(freq: string | null | undefined) {
  switch (freq) {
    case "WEEKLY":
      return "weekly";
    case "BIWEEKLY":
      return "every 14 days";
    case "SEMI_MONTHLY":
      return "semi-monthly";
    case "ANNUAL":
      return "annual";
    case "ONE_OFF":
      return "one-off";
    case "MONTHLY":
    default:
      return "monthly";
  }
}

function progressPercent(item: MoneyItem) {
  if (!item.targetAmount || item.targetAmount <= 0) return null;
  if (item.type === "DEBT") {
    return Math.max(0, Math.round((1 - item.currentAmount / item.targetAmount) * 100));
  }
  return Math.min(100, Math.round((item.currentAmount / item.targetAmount) * 100));
}

function itemSummary(item: MoneyItem) {
  const pct = progressPercent(item);

  let detail = "";
  if (item.type === "DEBT") {
    detail = `${formatMoney(item.currentAmount)} remaining`;
    if (item.targetAmount != null) detail += ` · started at ${formatMoney(item.targetAmount)}`;
  } else if (isBalanceAccountType(item.type) && !item.dueDay) {
    detail = `${formatMoney(item.currentAmount)} balance`;
    if (item.targetAmount != null) detail += ` · goal ${formatMoney(item.targetAmount)}`;
  } else {
    detail = `${formatMoney(item.currentAmount)} · ${frequencyLabel(item.frequency)}`;
    if (item.dueDay != null && (item.frequency === "MONTHLY" || !item.frequency)) {
      detail += ` · due on the ${item.dueDay}th`;
    }
    if (item.nextDueDate) detail += ` · next ${item.nextDueDate.slice(0, 10)}`;
    if (item.priority && item.priority !== "MANDATORY") {
      detail += ` · ${item.priority.toLowerCase()}`;
    }
  }

  return { detail, pct };
}

function itemToForm(item: MoneyItem): FormState {
  return {
    type: item.type,
    title: item.title,
    targetAmount: item.targetAmount != null ? String(item.targetAmount) : "",
    currentAmount: String(item.currentAmount),
    dueDay: item.dueDay != null ? String(item.dueDay) : "",
    goalId: item.goal?.id ?? "",
    frequency: item.frequency ?? "MONTHLY",
    intervalDays: item.intervalDays != null ? String(item.intervalDays) : "",
    nextDueDate: item.nextDueDate ? item.nextDueDate.slice(0, 10) : "",
    priority: item.priority ?? "MANDATORY",
  };
}

function MoneyItemForm({
  form,
  setForm,
  goals,
  submitLabel,
  onSubmit,
  onCancel,
  light = false,
}: {
  form: FormState;
  setForm: (next: FormState | ((prev: FormState) => FormState)) => void;
  goals: Goal[];
  submitLabel: string;
  onSubmit: (e: React.FormEvent) => void;
  onCancel?: () => void;
  light?: boolean;
}) {
  const { type } = form;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4">
        <div>
          <label className="mb-1.5 block text-sm font-semibold">Category</label>
          <Select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value as MoneyItemType })}
            className={light ? "h-11 text-base" : undefined}
          >
            {MONEY_TYPE_GROUPS.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.types.map((t) => (
                  <option key={t} value={t}>
                    {MONEY_TYPE_LABELS[t]}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold">Name</label>
          <Input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Mortgage, Netflix, hydro…"
            required
            className={light ? "h-11 text-base" : undefined}
          />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {(type === "SAVINGS" ||
          type === "DEBT" ||
          type === "INVESTMENT" ||
          type === "RETIREMENT") && (
          <div>
            <label className="mb-1 block text-sm font-medium">
              {type === "DEBT" ? "Original balance" : "Goal / target balance (optional)"}
            </label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.targetAmount}
              onChange={(e) => setForm({ ...form, targetAmount: e.target.value })}
              placeholder="10000"
            />
          </div>
        )}
        <div>
          <label className="mb-1 block text-sm font-medium">
            {type === "DEBT"
              ? "Remaining balance"
              : isBalanceAccountType(type) && !form.dueDay
                ? "Current balance"
                : "Monthly amount"}
          </label>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={form.currentAmount}
            onChange={(e) => setForm({ ...form, currentAmount: e.target.value })}
            placeholder={type === "SUBSCRIPTION" ? "15" : "1200"}
            required
          />
        </div>
      </div>
      {(type === "BILL" ||
        type === "COMMITMENT" ||
        type === "HOUSING" ||
        type === "SUBSCRIPTION" ||
        type === "LIVING_EXPENSE" ||
        type === "SAVINGS" ||
        type === "INVESTMENT" ||
        type === "RETIREMENT") && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Frequency</label>
              <Select
                value={form.frequency}
                onChange={(e) => {
                  const frequency = e.target.value;
                  setForm({
                    ...form,
                    frequency,
                    intervalDays:
                      frequency === "BIWEEKLY"
                        ? form.intervalDays || "14"
                        : frequency === "WEEKLY"
                          ? form.intervalDays || "7"
                          : form.intervalDays,
                  });
                }}
              >
                <option value="WEEKLY">Weekly</option>
                <option value="BIWEEKLY">Every 14 days (biweekly)</option>
                <option value="SEMI_MONTHLY">Semi-monthly</option>
                <option value="MONTHLY">Monthly</option>
                <option value="ANNUAL">Annual</option>
                <option value="ONE_OFF">One-off</option>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Priority</label>
              <Select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
              >
                <option value="MANDATORY">Mandatory</option>
                <option value="NECESSARY">Necessary</option>
                <option value="DISCRETIONARY">Discretionary</option>
                <option value="LIFESTYLE">Lifestyle</option>
              </Select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">
                Due day of month (1–31)
                {isBalanceAccountType(type) ? " — for recurring contributions" : ""}
              </label>
              <Input
                type="number"
                min="1"
                max="31"
                value={form.dueDay}
                onChange={(e) => setForm({ ...form, dueDay: e.target.value })}
                placeholder="1"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Next due date</label>
              <Input
                type="date"
                value={form.nextDueDate}
                onChange={(e) => setForm({ ...form, nextDueDate: e.target.value })}
              />
            </div>
          </div>
          {(form.frequency === "BIWEEKLY" || form.frequency === "WEEKLY") && (
            <div>
              <label className="mb-1 block text-sm font-medium">
                Interval days {form.frequency === "BIWEEKLY" ? "(keep 14)" : "(keep 7)"}
              </label>
              <Input
                type="number"
                min="1"
                value={form.intervalDays}
                onChange={(e) => setForm({ ...form, intervalDays: e.target.value })}
                placeholder={form.frequency === "BIWEEKLY" ? "14" : "7"}
              />
              <p className="mt-1 text-xs text-forward-400">
                Biweekly stays biweekly — Kashu does not convert 14-day payments into monthly bills.
              </p>
            </div>
          )}
        </>
      )}
      {goals.length > 0 && (
        <div>
          <label className="mb-1 block text-sm font-medium">Link to money goal</label>
          <Select value={form.goalId} onChange={(e) => setForm({ ...form, goalId: e.target.value })}>
            <option value="">None</option>
            {goals.map((g) => (
              <option key={g.id} value={g.id}>
                {g.title}
              </option>
            ))}
          </Select>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit">{submitLabel}</Button>
        {onCancel ? (
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}

export function MoneyPanel({ appearance = "default" }: { appearance?: "default" | "light" }) {
  const light = appearance === "light";
  const [items, setItems] = useState<MoneyItem[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState<FormState>(EMPTY_FORM);
  const [editForm, setEditForm] = useState<FormState>(EMPTY_FORM);

  async function load() {
    const [moneyRes, goalsRes] = await Promise.all([fetch("/api/money"), fetch("/api/goals")]);
    const moneyData = await readApiJson<{ items?: MoneyItem[] }>(moneyRes);
    const goalsData = await readApiJson<{ goals?: Goal[] }>(goalsRes);
    setItems(moneyData?.items ?? []);
    setGoals((goalsData?.goals ?? []).filter((g) => g.domain === "MONEY"));
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function formPayload(form: FormState) {
    const nextDueIso = form.nextDueDate
      ? new Date(`${form.nextDueDate}T12:00:00`).toISOString()
      : null;
    return {
      type: form.type,
      title: form.title,
      targetAmount: form.targetAmount ? parseFloat(form.targetAmount) : null,
      currentAmount: form.currentAmount ? parseFloat(form.currentAmount) : 0,
      dueDay: form.dueDay ? parseInt(form.dueDay, 10) : null,
      goalId: form.goalId || null,
      frequency: form.frequency || "MONTHLY",
      intervalDays: form.intervalDays ? parseInt(form.intervalDays, 10) : null,
      nextDueDate: nextDueIso,
      priority: form.priority || "MANDATORY",
    };
  }

  async function createItem(e: React.FormEvent) {
    e.preventDefault();
    const payload = formPayload(createForm);
    await fetch("/api/money", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload,
        targetAmount: payload.targetAmount ?? undefined,
        dueDay: payload.dueDay ?? undefined,
        goalId: payload.goalId ?? undefined,
        intervalDays: payload.intervalDays ?? undefined,
        nextDueDate: payload.nextDueDate ?? undefined,
      }),
    });
    setCreateForm(EMPTY_FORM);
    setShowForm(false);
    await load();
    notifyMoneyUpdated();
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    const payload = formPayload(editForm);
    await fetch("/api/money", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editingId, ...payload }),
    });
    setEditingId(null);
    await load();
    notifyMoneyUpdated();
  }

  async function updateAmount(id: string, delta: number) {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    const next = Math.max(0, item.currentAmount + delta);
    await fetch("/api/money", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, currentAmount: next }),
    });
    await load();
    notifyMoneyUpdated();
  }

  async function remove(id: string) {
    if (!window.confirm("Remove this entry? This cannot be undone.")) return;
    await fetch("/api/money", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (editingId === id) setEditingId(null);
    await load();
    notifyMoneyUpdated();
  }

  function startEdit(item: MoneyItem) {
    setShowForm(false);
    setEditingId(item.id);
    setEditForm(itemToForm(item));
  }

  if (loading) {
    return (
      <div
        className={cn(
          "h-48 animate-pulse rounded-xl",
          light ? "bg-slate-100" : "bg-forward-800"
        )}
      />
    );
  }

  const byType = MONEY_ITEM_TYPES.map((t) => ({
    type: t,
    items: items.filter((i) => i.type === t),
  }));

  const cardClass = light
    ? "border-slate-200 bg-white text-slate-900 shadow-sm"
    : "border-white/10 bg-forward-900 text-white";
  const mutedClass = light ? "text-slate-500" : "text-forward-400";
  const titleClass = light ? "text-slate-900" : "text-white";
  const headingClass = light ? "text-slate-600" : "text-forward-400";

  return (
    <div className={cn("kashu-commitments-list space-y-5", light && "kashu-commitments-list--light")}>
      <div className="flex items-center justify-between">
        <Button
          size="sm"
          className={light ? "h-11 rounded-full" : undefined}
          onClick={() => {
            setShowForm(!showForm);
            setEditingId(null);
          }}
        >
          {showForm ? "Cancel" : "Add commitment or account"}
        </Button>
      </div>

      {items.length === 0 && !showForm && (
        <Card className={cardClass}>
          <p className={cn("text-sm", mutedClass)}>
            Track a savings goal, debt, or bill. MotiveLife will remind you when action is needed.
          </p>
          <Link
            href="/goals"
            className={cn(
              "mt-2 inline-block text-sm hover:underline",
              light ? "text-emerald-700" : "text-accent"
            )}
          >
            Create a money goal →
          </Link>
        </Card>
      )}

      {showForm && (
        <Card className={cn(cardClass, light ? "p-4" : "text-white")}>
          <MoneyItemForm
            form={createForm}
            setForm={setCreateForm}
            goals={goals}
            submitLabel="Add"
            light={light}
            onSubmit={createItem}
            onCancel={() => {
              setShowForm(false);
              setCreateForm(EMPTY_FORM);
            }}
          />
        </Card>
      )}

      {byType.map(
        ({ type: t, items: group }) =>
          group.length > 0 && (
            <div key={t} className="space-y-3">
              <h3 className={cn("text-sm font-bold uppercase tracking-wide", headingClass)}>
                {MONEY_TYPE_LABELS[t]}
              </h3>
              <div className="space-y-3">
                {group.map((item) => {
                  if (editingId === item.id) {
                    return (
                      <Card
                        key={item.id}
                        className={cn(
                          "p-4",
                          light ? cardClass : "border-brand-cyan/30 bg-forward-900 text-white"
                        )}
                      >
                        <p className={cn("mb-3 text-sm font-medium", mutedClass)}>Edit entry</p>
                        <MoneyItemForm
                          form={editForm}
                          setForm={setEditForm}
                          goals={goals}
                          submitLabel="Save changes"
                          light={light}
                          onSubmit={saveEdit}
                          onCancel={() => setEditingId(null)}
                        />
                      </Card>
                    );
                  }

                  const { detail, pct } = itemSummary(item);
                  return (
                    <Card key={item.id} className={cn("p-4", cardClass)}>
                      <div className="flex flex-col gap-3">
                        <div className="min-w-0">
                          <p className={cn("text-base font-semibold", titleClass)}>{item.title}</p>
                          <p className={cn("mt-1 text-sm leading-snug", mutedClass)}>{detail}</p>
                          {pct != null && (
                            <div className="mt-3">
                              <div
                                className={cn(
                                  "flex justify-between text-xs",
                                  light ? "text-slate-500" : "text-forward-500"
                                )}
                              >
                                <span>Progress</span>
                                <span>{pct}%</span>
                              </div>
                              <div
                                className={cn(
                                  "mt-1 h-1.5 overflow-hidden rounded-full",
                                  light ? "bg-slate-100" : "bg-forward-800"
                                )}
                              >
                                <div
                                  className={cn(
                                    "h-full rounded-full transition-all",
                                    item.type === "DEBT" ? "bg-success" : "brand-gradient"
                                  )}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          )}
                          <DomainItemActionStrip
                            title={item.title}
                            domain="money"
                            actionLabel={deriveMoneyActionLabel(item.title, item.type)}
                            progress={pct}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                          {(item.type === "SAVINGS" || item.type === "DEBT") && (
                            <>
                              <Button
                                size="sm"
                                variant="secondary"
                                className="h-10"
                                onClick={() => updateAmount(item.id, item.type === "SAVINGS" ? 50 : -50)}
                              >
                                {item.type === "SAVINGS" ? "+$50" : "−$50"}
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                className="h-10"
                                onClick={() =>
                                  updateAmount(item.id, item.type === "SAVINGS" ? 100 : -100)
                                }
                              >
                                {item.type === "SAVINGS" ? "+$100" : "−$100"}
                              </Button>
                            </>
                          )}
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-10"
                            onClick={() => startEdit(item)}
                            aria-label={`Edit ${item.title}`}
                          >
                            <Pencil size={14} />
                            <span className="ml-1 sm:hidden">Edit</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-10"
                            onClick={() => remove(item.id)}
                            aria-label={`Delete ${item.title}`}
                          >
                            <Trash2 size={14} />
                            <span className="ml-1 sm:hidden">Delete</span>
                          </Button>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          )
      )}
    </div>
  );
}
