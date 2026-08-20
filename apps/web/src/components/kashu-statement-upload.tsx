"use client";

import { useEffect, useRef, useState, type DragEvent, type FormEvent } from "react";
import { FileUp, Loader2, Sparkles, Upload } from "lucide-react";
import type { KashuStatementScanResult, KashuTxClassification } from "@forward/shared";
import { KASHU_TX_CLASSIFICATIONS } from "@forward/shared";
import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { cn } from "@/lib/utils";
import { readApiError, readApiJson } from "@/lib/fetch-api";
import { notifyMoneyUpdated } from "@/lib/money-events";

type RecurringCandidate = {
  id: string;
  title: string;
  amount: number;
  frequency: string;
  confidence: number;
  nextDueDate: string | null;
  priority: string;
};

type ScanStage =
  | "idle"
  | "reading"
  | "payroll"
  | "bills"
  | "balance"
  | "revealing"
  | "done"
  | "error";

const STAGE_COPY: Record<Exclude<ScanStage, "idle" | "done" | "error">, { emoji: string; label: string }> = {
  reading: { emoji: "📄", label: "Reading your statement…" },
  payroll: { emoji: "🥳", label: "Hunting for payroll & deposits…" },
  bills: { emoji: "🧾", label: "Spotting bills & commitments…" },
  balance: { emoji: "🪙", label: "Checking balance & payday rhythm…" },
  revealing: { emoji: "✨", label: "Lining everything up for your calendar…" },
};

