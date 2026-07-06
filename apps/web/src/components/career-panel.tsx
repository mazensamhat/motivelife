"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, Target } from "lucide-react";
import { Button } from "./button";
import { Card, CardHeading, CardTitle } from "./card";
import { Input, Select } from "./input";
import {
  APPLICATION_STATUSES,
  APPLICATION_STATUS_LABELS,
  type ApplicationStatus,
  type CareerResumeMeta,
  type TailoredCareerBriefing,
} from "@forward/shared";
import { cn } from "@/lib/utils";
import { DomainItemActionStrip } from "./domain-item-action-strip";
import { InterviewPrep } from "./interview-prep";
import { CareerResumePanel } from "./career-resume-panel";
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
  tailoredBriefing: string | null;
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

function parseTailored(raw: string | null): TailoredCareerBriefing | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as TailoredCareerBriefing;
  } catch {
    return null;
  }
}

export function CareerPanel() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [resume, setResume] = useState<CareerResumeMeta>({
    hasResume: false,
    fileName: null,
    uploadedAt: null,
    excerpt: null,
  });
  const [focusApplicationId, setFocusApplicationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [goalId, setGoalId] = useState("");
  const [url, setUrl] = useState("");
  const [nextStep, setNextStep] = useState("");
  const [tailorBusyId, setTailorBusyId] = useState<string | null>(null);

  async function load() {
    const [appsRes, goalsRes] = await Promise.all([
      fetch("/api/career"),
      fetch("/api/goals"),
    ]);
    const appsData = await appsRes.json();
    const goalsData = await goalsRes.json();
    setApplications(appsData.applications ?? []);
    setResume(
      appsData.resume ?? {
        hasResume: false,
        fileName: null,
        uploadedAt: null,
        excerpt: null,
      }
    );
    setFocusApplicationId(appsData.focusApplicationId ?? null);
    setGoals((goalsData.goals ?? []).filter((g: { domain: string }) => g.domain === "CAREER"));
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const appId = params.get("app");
    if (!appId || applications.length === 0) return;
    window.setTimeout(() => {
      document.getElementById(`career-app-${appId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 300);
  }, [applications]);

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

  async function setFocus(id: string) {
    await fetch("/api/career", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, focus: true }),
    });
    setFocusApplicationId(id);
  }

  async function tailorForRole(id: string) {
    setTailorBusyId(id);
    try {
      const res = await fetch("/api/career/tailor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId: id }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        window.alert(data.error ?? "Could not tailor briefing.");
        return;
      }
      await load();
    } finally {
      setTailorBusyId(null);
    }
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
      <CareerResumePanel resume={resume} onChange={load} />

      <div className="flex items-center justify-between">
        <div>
          <CardHeading>Job applications</CardHeading>
          <p className="mt-1 text-sm text-forward-500">
            Set a focus role to personalize your Today briefing and Chief of Staff copy.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "Add application"}
        </Button>
      </div>

      {active.length === 0 && !showForm && (
        <Card>
          <p className="text-sm text-forward-500">
            No applications yet. Add a role you&apos;re targeting — MotiveLife will help you stay on
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
        {applications.map((app) => {
          const tailored = parseTailored(app.tailoredBriefing);
          const isFocus = focusApplicationId === app.id;

          return (
            <div key={app.id} id={`career-app-${app.id}`} className="scroll-mt-24">
              <Card className={cn("p-4", isFocus && "ring-2 ring-brand-cyan/40")}>
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
                      {isFocus ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-brand-cyan/15 px-2 py-0.5 text-xs font-medium text-teal-700">
                          <Target className="h-3 w-3" />
                          Chief of Staff focus
                        </span>
                      ) : null}
                    </div>
                    <p className="text-sm text-forward-600">{app.role}</p>
                    {app.goal && (
                      <p className="mt-1 text-xs text-forward-400">Goal: {app.goal.title}</p>
                    )}
                    {app.nextStep && (
                      <p className="mt-2 text-sm text-forward-700">Next: {app.nextStep}</p>
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
                    <DomainItemActionStrip
                      title={app.nextStep ?? `${app.role} at ${app.company}`}
                      domain="career"
                      actionLabel={
                        app.status === "SAVED"
                          ? "Apply now"
                          : app.status === "APPLIED"
                            ? "Follow up"
                            : app.status === "INTERVIEW"
                              ? "Prep for interview"
                              : "Update pipeline"
                      }
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!isFocus && !["REJECTED", "WITHDRAWN"].includes(app.status) ? (
                      <Button size="sm" variant="secondary" onClick={() => setFocus(app.id)}>
                        Set focus
                      </Button>
                    ) : null}
                    {!["REJECTED", "WITHDRAWN", "OFFER"].includes(app.status) ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={!resume.hasResume || tailorBusyId === app.id}
                        onClick={() => tailorForRole(app.id)}
                      >
                        <Sparkles className="mr-1 h-3.5 w-3.5" />
                        {tailorBusyId === app.id ? "Tailoring…" : "Tailor Chief of Staff"}
                      </Button>
                    ) : null}
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

                {tailored ? (
                  <div className="mt-4 rounded-xl border border-brand-blue/20 bg-brand-blue/5 p-4">
                    <p className="text-xs font-semibold uppercase tracking-widest text-brand-blue">
                      Tailored Chief of Staff
                    </p>
                    <p className="mt-2 text-sm font-medium text-forward-900">{tailored.chiefOfStaffLine}</p>
                    {tailored.challengeLine ? (
                      <p className="mt-2 text-sm text-forward-600">{tailored.challengeLine}</p>
                    ) : null}
                    {tailored.resumeEdits.length > 0 ? (
                      <ul className="mt-3 space-y-1 text-sm text-forward-700">
                        {tailored.resumeEdits.map((edit) => (
                          <li key={edit} className="flex gap-2">
                            <span className="text-brand-blue">•</span>
                            <span>{edit}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    <p className="mt-3 text-xs text-forward-500">
                      This copy powers your Today dashboard while this role is in focus.
                    </p>
                  </div>
                ) : null}

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
            </div>
          );
        })}
      </div>
    </div>
  );
}
