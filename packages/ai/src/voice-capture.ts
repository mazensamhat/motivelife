import type { VoiceCapturePlan } from "@forward/shared";
import { detectVoiceCoachingCommands } from "./voice-commands";
import { parseOpenAiUsage, type OpenAiUsage } from "./openai-usage";

export type { OpenAiUsage } from "./openai-usage";
export { parseOpenAiUsage } from "./openai-usage";

const DOMAINS = [
  "CAREER",
  "MONEY",
  "HEALTH",
  "LEARNING",
  "RELATIONSHIPS",
  "TRAVEL",
  "BUSINESS",
  "HABITS",
  "PROJECTS",
  "DREAMS",
] as const;

function detectMood(lower: string): string | null {
  if (/burned out|exhausted|overwhelmed|stressed|anxious|nervous/i.test(lower)) return "stressed";
  if (/excited|great|nailed|proud|grateful|happy/i.test(lower)) return "energized";
  if (/tired|slept \d|only \d hours/i.test(lower)) return "tired";
  return null;
}

function detectSignals(lower: string): string[] {
  const signals: string[] = [];
  if (/burned out|burnout|quit(?:ting)? my job/i.test(lower)) signals.push("burnout");
  if (/sle(?:pt|ep) \d|only \d hours|insomnia/i.test(lower)) signals.push("sleep_debt");
  if (/spent \$|costco|shopping|broke|debt/i.test(lower)) signals.push("spending");
  if (/gained|lost|pounds|weigh/i.test(lower)) signals.push("body_composition");
  if (/interview|promotion|job|manager|raise/i.test(lower)) signals.push("career_signal");
  if (/dinner|parents|spouse|friend|family|partner/i.test(lower)) signals.push("relationship_signal");
  return [...new Set(signals)];
}

function detectDomain(lower: string): string | null {
  if (/job|career|interview|promotion|boss|manager|work/i.test(lower)) return "CAREER";
  if (/save|spent|\$|money|budget|debt/i.test(lower)) return "MONEY";
  if (/sleep|workout|gym|health|weight|pounds/i.test(lower)) return "HEALTH";
  if (/dinner|parents|spouse|friend|family|partner/i.test(lower)) return "RELATIONSHIPS";
  if (/learn|study|school|course/i.test(lower)) return "LEARNING";
  if (/move to|travel|trip/i.test(lower)) return "TRAVEL";
  return null;
}

function extractTaskTitle(transcript: string): string {
  const trimmed = transcript.trim();
  if (trimmed.length <= 80) return trimmed;
  return trimmed.slice(0, 77) + "...";
}

