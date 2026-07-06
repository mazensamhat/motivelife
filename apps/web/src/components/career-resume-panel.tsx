"use client";

import { useRef, useState } from "react";
import { FileText, Upload, X } from "lucide-react";
import type { CareerResumeMeta } from "@forward/shared";
import { Button } from "./button";
import { Card, CardHeading } from "./card";

export function CareerResumePanel({
  resume,
  onChange,
}: {
  resume: CareerResumeMeta;
  onChange: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  async function uploadFile(file: File) {
    setBusy(true);
    setMessage(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/career/resume", { method: "POST", body: form });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setMessage(data.error ?? "Upload failed.");
        return;
      }
      setPasteOpen(false);
      setPasteText("");
      onChange();
    } finally {
      setBusy(false);
    }
  }

  async function savePaste(e: React.FormEvent) {
    e.preventDefault();
    if (!pasteText.trim()) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/career/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: pasteText, fileName: "pasted-resume.txt" }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setMessage(data.error ?? "Could not save resume.");
        return;
      }
      setPasteOpen(false);
      setPasteText("");
      onChange();
    } finally {
      setBusy(false);
    }
  }

  async function removeResume() {
    setBusy(true);
    await fetch("/api/career/resume", { method: "DELETE" });
    setBusy(false);
    onChange();
  }

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardHeading className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4 text-brand-blue" />
            Your resume
          </CardHeading>
          <p className="mt-1 text-sm text-forward-500">
            Upload once — MotiveLife tailors your Chief of Staff briefing for each role you target.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.txt,.md,text/plain,text/markdown,application/pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void uploadFile(file);
              e.target.value = "";
            }}
          />
          <Button
            size="sm"
            variant="secondary"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="mr-1.5 h-3.5 w-3.5" />
            {resume.hasResume ? "Replace" : "Upload PDF / TXT"}
          </Button>
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => setPasteOpen(!pasteOpen)}>
            Paste text
          </Button>
          {resume.hasResume ? (
            <Button size="sm" variant="ghost" disabled={busy} onClick={removeResume}>
              <X className="mr-1 h-3.5 w-3.5" />
              Remove
            </Button>
          ) : null}
        </div>
      </div>

      {resume.hasResume ? (
        <div className="mt-4 rounded-lg border border-brand-green/30 bg-brand-green/5 px-3 py-2 text-sm text-forward-700">
          <p className="font-medium text-brand-green">
            {resume.fileName ?? "Resume on file"}
            {resume.uploadedAt
              ? ` · ${new Date(resume.uploadedAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}`
              : null}
          </p>
          {resume.excerpt ? (
            <p className="mt-1 text-xs leading-relaxed text-forward-600">{resume.excerpt}</p>
          ) : null}
        </div>
      ) : null}

      {pasteOpen ? (
        <form onSubmit={savePaste} className="mt-4 space-y-2">
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            rows={8}
            placeholder="Paste your resume text here…"
            className="w-full rounded-lg border border-forward-200 px-3 py-2 text-sm"
          />
          <Button type="submit" size="sm" disabled={busy || !pasteText.trim()}>
            Save resume text
          </Button>
        </form>
      ) : null}

      {message ? <p className="mt-3 text-sm text-red-600">{message}</p> : null}
    </Card>
  );
}
