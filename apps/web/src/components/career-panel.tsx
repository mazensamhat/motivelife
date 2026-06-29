"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "./button";
import { Card, CardHeading, CardTitle } from "./card";
import { Input, Select } from "./input";
import {
  APPLICATION_STATUSES,
  APPLICATION_STATUS_LABELS,
  type ApplicationStatus,
} from "@forward/shared";
import { cn } from "@/lib/utils";
import { InterviewPrep } from "./interview-prep";
import { parsePrepChecklist } from "@forward/ai";

interface Application {
  id: string;
  company: string;
  role: string;
  status: ApplicationStatus;
  appliedAt: string | null;
  interviewAt: string | null;
  url: string | null;
  notes: string | null;
  nextStep: string | null;
  prepChecklist: string | null;
  prepNotes: string | null;
  goal?: { id: string; title: string } | null;
}

interface Goal {
  id: string;
  title: string;
}

const STATUS_COLORS: Record<ApplicationStatus, string> = {
  SAVED: "bg-forward-100 text-forward-600",
  APPLIED: "bg-blue-50 text-blue-700",
  INTERVIEW: "bg-amber-50 text-amber-800",
  OFFER: "bg-green-50 text-green-700",
  REJECTED: "bg-red-50 text-red-600",
  WITHDRAWN: "bg-forward-100 text-forward-400",
};

export function CareerPanel() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [goalId, setGoalId] = useState("");
  const [url, setUrl] = useState("");
  const [nextStep, setNextStep] = useState("");

  async function load() {
    const [appsRes, goalsRes] = await Promise.all([
      fetch("/api/career"),
      fetch("/api/goals"),
    ]);
    const appsData = await appsRes.json();
    const goalsData = await goalsRes.json();
    setApplications(appsData.applications ?? []);
    setGoals((goalsData.goals ?? []).filter((g: { domain: string }) => g.domain === "CAREER"));
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function createApplication(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/career", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        company,
        role,
        goalId: goalId || undefined,
        url: url || undefined,
        nextStep: nextStep || undefined,
      }),
    });
    setCompany("");
    setRole("");
    setGoalId("");
    setUrl("");
    setNextStep("");
    setShowForm(false);
    load();
  }

  async function updateStatus(id: string, status: ApplicationStatus) {
    await fetch("/api/career", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    load();
  }

  async function remove(id: string) {
    await fetch("/api/career", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    load();
  }

  const active = applications.filter((a) => !["REJECTED", "WITHDRAWN"].includes(a.status));
  const pipeline = APPLICATION_STATUSES.filter((s) => s !== "WITHDRAWN");

  if (loading) {
    return <div className="h-48 animate-pulse rounded-xl bg-forward-100" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <CardHeading>Job applications</CardHeading>
          <p className="mt-1 text-sm text-forward-500">
            Career Agent tracks your pipeline and suggests next steps.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "Add application"}
        </Button>
      </div>

      {active.length === 0 && !showForm && (
        <Card>
          <p className="text-sm text-forward-500">
            No applications yet. Add a role you&apos;re targeting — motivelife.ai will help you stay on
            track.
          </p>
          {goals.length === 0 && (
            <p className="mt-2 text-sm text-forward-500">
              Tip: create a{" "}
              <Link href="/dashboard#life-gps" className="text-accent hover:underline">
                career goal
              </Link>{" "}
              to connect applications to your Progress Graph.
            </p>
          )}
        </Card>
      )}

      {showForm && (
        <Card>
          <form onSubmit={createApplication} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">Company</label>
                <Input
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="Stripe"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Role</label>
                <Input
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder="Software Engineer Intern"
                  required
                />
              </div>
            </div>
            {goals.length > 0 && (
              <div>
                <label className="mb-1 block text-sm font-medium">Link to career goal</label>
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
            <div>
              <label className="mb-1 block text-sm font-medium">Job URL (optional)</label>
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://..."
                type="url"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Next step (optional)</label>
              <Input
                value={nextStep}
                onChange={(e) => setNextStep(e.target.value)}
                placeholder="Tailor resume for this role"
              />
            </div>
            <Button type="submit">Save application</Button>
          </form>
        </Card>
      )}

      {active.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-5">
          {pipeline.slice(0, 5).map((status) => {
            const count = active.filter((a) => a.status === status).length;
            return (
              <Card key={status} className="p-3 text-center">
                <CardTitle>{APPLICATION_STATUS_LABELS[status]}</CardTitle>
                <p className="mt-1 text-xl font-semibold text-forward-900">{count}</p>
              </Card>
            );
          })}
        </div>
      )}

      <div className="space-y-3">
        {applications.map((app) => (
          <Card key={app.id} className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-forward-900">{app.company}</p>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-medium",
                      STATUS_COLORS[app.status]
                    )}
                  >
                    {APPLICATION_STATUS_LABELS[app.status]}
                  </span>
                </div>
                <p className="text-sm text-forward-600">{app.role}</p>
                {app.goal && (
                  <p className="mt-1 text-xs text-forward-400">Goal: {app.goal.title}</p>
                )}
                {app.nextStep && (
                  <p className="mt-2 text-sm text-forward-700">
                    Next: {app.nextStep}
                  </p>
                )}
                {app.url && (
                  <a
                    href={app.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-block text-xs text-accent hover:underline"
                  >
                    View posting
                  </a>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {app.status === "SAVED" && (
                  <Button size="sm" onClick={() => updateStatus(app.id, "APPLIED")}>
                    Mark applied
                  </Button>
                )}
                {app.status === "APPLIED" && (
                  <Button size="sm" onClick={() => updateStatus(app.id, "INTERVIEW")}>
                    Got interview
                  </Button>
                )}
                {app.status === "INTERVIEW" && (
                  <Button size="sm" onClick={() => updateStatus(app.id, "OFFER")}>
                    Got offer
                  </Button>
                )}
                {!["REJECTED", "WITHDRAWN", "OFFER"].includes(app.status) && (
                  <Button size="sm" variant="ghost" onClick={() => updateStatus(app.id, "REJECTED")}>
                    Rejected
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => remove(app.id)}>
                  Remove
                </Button>
              </div>
            </div>
            {app.status === "INTERVIEW" && (
              <InterviewPrep
                applicationId={app.id}
                company={app.company}
                role={app.role}
                interviewAt={app.interviewAt}
                prepChecklist={parsePrepChecklist(app.prepChecklist, app.company, app.role)}
                prepNotes={app.prepNotes}
                onUpdate={load}
              />
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