/** Rule-based voice capture when OpenAI is off — still creates memories and routes modules */
export function parseVoiceCaptureRules(transcript: string): VoiceCapturePlan {
  const t = transcript.trim();
  const lower = t.toLowerCase();

  const plan: VoiceCapturePlan = {
    summary: t.length > 140 ? `${t.slice(0, 137)}…` : t,
    mood: detectMood(lower),
    signals: detectSignals(lower),
    coachNote: null,
    memories: [{ content: t, type: "FACT", domain: detectDomain(lower) }],
    goals: [],
    tasks: [],
    healthNotes: [],
    moneyNotes: [],
    relationshipNotes: [],
    insights: [],
  };

  if (/remind me|remember that|don't forget|need to remember|make sure i/i.test(lower)) {
    plan.memories.push({
      content: t,
      type: "COMMITMENT",
      domain: detectDomain(lower) ?? "HABITS",
    });
  }

  const sleepMatch = lower.match(/(?:only )?sle(?:pt|ep(?:t)?)\s+(\d+(?:\.\d+)?)\s*hours?/);
  if (sleepMatch) {
    plan.healthNotes.push({
      title: "Sleep last night",
      value: parseFloat(sleepMatch[1]),
      unit: "hours",
      notes: t,
    });
    if (!plan.signals.includes("sleep_debt")) plan.signals.push("sleep_debt");
  }

  const spentMatch = lower.match(/(?:spent|paid|cost(?:ed)?)\s+(?:about\s+)?\$?\s*([\d,]+(?:\.\d+)?)/);
  if (spentMatch) {
    const amount = parseFloat(spentMatch[1].replace(/,/g, ""));
    const place = /costco|target|amazon|uber|restaurant/i.exec(lower)?.[0];
    plan.moneyNotes.push({
      title: place ? `Spend at ${place[0].toUpperCase()}${place.slice(1)}` : "Recent spend",
      amount,
      notes: t,
    });
  }

  const saveMatch = lower.match(
    /save\s+\$?\s*([\d,]+(?:\.\d+)?)\s*(?:dollars?|bucks)?(?:\s+by|\s+before|\s+until)\s+(.+)/i
  );
  if (saveMatch) {
    plan.goals.push({
      title: `Save $${saveMatch[1].replace(/,/g, "")} by ${saveMatch[2].trim().replace(/\.$/, "")}`,
      domain: "MONEY",
      description: t,
    });
  }

  if (/gained|lost|weigh|pounds|kilos|kg\b/i.test(lower)) {
    plan.healthNotes.push({ title: "Body composition note", notes: t });
  }

  if (/burned out|burnout|quit(?:ting)? my job/i.test(lower)) {
    plan.insights.push({
      text: "Burnout or career exit thoughts — worth a structured career review.",
      category: "WARNING",
    });
    plan.coachNote = "Captured. MotiveLife logged the burnout signal — no need to organize it yourself.";
  }

  if (/interview|nailed|forgot to mention|presentation/i.test(lower)) {
    plan.memories.push({ content: t, type: "ACHIEVEMENT", domain: "CAREER" });
  }

  if (/promotion|boss mentioned|raise|manager said/i.test(lower)) {
    plan.memories.push({ content: t, type: "FACT", domain: "CAREER" });
  }

  if (/dinner|parents|spouse|partner|agreed to|date night|in-laws/i.test(lower)) {
    plan.relationshipNotes.push({ title: "Relationship commitment", notes: t });
    plan.memories.push({ content: t, type: "COMMITMENT", domain: "RELATIONSHIPS" });
    if (/next|friday|monday|tomorrow|this week|saturday|sunday/i.test(lower)) {
      plan.tasks.push({ title: extractTaskTitle(t), priority: "MEDIUM", dueHint: "soon" });
    }
  }

  if (/move to|moving to|want to live in|relocate/i.test(lower)) {
    plan.memories.push({ content: t, type: "FACT", domain: "TRAVEL" });
  }

  if (/thinking about|idea for|i had an idea/i.test(lower)) {
    plan.memories.push({ content: t, type: "FACT", domain: "PROJECTS" });
  }

  const coachingCommands = detectVoiceCoachingCommands(transcript);
  if (coachingCommands.length > 0 && !plan.coachNote?.includes("challenge")) {
    plan.coachNote = `Heard your request — starting ${coachingCommands[0].replace(/^start_/, "").replace(/_/g, " ")}.`;
  }

  return plan;
}

export function parseNightReflectionRules(transcript: string): VoiceCapturePlan {
  const base = parseVoiceCaptureRules(transcript);
  const sentences = transcript
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 8);

  const wins = sentences.filter((s) =>
    /good|great|proud|nailed|win|accomplish|progress|finally|happy|went well/i.test(s)
  );
  const problems = sentences.filter((s) =>
    /stress|hard|difficult|bad|annoy|frustrat|tired|burn|worried|argument|tough/i.test(s)
  );
  const ideas = sentences.filter((s) => /idea|thinking about|maybe i should|what if/i.test(s));
  const tomorrowPriorities = sentences.filter((s) =>
    /tomorrow|next week|monday|need to|first thing/i.test(s)
  );
  const habits = sentences.filter((s) =>
    /habit|workout|meditat|journal|sleep|routine|steps/i.test(s)
  );

  for (const w of wins.slice(0, 3)) {
    base.memories.push({
      content: w,
      type: "ACHIEVEMENT",
      domain: detectDomain(w.toLowerCase()),
    });
  }
  for (const p of problems.slice(0, 2)) {
    base.insights.push({ text: p, category: "WARNING" });
  }
  for (const t of tomorrowPriorities.slice(0, 3)) {
    const title = extractTaskTitle(t);
    if (!base.tasks.some((task) => task.title === title)) {
      base.tasks.push({ title, priority: "HIGH", dueHint: "tomorrow" });
    }
  }

  base.coachNote =
    base.coachNote ??
    (wins.length > 0
      ? `Captured your day — ${wins.length} win${wins.length === 1 ? "" : "s"} logged.`
      : "Your day is captured — rest well.");

  if (wins[0]) {
    base.summary = `Today: ${wins[0].slice(0, 100)}`;
  }

  return {
    ...base,
    wins: wins.slice(0, 5),
    problems: problems.slice(0, 5),
    ideas: ideas.slice(0, 3),
    tomorrowPriorities: tomorrowPriorities.slice(0, 3),
    habits: habits.slice(0, 3),
  };
}

