"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "./button";
import { Card, CardHeading, CardTitle } from "./card";
import { Input, Select } from "./input";
import {
  MONEY_ITEM_TYPES,
  MONEY_TYPE_LABELS,
  type MoneyItemType,
} from "@forward/shared";
import { cn } from "@/lib/utils";
import { readApiJson } from "@/lib/fetch-api";

interface MoneyItem {
  id: string;
  type: MoneyItemType;
  title: string;
  targetAmount: number | null;
  currentAmount: number;
  dueDay: number | null;
  targetDate: string | null;
  notes: string | null;
  goal?: { id: string; title: string } | null;
}

interface Goal {
  id: string;
  title: string;
  domain: string;
}

function formatMoney(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function progressPercent(item: MoneyItem) {
  if (!item.targetAmount || item.targetAmount <= 0) return null;
  if (item.type === "DEBT") {
    return Math.max(0, Math.round((1 - item.currentAmount / item.targetAmount) * 100));
  }
  return Math.min(100, Math.round((item.currentAmount / item.targetAmount) * 100));
}

export function MoneyPanel() {
  const [items, setItems] = useState<MoneyItem[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState<MoneyItemType>("SAVINGS");
  const [title, setTitle] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [currentAmount, setCurrentAmount] = useState("");
  const [dueDay, setDueDay] = useState("");
  const [goalId, setGoalId] = useState("");

  async function load() {
    const [moneyRes, goalsRes] = await Promise.all([
      fetch("/api/money"),
      fetch("/api/goals"),
    ]);
    const moneyData = await readApiJson<{ items?: MoneyItem[] }>(moneyRes);
    const goalsData = await readApiJson<{ goals?: Goal[] }>(goalsRes);
    setItems(moneyData?.items ?? []);
    setGoals((goalsData?.goals ?? []).filter((g) => g.domain === "MONEY"));
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function createItem(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/money", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        title,
        targetAmount: targetAmount ? parseFloat(targetAmount) : undefined,
        currentAmount: currentAmount ? parseFloat(currentAmount) : undefined,
        dueDay: dueDay ? parseInt(dueDay, 10) : undefined,
        goalId: goalId || undefined,
      }),
    });
    setTitle("");
    setTargetAmount("");
    setCurrentAmount("");
    setDueDay("");
    setGoalId("");
    setShowForm(false);
    load();
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
    load();
  }

  async function remove(id: string) {
    await fetch("/api/money", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    load();
  }

  if (loading) {
    return <div className="h-48 animate-pulse rounded-xl bg-forward-100" />;
  }

  const byType = MONEY_ITEM_TYPES.map((t) => ({
    type: t,
    items: items.filter((i) => i.type === t),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <CardHeading>Money</CardHeading>
          <p className="mt-1 text-sm text-forward-500">
            Money Agent connects your finances to your goals — no bank login required.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "Add item"}
        </Button>
      </div>

      {items.length === 0 && !showForm && (
        <Card>
          <p className="text-sm text-forward-500">
            Track a savings goal, debt, or bill. motivelife.ai will remind you when action is needed.
          </p>
          <Link href="/dashboard#life-gps" className="mt-2 inline-block text-sm text-accent hover:underline">
            Create a money goal →
          </Link>
        </Card>
      )}

      {showForm && (
        <Card>
          <form onSubmit={createItem} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">Type</label>
                <Select value={type} onChange={(e) => setType(e.target.value as MoneyItemType)}>
                  {MONEY_ITEM_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {MONEY_TYPE_LABELS[t]}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Title</label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={
                    type === "SAVINGS"
                      ? "Emergency fund"
                      : type === "DEBT"
                        ? "Student loans"
                        : "Rent"
                  }
                  required
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {(type === "SAVINGS" || type === "DEBT") && (
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    {type === "SAVINGS" ? "Target amount" : "Original balance"}
                  </label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={targetAmount}
                    onChange={(e) => setTargetAmount(e.target.value)}
                    placeholder="10000"
                  />
                </div>
              )}
              <div>
                <label className="mb-1 block text-sm font-medium">
                  {type === "SAVINGS" ? "Saved so far" : type === "DEBT" ? "Remaining balance" : "Amount"}
                </label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={currentAmount}
                  onChange={(e) => setCurrentAmount(e.target.value)}
                  placeholder={type === "BILL" ? "1200" : "0"}
                />
              </div>
            </div>
            {type === "BILL" && (
              <div>
                <label className="mb-1 block text-sm font-medium">Due day of month (1–31)</label>
                <Input
                  type="number"
                  min="1"
                  max="31"
                  value={dueDay}
                  onChange={(e) => setDueDay(e.target.value)}
                  placeholder="1"
                />
              </div>
            )}
            {goals.length > 0 && (
              <div>
                <label className="mb-1 block text-sm font-medium">Link to money goal</label>
                <Select value={goalId} onChange={(e) => setGoalId(e.target.value)}>
                  <option value="">None</option>
                  {goals.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.title}
                    </option>
                  ))}
                </Select>
              </div>
            )}
            <Button type="submit">Add</Button>
          </form>
        </Card>
      )}

      {byType.map(
        ({ type: t, items: group }) =>
          group.length > 0 && (
            <div key={t}>
              <h3 className="mb-3 text-sm font-medium text-forward-500">{MONEY_TYPE_LABELS[t]}</h3>
              <div className="space-y-3">
                {group.map((item) => {
                  const pct = progressPercent(item);
                  return (
                    <Card key={item.id} className="p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-forward-900">{item.title}</p>
                          <p className="mt-1 text-sm text-forward-600">
                            {item.type === "SAVINGS" && (
                              <>
                                {formatMoney(item.currentAmount)}
                                {item.targetAmount != null && ` of ${formatMoney(item.targetAmount)}`}
                              </>
                            )}
                            {item.type === "DEBT" && (
                              <>
                                {formatMoney(item.currentAmount)} remaining
                                {item.targetAmount != null &&
                                  ` · started at ${formatMoney(item.targetAmount)}`}
                              </>
                            )}
                            {item.type === "BILL" && (
                              <>
                                {formatMoney(item.currentAmount)}
                                {item.dueDay != null && ` · due on the ${item.dueDay}th`}
                              </>
                            )}
                          </p>
                          {pct != null && (
                            <div className="mt-3">
                              <div className="flex justify-between text-xs text-forward-500">
                                <span>Progress</span>
                                <span>{pct}%</span>
                              </div>
                              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-forward-100">
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
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {(item.type === "SAVINGS" || item.type === "DEBT") && (
                            <>
                              <Button size="sm" variant="secondary" onClick={() => updateAmount(item.id, item.type === "SAVINGS" ? 50 : -50)}>
                                {item.type === "SAVINGS" ? "+$50" : "−$50"}
                              </Button>
                              <Button size="sm" variant="secondary" onClick={() => updateAmount(item.id, item.type === "SAVINGS" ? 100 : -100)}>
                                {item.type === "SAVINGS" ? "+$100" : "−$100"}
                              </Button>
                            </>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => remove(item.id)}>
                            Remove
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