function money(n: number) {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function moneyExact(n: number) {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

async function fetchJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  if (!res.ok) throw new Error(await readApiError(res));
  const data = await readApiJson<T>(res);
  if (!data) throw new Error("Empty response");
  return data;
}

export function KashuStatementUpload({
  candidates,
  busy,
  setBusy,
  setNotice,
  setError,
  onDone,
  onOpenCalendar,
}: {
  candidates: RecurringCandidate[];
  busy: boolean;
  setBusy: (v: boolean) => void;
  setNotice: (v: string | null) => void;
  setError: (v: string | null) => void;
  onDone: () => Promise<void>;
  onOpenCalendar: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [paste, setPaste] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [stage, setStage] = useState<ScanStage>("idle");
  const [stageIndex, setStageIndex] = useState(0);
  const [scanSession, setScanSession] = useState(0);
  const [scan, setScan] = useState<KashuStatementScanResult | null>(null);
  const [revealCount, setRevealCount] = useState(0);
  const [edits, setEdits] = useState<
    Record<
      string,
      { title: string; amount: string; frequency: string; priority: string; nextDueDate: string }
    >
  >({});
  const [transactions, setTransactions] = useState<
    Array<{
      id: string;
      postedAt: string;
      description: string;
      amount: number;
      direction: string;
      classification: string | null;
      isTransfer: boolean;
      isOneOff: boolean;
    }>
  >([]);
  const [txDesc, setTxDesc] = useState("");
  const [txAmount, setTxAmount] = useState("");
  const [txDirection, setTxDirection] = useState<"debit" | "credit">("debit");
  const [txClass, setTxClass] = useState<KashuTxClassification>("discretionary");
  const [txDate, setTxDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [txApplyBalance, setTxApplyBalance] = useState(true);

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
  }, [candidates]);

  useEffect(() => {
    void (async () => {
      try {
        const data = await fetchJson<{ transactions: typeof transactions }>(
          "/api/kashu/transactions?limit=40"
        );
        setTransactions(data.transactions ?? []);
      } catch {
        // Non-fatal
      }
    })();
  }, [candidates.length, scan?.statementId]);

  // Playful stage ticker for the current scan session.
  useEffect(() => {
    if (scanSession === 0) return;
    const order: Array<"reading" | "payroll" | "bills" | "balance"> = [
      "reading",
      "payroll",
      "bills",
      "balance",
    ];
    let i = 0;
    setStageIndex(0);
    setStage("reading");
    const timer = window.setInterval(() => {
      i = Math.min(i + 1, order.length - 1);
      setStageIndex(i);
      setStage((prev) => {
        if (prev === "revealing" || prev === "done" || prev === "error" || prev === "idle") {
          return prev;
        }
        return order[i]!;
      });
    }, 900);
    return () => window.clearInterval(timer);
  }, [scanSession]);

  // Stagger reveal of detected cards after parse.
  useEffect(() => {
    if (stage !== "revealing" || !scan) return;
    const total =
      (scan.payroll?.length ?? 0) +
      (scan.commitments?.length ?? 0) +
      (scan.endingBalance != null || scan.paydayGuess ? 1 : 0);
    if (total <= 0) {
      setStage("done");
      return;
    }
    setRevealCount(0);
    let n = 0;
    const timer = window.setInterval(() => {
      n += 1;
      setRevealCount(n);
      if (n >= total) {
        window.clearInterval(timer);
        setStage("done");
      }
    }, 220);
    return () => window.clearInterval(timer);
  }, [stage, scan]);

  function pickFile(next: File | null) {
    if (!next) return;
    setFile(next);
    setPaste("");
    void runScan({ file: next });
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files?.[0] ?? null;
    if (dropped) pickFile(dropped);
  }

  async function runScan(opts: { file?: File | null; text?: string }) {
    const uploadFile = opts.file ?? file;
    const text = (opts.text ?? paste).trim();
    if (!uploadFile && !text) {
      setError("Drop a PDF/CSV/TXT or paste statement text.");
      return;
    }

    setBusy(true);
    setError(null);
    setNotice(null);
    setScan(null);
    setRevealCount(0);
    setStageIndex(0);
    setScanSession((s) => s + 1);
    setStage("reading");

    try {
      type StatementResponse = KashuStatementScanResult & {
        ok?: boolean;
        scan?: KashuStatementScanResult;
        summary?: string | null;
      };

      let data: StatementResponse;
      if (uploadFile) {
        const form = new FormData();
        form.append("file", uploadFile);
        const res = await fetch("/api/kashu/statement", { method: "POST", body: form });
        if (!res.ok) throw new Error(await readApiError(res));
        const json = await readApiJson<StatementResponse>(res);
        if (!json) throw new Error("Empty response");
        data = json;
      } else {
        data = await fetchJson<StatementResponse>("/api/kashu/statement", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
      }

      const result: KashuStatementScanResult =
        data.scan ??
        ({
          statementId: data.statementId,
          summary: data.summary ?? null,
          endingBalance: data.endingBalance,
          transactionCount: data.transactionCount,
          recurringCandidates: data.recurringCandidates,
          payFrequencyGuess: data.payFrequencyGuess,
          paydayGuess: data.paydayGuess,
          payroll: [],
          commitments: [],
          classificationCounts: {},
        } satisfies KashuStatementScanResult);

      setScan(result);
      setStage("revealing");
      setPaste("");
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      await onDone();
      setNotice(
        `${result.summary ?? "Scan complete."} ${result.transactionCount} txs · ${result.recurringCandidates} new bills spotted.`
      );
    } catch (err) {
      setStage("error");
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  async function act(id: string, action: "confirm" | "dismiss") {
    setBusy(true);
    try {
      const edit = edits[id];
      const body: Record<string, unknown> = { id, action };
      if (action === "confirm" && edit) {
        body.title = edit.title.trim();
        body.amount = Number(edit.amount);
        body.frequency = edit.frequency;
        body.priority = edit.priority;
        body.nextDueDate = edit.nextDueDate
          ? new Date(`${edit.nextDueDate}T12:00:00`).toISOString()
          : null;
        if (edit.frequency === "BIWEEKLY") body.intervalDays = 14;
        if (edit.frequency === "WEEKLY") body.intervalDays = 7;
      }
      await fetchJson("/api/kashu/recurring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      await onDone();
      setNotice(action === "confirm" ? "Added to your cash calendar 🗓️" : "Dismissed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmAllToCalendar() {
    if (candidates.length === 0) {
      onOpenCalendar();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      for (const c of candidates) {
        const edit = edits[c.id] ?? {
          title: c.title,
          amount: String(c.amount),
          frequency: c.frequency,
          priority: c.priority,
          nextDueDate: c.nextDueDate ? c.nextDueDate.slice(0, 10) : "",
        };
        const body: Record<string, unknown> = {
          id: c.id,
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
        await fetchJson("/api/kashu/recurring", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }
      await onDone();
      setNotice(`Confirmed ${candidates.length} commitments — opening calendar.`);
      onOpenCalendar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not confirm all.");
    } finally {
      setBusy(false);
    }
  }

  async function addTransaction(e: FormEvent) {
    e.preventDefault();
    const amount = Number(txAmount);
    if (!txDesc.trim() || !Number.isFinite(amount) || amount <= 0) {
      setError("Add a description and a positive amount.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await fetchJson("/api/kashu/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: txDesc.trim(),
          amount,
          direction: txDirection,
          postedAt: `${txDate}T12:00:00`,
          classification: txClass,
          isTransfer: txClass === "transfer",
          isOneOff: true,
          applyToBalance: txApplyBalance,
        }),
      });
      setTxDesc("");
      setTxAmount("");
      const data = await fetchJson<{ transactions: typeof transactions }>(
        "/api/kashu/transactions?limit=40"
      );
      setTransactions(data.transactions ?? []);
      await onDone();
      notifyMoneyUpdated();
      setNotice("Transaction added.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add transaction.");
    } finally {
      setBusy(false);
    }
  }

  async function reclassify(id: string, classification: KashuTxClassification) {
    setBusy(true);
    try {
      await fetchJson("/api/kashu/transactions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          classification,
          isTransfer: classification === "transfer",
        }),
      });
      const data = await fetchJson<{ transactions: typeof transactions }>(
        "/api/kashu/transactions?limit=40"
      );
      setTransactions(data.transactions ?? []);
      setNotice("Transaction classification updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update classification.");
    } finally {
      setBusy(false);
    }
  }

  const scanning =
    stage === "reading" ||
    stage === "payroll" ||
    stage === "bills" ||
    stage === "balance" ||
    stage === "revealing";
  const stageMeta =
    stage in STAGE_COPY ? STAGE_COPY[stage as keyof typeof STAGE_COPY] : null;

  const payrollHits = scan?.payroll ?? [];
  const commitmentHits = scan?.commitments ?? [];
  const metaCard =
    scan && (scan.endingBalance != null || scan.paydayGuess)
      ? 1
      : 0;
  const payrollReveal = Math.min(revealCount, payrollHits.length);
  const commitmentReveal = Math.max(
    0,
    Math.min(commitmentHits.length, revealCount - payrollHits.length)
  );
  const showMeta = revealCount > payrollHits.length + commitmentHits.length && metaCard > 0;

  return (
    <div className="space-y-6">
      {/* Hero dropzone — file first */}
      <div className="overflow-hidden rounded-[1.75rem] border border-emerald-100 bg-gradient-to-br from-[#ECFDF5] via-white to-[#FFF7ED] shadow-[0_20px_50px_-28px_rgba(16,185,129,0.45)]">
        <div className="px-5 pb-2 pt-5 md:px-7 md:pt-7">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600/10 px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-emerald-800">
            <Sparkles className="h-3.5 w-3.5" />
            Kashu live scan
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900">
            Drop a statement. Watch Kashu unpack it. 🫧
          </h2>
          <p className="mt-1 max-w-xl text-sm font-medium text-slate-600">
            PDF, CSV, or TXT — no bank login. Kashu spots payroll, bills, and your balance so you can
            pin them on the cash calendar.
          </p>
        </div>

        <div className="px-5 pb-5 md:px-7 md:pb-7">
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.csv,.txt,application/pdf,text/csv,text/plain"
            className="sr-only"
            onChange={(ev) => pickFile(ev.target.files?.[0] ?? null)}
          />

          <button
            type="button"
            disabled={busy || scanning}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={cn(
              "group relative flex w-full flex-col items-center justify-center gap-3 rounded-[1.5rem] border-2 border-dashed px-4 py-10 text-center transition",
              dragOver
                ? "border-emerald-500 bg-emerald-100/70 scale-[1.01]"
                : "border-emerald-300/80 bg-white/70 hover:border-emerald-500 hover:bg-emerald-50/80",
              (busy || scanning) && "pointer-events-none opacity-70"
            )}
          >
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-white shadow-lg shadow-emerald-400/40 transition group-hover:scale-105">
              {scanning ? (
                <Loader2 className="h-7 w-7 animate-spin" />
              ) : (
                <Upload className="h-7 w-7" />
              )}
            </span>
            <span className="text-base font-black text-slate-900">
              {scanning ? "Kashu is scanning…" : "Click to upload — or drag & drop"}
            </span>
            <span className="text-xs font-semibold text-slate-500">
              1 month to start · 3 months recommended · PDF / CSV / TXT · max 8 MB
            </span>
            {file && !scanning ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1 text-xs font-bold text-white">
                <FileUp className="h-3.5 w-3.5" />
                {file.name}
              </span>
            ) : null}
          </button>

          {scanning && stageMeta ? (
            <div className="mt-4 overflow-hidden rounded-2xl bg-slate-900 px-4 py-3 text-white shadow-xl">
              <div className="flex items-center gap-3">
                <span className="text-2xl animate-bounce" aria-hidden>
                  {stageMeta.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">{stageMeta.label}</p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/20">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-teal-300 to-amber-300 transition-all duration-700"
                      style={{
                        width: `${Math.min(95, 18 + stageIndex * 22 + (stage === "revealing" ? 20 : 0))}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {["📄 Read", "🥳 Payroll", "🧾 Bills", "🪙 Balance"].map((chip, i) => (
                  <span
                    key={chip}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[10px] font-bold transition",
                      i <= stageIndex
                        ? "bg-emerald-400 text-emerald-950"
                        : "bg-white/10 text-white/50"
                    )}
                  >
                    {chip}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {/* Live reveal board */}
          {scan && (stage === "revealing" || stage === "done") ? (
            <div className="mt-5 space-y-4">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <p className="text-xs font-black uppercase tracking-wider text-emerald-700">
                    Scan results
                  </p>
                  <p className="text-lg font-black text-slate-900">
                    Here&apos;s what Kashu pulled out 👀
                  </p>
                </div>
                <p className="text-xs font-semibold text-slate-500">
                  {scan.transactionCount} transactions read
                </p>
              </div>

              {payrollHits.length > 0 ? (
                <div>
                  <p className="mb-2 text-xs font-black uppercase tracking-wider text-emerald-600">
                    Payroll & deposits
                  </p>
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {payrollHits.slice(0, payrollReveal).map((hit, i) => (
                      <li
                        key={`pay-${i}-${hit.title}`}
                        className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 px-3 py-2.5 text-white shadow-md shadow-emerald-400/30"
                      >
                        <span className="text-xl" aria-hidden>
                          {hit.emoji ?? "🥳"}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-bold">{hit.title}</span>
                          <span className="text-[10px] font-semibold text-emerald-50">
                            {hit.date ?? "deposit"} · income
                          </span>
                        </span>
                        <span className="shrink-0 text-sm font-black">
                          +{moneyExact(hit.amount)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : stage === "done" ? (
                <p className="rounded-2xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
                  No clear payroll line yet — set payday under Buffers if Kashu missed it.
                </p>
              ) : null}

              {commitmentHits.length > 0 ? (
                <div>
                  <p className="mb-2 text-xs font-black uppercase tracking-wider text-rose-600">
                    Bills & commitments
                  </p>
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {commitmentHits.slice(0, commitmentReveal).map((hit) => (
                      <li
                        key={hit.id ?? hit.title}
                        className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-rose-500 to-orange-400 px-3 py-2.5 text-white shadow-md shadow-rose-400/30"
                      >
                        <span className="text-xl" aria-hidden>
                          {hit.emoji ?? "🧾"}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-bold">{hit.title}</span>
                          <span className="text-[10px] font-semibold text-rose-50">
                            {hit.frequency ?? "recurring"}
                            {hit.confidence != null
                              ? ` · ${Math.round(hit.confidence * 100)}% sure`
                              : ""}
                          </span>
                        </span>
                        <span className="shrink-0 text-sm font-black">
                          −{moneyExact(hit.amount)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {showMeta ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {scan.endingBalance != null ? (
                    <div className="rounded-2xl bg-gradient-to-br from-sky-500 to-cyan-400 px-3 py-3 text-white shadow-md">
                      <p className="text-[10px] font-black uppercase tracking-wider text-sky-50">
                        Ending balance spotted
                      </p>
                      <p className="text-xl font-black">{money(scan.endingBalance)}</p>
                    </div>
                  ) : null}
                  {scan.paydayGuess || scan.payFrequencyGuess ? (
                    <div className="rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 px-3 py-3 text-white shadow-md">
                      <p className="text-[10px] font-black uppercase tracking-wider text-violet-100">
                        Payday rhythm
                      </p>
                      <p className="text-sm font-black">
                        {scan.payFrequencyGuess?.replace(/_/g, " ") ?? "Detected"}
                        {scan.paydayGuess ? ` · next ${scan.paydayGuess}` : ""}
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {stage === "done" && candidates.length > 0 ? (
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    type="button"
                    disabled={busy}
                    onClick={() => void confirmAllToCalendar()}
                    className="rounded-full bg-gradient-to-r from-emerald-600 to-teal-500 font-bold shadow-md"
                  >
                    Confirm all → put on calendar
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={busy}
                    onClick={onOpenCalendar}
                    className="rounded-full"
                  >
                    Peek calendar first
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="mt-4">
            <button
              type="button"
              className="text-xs font-bold text-slate-500 underline-offset-2 hover:text-emerald-700 hover:underline"
              onClick={() => setShowPaste((v) => !v)}
            >
              {showPaste ? "Hide paste option" : "Have text / CSV to paste instead?"}
            </button>
            {showPaste ? (
              <form
                className="mt-3 space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  void runScan({ text: paste });
                }}
              >
                <textarea
                  value={paste}
                  onChange={(ev) => setPaste(ev.target.value)}
                  rows={6}
                  placeholder="Paste statement or CSV text…"
                  className="w-full rounded-2xl border border-emerald-200 bg-white/90 px-3 py-2 text-sm"
                />
                <Button type="submit" disabled={busy || !paste.trim()} className="rounded-full">
                  {busy ? "Scanning…" : "Scan pasted text"}
                </Button>
              </form>
            ) : null}
          </div>
        </div>
      </div>

      {/* Confirm recurrings — calendar setup */}
      <div className="rounded-[1.75rem] border border-rose-100 bg-white p-4 shadow-sm md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-black text-slate-900">
              Confirm → appear on calendar 🗓️
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Each confirm becomes a recurring obligation on your cash calendar.
            </p>
          </div>
          {candidates.length > 0 ? (
            <Button
              type="button"
              size="sm"
              disabled={busy}
              onClick={() => void confirmAllToCalendar()}
              className="rounded-full"
            >
              Confirm all ({candidates.length})
            </Button>
          ) : null}
        </div>
        {candidates.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            No pending suggestions yet. Upload a statement and Kashu will bubble them up here.
          </p>
        ) : (
          <ul className="mt-4 space-y-4">
            {candidates.map((c) => {
              const edit = edits[c.id] ?? {
                title: c.title,
                amount: String(c.amount),
                frequency: c.frequency,
                priority: c.priority,
                nextDueDate: c.nextDueDate ? c.nextDueDate.slice(0, 10) : "",
              };
              return (
                <li
                  key={c.id}
                  className="space-y-3 rounded-2xl border border-rose-100 bg-gradient-to-br from-rose-50/80 to-orange-50/40 p-3"
                >
                  <p className="text-xs font-bold text-rose-600">
                    {Math.round(c.confidence * 100)}% confidence · {c.frequency}
                  </p>
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
                      Confirm on calendar
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

      <div className="rounded-[1.75rem] border border-slate-200 bg-white p-4 md:p-6">
        <h3 className="text-base font-black text-slate-900">Add a one-off change</h3>
        <p className="mt-1 text-sm text-slate-500">
          Expected vs actual drifted? Log it without a bank connection.
        </p>
        <form className="mt-3 grid gap-3 sm:grid-cols-2" onSubmit={(e) => void addTransaction(e)}>
          <label className="text-sm sm:col-span-2">
            <span className="text-slate-600">Description</span>
            <Input
              value={txDesc}
              onChange={(e) => setTxDesc(e.target.value)}
              placeholder="Coffee · payroll · unexpected bill"
              className="mt-1"
            />
          </label>
          <label className="text-sm">
            <span className="text-slate-600">Amount</span>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={txAmount}
              onChange={(e) => setTxAmount(e.target.value)}
              className="mt-1"
            />
          </label>
          <label className="text-sm">
            <span className="text-slate-600">Date</span>
            <Input type="date" value={txDate} onChange={(e) => setTxDate(e.target.value)} className="mt-1" />
          </label>
          <label className="text-sm">
            <span className="text-slate-600">Direction</span>
            <select
              className="mt-1 w-full rounded-lg border border-forward-200 px-2 py-2 text-sm"
              value={txDirection}
              onChange={(e) => setTxDirection(e.target.value as "debit" | "credit")}
            >
              <option value="debit">Debit (out)</option>
              <option value="credit">Credit (in)</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="text-slate-600">Classification</span>
            <select
              className="mt-1 w-full rounded-lg border border-forward-200 px-2 py-2 text-sm"
              value={txClass}
              onChange={(e) => setTxClass(e.target.value as KashuTxClassification)}
            >
              {KASHU_TX_CLASSIFICATIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
            <input
              type="checkbox"
              checked={txApplyBalance}
              onChange={(e) => setTxApplyBalance(e.target.checked)}
            />
            Apply to current balance
          </label>
          <div className="sm:col-span-2">
            <Button type="submit" size="sm" disabled={busy} className="rounded-full">
              {busy ? "Saving…" : "Add to Kashu"}
            </Button>
          </div>
        </form>
      </div>

      <div className="rounded-[1.75rem] border border-slate-200 bg-white p-4 md:p-6">
        <h3 className="text-base font-black text-slate-900">Recent transactions</h3>
        <p className="mt-1 text-sm text-slate-500">
          Reclassify if Kashu misread a credit — payroll ≠ refund ≠ transfer.
        </p>
        {transactions.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No parsed transactions yet.</p>
        ) : (
          <ul className="mt-3 max-h-[28rem] space-y-2 overflow-y-auto">
            {transactions.map((t) => (
              <li
                key={t.id}
                className="flex flex-col gap-2 rounded-xl border border-slate-100 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{t.description}</p>
                  <p className="text-xs text-slate-500">
                    {t.postedAt.slice(0, 10)} · {t.direction} · {money(t.amount)}
                  </p>
                </div>
                <select
                  className="rounded-lg border border-forward-200 px-2 py-1.5 text-xs"
                  value={t.classification ?? "other"}
                  disabled={busy}
                  onChange={(e) =>
                    void reclassify(t.id, e.target.value as KashuTxClassification)
                  }
                >
                  {KASHU_TX_CLASSIFICATIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