export function parseMorningReflectionRules(
  transcript: string,
  ctx: { yesterdayMood?: string | null; yesterdaySummary?: string | null }
): VoiceCapturePlan {
  const base = parseVoiceCaptureRules(transcript);
  const lower = transcript.toLowerCase();

  if (ctx.yesterdayMood === "stressed" && /better|good|fine|okay|ok|rested|clear|calm/i.test(lower)) {
    base.coachNote = "Good to hear you're feeling clearer than yesterday.";
  } else if (ctx.yesterdayMood) {
    base.coachNote = `Morning check-in noted — yesterday you felt ${ctx.yesterdayMood}.`;
  } else if (ctx.yesterdaySummary) {
    base.coachNote = "Morning check-in captured — building on yesterday.";
  } else {
    base.coachNote = "Morning check-in captured.";
  }

  base.memories.push({
    content: `Morning check-in: ${transcript}`,
    type: "FACT",
    domain: "HEALTH",
  });

  return {
    ...base,
    wins: [],
    problems: [],
    ideas: [],
    tomorrowPriorities: [],
    habits: [],
  };
}

/** Long-form brain dump — batch extract every thread mentioned */
export function parseBrainDumpRules(transcript: string): VoiceCapturePlan {
  const base = parseVoiceCaptureRules(transcript);
  const chunks = transcript
    .split(/\n+|(?:\.\s+)|(?:;\s+)|(?:,\s+and\s+)/)
    .map((s) => s.trim())
    .filter((s) => s.length > 12);

  for (const chunk of chunks) {
    const part = parseVoiceCaptureRules(chunk);
    base.memories.push(...part.memories);
    base.goals.push(...part.goals);
    base.tasks.push(...part.tasks);
    base.healthNotes.push(...part.healthNotes);
    base.moneyNotes.push(...part.moneyNotes);
    base.relationshipNotes.push(...part.relationshipNotes);
    base.insights.push(...part.insights);
    for (const signal of part.signals) {
      if (!base.signals.includes(signal)) base.signals.push(signal);
    }
  }

  const threadCount =
    base.memories.length + base.goals.length + base.tasks.length + base.relationshipNotes.length;
  base.summary =
    threadCount > 1
      ? `Brain dump organized — ${threadCount} threads captured from your drive-time thoughts.`
      : base.summary;
  base.coachNote =
    base.coachNote ??
    `Captured ${threadCount} thread${threadCount === 1 ? "" : "s"}. MotiveLife sorted them into the right modules.`;

  return base;
}

export interface VoiceCaptureAiContext {
  userName: string | null;
  recentMemories?: string[];
  activeGoals?: string[];
  yesterdayMood?: string | null;
  yesterdaySummary?: string | null;
}

/** Passive ambient capture — each pause-delimited segment becomes its own thread */
export function parseAmbientCaptureRules(transcript: string, segments?: string[]): VoiceCapturePlan {
  const parts = (segments ?? []).map((s) => s.trim()).filter((s) => s.length > 8);
  if (parts.length === 0) return parseBrainDumpRules(transcript);

  const base: VoiceCapturePlan = {
    summary: "",
    mood: null,
    signals: [],
    coachNote: null,
    memories: [],
    goals: [],
    tasks: [],
    healthNotes: [],
    moneyNotes: [],
    relationshipNotes: [],
    insights: [],
  };

  for (const segment of parts) {
    const part = parseVoiceCaptureRules(segment);
    base.memories.push(...part.memories);
    base.goals.push(...part.goals);
    base.tasks.push(...part.tasks);
    base.healthNotes.push(...part.healthNotes);
    base.moneyNotes.push(...part.moneyNotes);
    base.relationshipNotes.push(...part.relationshipNotes);
    base.insights.push(...part.insights);
    if (part.mood && !base.mood) base.mood = part.mood;
    for (const signal of part.signals) {
      if (!base.signals.includes(signal)) base.signals.push(signal);
    }
  }

  const threadCount =
    base.memories.length + base.goals.length + base.tasks.length + base.relationshipNotes.length;
  base.summary = `Ambient capture — ${parts.length} moment${parts.length === 1 ? "" : "s"}, ${threadCount} items organized.`;
  base.coachNote = `Passive listening captured ${parts.length} segments — sorted without you lifting a finger.`;

  return base;
}

