"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { CheckCircle2, MessageSquarePlus, X } from "lucide-react";
import type { ProductFeedbackKind } from "@forward/shared";
import { PRODUCT_FEEDBACK_KIND_LABELS, PRODUCT_FEEDBACK_KINDS } from "@forward/shared";
import { Button } from "./button";
import { cn } from "@/lib/utils";
import { useViewport } from "@/hooks/use-viewport";
import { viewportLabel } from "@/lib/viewport";

type ChiefOfStaffFeedbackContextValue = {
  openFeedback: (kind?: ProductFeedbackKind) => void;
  closeFeedback: () => void;
};

const ChiefOfStaffFeedbackContext = createContext<ChiefOfStaffFeedbackContextValue | null>(null);

export function useChiefOfStaffFeedback() {
  const ctx = useContext(ChiefOfStaffFeedbackContext);
  if (!ctx) {
    throw new Error("useChiefOfStaffFeedback must be used within ChiefOfStaffFeedbackProvider");
  }
  return ctx;
}

function FeedbackSheet({
  open,
  initialKind,
  onClose,
}: {
  open: boolean;
  initialKind: ProductFeedbackKind;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const viewport = useViewport();
  const [kind, setKind] = useState<ProductFeedbackKind>(initialKind);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setKind(initialKind);
      setSent(false);
      setError(null);
    }
  }, [open, initialKind]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  async function submit() {
    const trimmed = message.trim();
    if (trimmed.length < 8 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          message: trimmed,
          pagePath: pathname,
          viewport,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not send feedback.");
        return;
      }
      setSent(true);
      setMessage("");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Close feedback"
        onClick={onClose}
      />
      <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-forward-200 bg-white shadow-2xl sm:rounded-2xl">
        <div className="border-b border-forward-100 bg-gradient-to-r from-forward-950 to-forward-900 px-5 py-4 text-white">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-brand-cyan">
                Chief of Staff
              </p>
              <h2 className="mt-1 text-lg font-semibold">Tell us what you want MotiveLife to do</h2>
              <p className="mt-1 text-sm text-forward-300">
                Your wishes, changes, and ideas go straight to the MotiveLife team — like briefing
                your chief of staff.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-forward-400 hover:bg-white/10"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {sent ? (
            <div className="flex flex-col items-center py-8 text-center">
              <CheckCircle2 size={48} className="text-brand-green" />
              <p className="mt-4 text-lg font-semibold text-forward-900">Message received</p>
              <p className="mt-2 max-w-sm text-sm text-forward-600">
                Your chief of staff noted this for the MotiveLife team. We read every submission.
              </p>
              <Button className="mt-6" onClick={onClose}>
                Done
              </Button>
            </div>
          ) : (
            <>
              <p className="text-xs font-semibold uppercase tracking-widest text-forward-400">
                What kind of feedback?
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {PRODUCT_FEEDBACK_KINDS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setKind(k)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                      kind === k
                        ? "border-brand-blue bg-brand-blue/10 text-brand-blue"
                        : "border-forward-200 text-forward-600 hover:border-forward-300"
                    )}
                  >
                    {PRODUCT_FEEDBACK_KIND_LABELS[k]}
                  </button>
                ))}
              </div>

              <label className="mt-5 block">
                <span className="text-xs font-semibold uppercase tracking-widest text-forward-400">
                  Your message
                </span>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={5}
                  placeholder={
                    kind === "wish"
                      ? "I'd love MotiveLife to show me… / help me with…"
                      : kind === "change"
                        ? "Please change how… / I'd prefer if…"
                        : kind === "praise"
                          ? "What's working well for me is…"
                          : "Something broke or feels wrong when I…"
                  }
                  className="mt-2 w-full resize-none rounded-xl border border-forward-200 px-3 py-2.5 text-sm text-forward-900 outline-none ring-brand-blue/30 focus:border-brand-blue focus:ring-2"
                />
              </label>

              <p className="mt-2 text-xs text-forward-400">
                Sent from {viewportLabel(viewport)} · {pathname || "MotiveLife"}
              </p>

              {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

              <div className="mt-6 flex flex-wrap gap-2">
                <Button disabled={message.trim().length < 8 || busy} onClick={submit}>
                  {busy ? "Sending…" : "Send to MotiveLife team"}
                </Button>
                <Button variant="secondary" onClick={onClose}>
                  Cancel
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function ChiefOfStaffFeedbackProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [initialKind, setInitialKind] = useState<ProductFeedbackKind>("wish");

  const openFeedback = useCallback((kind: ProductFeedbackKind = "wish") => {
    setInitialKind(kind);
    setOpen(true);
  }, []);

  const closeFeedback = useCallback(() => setOpen(false), []);

  return (
    <ChiefOfStaffFeedbackContext.Provider value={{ openFeedback, closeFeedback }}>
      {children}
      <FeedbackSheet open={open} initialKind={initialKind} onClose={closeFeedback} />
    </ChiefOfStaffFeedbackContext.Provider>
  );
}
