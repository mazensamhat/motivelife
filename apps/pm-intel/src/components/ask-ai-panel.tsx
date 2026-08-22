"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { STARTER_QUESTIONS, type AssistantContext, askLocalAssistant } from "@/lib/assistant";
import type { AssistantAnswer } from "@/lib/types";

export function AskAiPanel({ ctx }: { ctx: AssistantContext }) {
  const [question, setQuestion] = useState("");
  const [answers, setAnswers] = useState<AssistantAnswer[]>([]);
  const bottom = useRef<HTMLDivElement>(null);

  const starters = useMemo(() => STARTER_QUESTIONS, []);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [answers]);

  function submit(next = question) {
    const q = next.trim();
    if (!q) return;
    const answer = askLocalAssistant(q, ctx);
    setAnswers((prev) => [...prev, answer]);
    setQuestion("");
  }

  return (
    <section className="flex h-full min-h-[420px] flex-col rounded-3xl border border-line bg-white shadow-[0_18px_40px_rgba(15,23,42,.08)]">
      <header className="border-b border-line px-5 py-4">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-blue">Local model</p>
        <h2 className="font-[family-name:var(--font-display)] text-xl font-extrabold text-navy">Ask the book</h2>
        <p className="text-sm text-muted">
          Retrieval + scoring on this machine. Dealer recaps are not sent to a cloud LLM.
        </p>
      </header>
      <div className="flex flex-1 flex-col gap-3 overflow-auto px-5 py-4">
        {!answers.length ? (
          <div className="grid gap-2">
            {starters.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => submit(item)}
                className="rounded-2xl border border-line bg-ice px-3 py-2 text-left text-sm text-navy hover:border-blue"
              >
                {item}
              </button>
            ))}
          </div>
        ) : (
          answers.map((item, index) => (
            <article key={`${item.question}-${index}`} className="rounded-2xl border border-line bg-paper p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">{item.intent.replaceAll("_", " ")}</p>
              <p className="mt-1 text-sm font-semibold text-blue">{item.question}</p>
              <h3 className="mt-2 font-[family-name:var(--font-display)] text-lg font-extrabold text-navy">
                {item.headline}
              </h3>
              <p className="mt-1 text-sm leading-6 text-ink">{item.answer}</p>
              {item.bullets.length ? (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-navy-2">
                  {item.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              ) : null}
              {item.citations.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {item.citations.map((cite, citeIndex) => (
                    <span key={`${cite.storeKey}-${citeIndex}`} className="rounded-full bg-white px-2 py-1 text-xs text-muted">
                      {cite.storeName}
                      {cite.date ? ` · ${cite.date}` : ""}
                    </span>
                  ))}
                </div>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                {item.suggestedFollowups.map((follow) => (
                  <button
                    key={follow}
                    type="button"
                    className="rounded-full border border-line px-3 py-1 text-xs text-navy hover:bg-ice"
                    onClick={() => submit(follow)}
                  >
                    {follow}
                  </button>
                ))}
              </div>
            </article>
          ))
        )}
        <div ref={bottom} />
      </div>
      <form
        className="flex gap-2 border-t border-line p-4"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask: last visit, temperature, who to call…"
          className="h-11 flex-1 rounded-2xl border border-line bg-ice px-4 text-sm outline-none ring-blue focus:ring-2"
        />
        <button type="submit" className="h-11 rounded-2xl bg-navy px-4 text-sm font-semibold text-white">
          Ask
        </button>
      </form>
    </section>
  );
}