const OUTPUT_SCHEMA = `{
  "summary": "one calm chief-of-staff line",
  "mood": "neutral|stressed|energized|tired|anxious|grateful|null",
  "signals": string[],
  "coachNote": "one short sentence acknowledging capture — not a chat reply|null",
  "memories": [{ "content": string, "type": "FACT|PREFERENCE|COMMITMENT|ACHIEVEMENT", "domain": string|null }],
  "goals": [{ "title": string, "domain": string, "description": string|null }],
  "tasks": [{ "title": string, "priority": "LOW|MEDIUM|HIGH|URGENT", "dueHint": string|null }],
  "healthNotes": [{ "title": string, "notes": string, "value": number|null, "unit": string|null }],
  "moneyNotes": [{ "title": string, "amount": number|null, "notes": string }],
  "relationshipNotes": [{ "title": string, "notes": string }],
  "insights": [{ "text": string, "category": "PATTERN|PREFERENCE|WARNING|STRENGTH" }]
}`;

const REFLECTION_SCHEMA = `${OUTPUT_SCHEMA.slice(0, -1)},
  "wins": string[],
  "problems": string[],
  "ideas": string[],
  "tomorrowPriorities": string[],
  "habits": string[]
}`;

function reflectionSystemPrompt(source: string, context: VoiceCaptureAiContext): string {
  if (source === "night_reflection") {
    return `You are MotiveLife Night Reflection. User spoke for ~90 seconds about their day. Extract wins, problems, mood, habits, tasks for tomorrow, ideas, and route to modules. Not a chatbot — no questions. Output JSON only.

User: ${context.userName ?? "User"}
Active goals: ${context.activeGoals?.slice(0, 5).join(" | ") ?? "none"}

Extract wins (achievements), problems (stressors), tomorrow priorities as tasks, and preserve full context in memories.`;
  }
  if (source === "morning_reflection") {
    return `You are MotiveLife Morning Reflection. User is checking in on how they feel today.

Yesterday mood: ${context.yesterdayMood ?? "unknown"}
Yesterday summary: ${context.yesterdaySummary ?? "none"}

Acknowledge continuity from yesterday in coachNote (one sentence). Capture health/mood. Not a chatbot. Output JSON only.`;
  }
  if (source === "brain_dump") {
    return `You are MotiveLife Brain Dump processor. User spoke for several minutes while driving or walking — unstructured stream of consciousness.

Extract EVERY distinct thread: memories, goals, tasks, health, money, relationships, insights. Split compound sentences. Do not merge unrelated items.
Valid domains: ${DOMAINS.join(", ")}
User: ${context.userName ?? "User"}
Active goals: ${context.activeGoals?.slice(0, 8).join(" | ") ?? "none"}

Summary should say how many threads were organized. Not a chatbot. Output JSON only.`;
  }
  if (source === "ambient_capture") {
    return `You are MotiveLife Ambient Capture. User spoke passively over time — transcript is split into natural pause segments.

Process each segment as a separate life thread. Extract memories, goals, tasks, health, money, relationships, insights per segment.
Valid domains: ${DOMAINS.join(", ")}
User: ${context.userName ?? "User"}

Summary should mention segment count. Not a chatbot. Output JSON only.`;
  }
  return `You are MotiveLife Voice Capture — not a chatbot. Extract structured life data. Output JSON only.

Philosophy: Capture · Organize · Remember · Coach.
Valid domains: ${DOMAINS.join(", ")}
User: ${context.userName ?? "User"}
Recent memories: ${context.recentMemories?.slice(0, 5).join(" | ") ?? "none"}
Active goals: ${context.activeGoals?.slice(0, 5).join(" | ") ?? "none"}`;
}

