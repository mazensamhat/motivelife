"use client";

import { useState } from "react";
import { Button } from "./button";
import { Card, CardTitle } from "./card";
import { Input, Textarea } from "./input";
import type { PrepChecklistItem } from "@forward/shared";
import { interviewPrepProgress } from "@forward/ai";

interface InterviewPrepProps {
  applicationId: string;
  company: string;
  role: string;
  interviewAt: string | null;
  prepChecklist: PrepChecklistItem[];
  prepNotes: string | null;
  onUpdate: () => void;
}

export function InterviewPrep({
  applicationId,
  company,
  role,
  interviewAt,
  prepChecklist: initialChecklist,
  prepNotes: initialNotes,
  onUpdate,
}: InterviewPrepProps) {
  const [checklist, setChecklist] = useState(initialChecklist);
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [interviewDate, setInterviewDate] = useState(
    interviewAt ? new Date(interviewAt).toISOString().slice(0, 16) : ""
  );
  const progress = interviewPrepProgress(checklist);

  async function save(updates: {
    prepChecklist?: PrepChecklistItem[];
    prepNotes?: string;
    interviewAt?: string | null;
  }) {
    await fetch("/api/career", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: applicationId, ...updates }),
    });
    onUpdate();
  }

  function toggleItem(id: string) {
    const next = checklist.map((item) =>
      item.id === id ? { ...item, done: !item.done } : item
    );
    setChecklist(next);
    save({ prepChecklist: next, prepNotes: notes });
  }

  return (
    <Card className="mt-4 border-amber-200 bg-amber-50/50 p-4">
      <CardTitle>Interview prep — {company}</CardTitle>
      <p className="mt-1 text-sm text-forward-600">{role}</p>

      <div className="mt-3">
        <label className="mb-1 block text-xs font-medium text-forward-500">Interview date & time</label>
        <Input
          type="datetime-local"
          value={interviewDate}
          onChange={(e) => setInterviewDate(e.target.value)}
          onBlur={() =>
            save({
              interviewAt: interviewDate ? new Date(interviewDate).toISOString() : null,
              prepChecklist: checklist,
              prepNotes: notes,
            })
          }
        />
      </div>

      <div className="mt-4">
        <div className="flex justify-between text-xs text-forward-500">
          <span>Prep checklist</span>
          <span>{progress}%</span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-forward-100">
          <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${progress}%` }} />
        </div>
        <ul className="mt-3 space-y-2">
          {checklist.map((item) => (
            <li key={item.id} className="flex items-start gap-2">
              <button
                type="button"
                onClick={() => toggleItem(item.id)}
                className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                  item.done ? "border-green-500 bg-green-500 text-white" : "border-forward-300"
                }`}
              >
                {item.done ? "✓" : ""}
              </button>
              <span className={`text-sm ${item.done ? "text-forward-400 line-through" : "text-forward-800"}`}>
                {item.label}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4">
        <label className="mb-1 block text-xs font-medium text-forward-500">Your notes</label>
        <Textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => save({ prepNotes: notes, prepChecklist: checklist })}
          placeholder="Key talking points, questions to ask..."
        />
      </div>
    </Card>
  );
}