export async function parseVoiceCaptureBySource(
  transcript: string,
  source: "capture" | "brain_dump" | "ambient_capture" | "night_reflection" | "morning_reflection",
  context: VoiceCaptureAiContext,
  apiKey?: string | null,
  segments?: string[]
): Promise<{ plan: VoiceCapturePlan; usage: OpenAiUsage | null }> {
  const ruleFallback =
    source === "night_reflection"
      ? parseNightReflectionRules(transcript)
      : source === "morning_reflection"
        ? parseMorningReflectionRules(transcript, context)
        : source === "brain_dump"
          ? parseBrainDumpRules(transcript)
          : source === "ambient_capture"
            ? parseAmbientCaptureRules(transcript, segments)
            : parseVoiceCaptureRules(transcript);

  if (!apiKey) return { plan: ruleFallback, usage: null };

  const schema =
    source === "capture" || source === "brain_dump" || source === "ambient_capture"
      ? OUTPUT_SCHEMA
      : REFLECTION_SCHEMA;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `${reflectionSystemPrompt(source, context)}

Always include at least one memory. Create tasks only for clear follow-ups. Create goals only for explicit targets.`,
          },
          {
            role: "user",
            content: `Transcript:\n"""${transcript}"""\n\nSchema:\n${schema}`,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.35,
      }),
    });

    if (!response.ok) return { plan: ruleFallback, usage: null };

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return { plan: ruleFallback, usage: null };

    const usage = parseOpenAiUsage(data);
    const parsed = JSON.parse(content) as VoiceCapturePlan;
    return {
      plan: {
        ...ruleFallback,
        summary: parsed.summary || ruleFallback.summary,
        mood: parsed.mood ?? ruleFallback.mood,
        signals: parsed.signals?.length ? parsed.signals : ruleFallback.signals,
        coachNote: parsed.coachNote ?? ruleFallback.coachNote,
        memories: parsed.memories?.length ? parsed.memories : ruleFallback.memories,
        goals: parsed.goals?.length ? parsed.goals : ruleFallback.goals,
        tasks: parsed.tasks?.length ? parsed.tasks : ruleFallback.tasks,
        healthNotes: parsed.healthNotes?.length ? parsed.healthNotes : ruleFallback.healthNotes,
        moneyNotes: parsed.moneyNotes?.length ? parsed.moneyNotes : ruleFallback.moneyNotes,
        relationshipNotes: parsed.relationshipNotes?.length
          ? parsed.relationshipNotes
          : ruleFallback.relationshipNotes,
        insights: parsed.insights?.length ? parsed.insights : ruleFallback.insights,
        wins: parsed.wins?.length ? parsed.wins : ruleFallback.wins,
        problems: parsed.problems?.length ? parsed.problems : ruleFallback.problems,
        ideas: parsed.ideas?.length ? parsed.ideas : ruleFallback.ideas,
        tomorrowPriorities: parsed.tomorrowPriorities?.length
          ? parsed.tomorrowPriorities
          : ruleFallback.tomorrowPriorities,
        habits: parsed.habits?.length ? parsed.habits : ruleFallback.habits,
      },
      usage,
    };
  } catch {
    return { plan: ruleFallback, usage: null };
  }
}

export async function parseVoiceCaptureWithAI(
  transcript: string,
  context: VoiceCaptureAiContext,
  apiKey: string,
  source: "capture" | "brain_dump" | "ambient_capture" | "night_reflection" | "morning_reflection" = "capture"
): Promise<VoiceCapturePlan> {
  const { plan } = await parseVoiceCaptureBySource(transcript, source, context, apiKey);
  return plan;
}

export function searchVoiceCaptures(
  captures: { transcript: string; summary: string | null; createdAt: Date }[],
  query: string
): { transcript: string; summary: string | null; createdAt: Date; snippet: string }[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];

  return captures
    .filter((c) => `${c.transcript} ${c.summary ?? ""}`.toLowerCase().includes(q))
    .map((c) => {
      const blob = c.transcript;
      const idx = blob.toLowerCase().indexOf(q);
      const start = Math.max(0, idx - 40);
      const snippet =
        (start > 0 ? "…" : "") +
        blob.slice(start, start + 120) +
        (start + 120 < blob.length ? "…" : "");
      return { ...c, snippet };
    })
    .slice(0, 10);
}
