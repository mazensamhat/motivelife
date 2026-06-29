import { z } from "zod";

import { prisma } from "@forward/database";

import type { VoiceCapturePayload, VoiceCaptureSource } from "@forward/shared";

import { parseVoiceCaptureBySource } from "@forward/ai";

import { getSession } from "@/lib/session";

import { badRequest, json, unauthorized, serverError } from "@/lib/api";

import { getOpenAiApiKey } from "@/lib/openai-config";

import {

  applyVoiceCapturePlan,

  getMorningReflectionContext,

  reflectionFromPlan,

} from "@/lib/voice-capture-processor";

import {
  canUseAiVoiceOrganize,
  recordAiUsage,
} from "@/lib/ai-usage";
import { getSubscriptionTier } from "@/lib/subscription";



const postSchema = z.object({

  transcript: z.string().min(3).max(16000),

  source: z

    .enum(["capture", "brain_dump", "ambient_capture", "night_reflection", "morning_reflection"])

    .optional(),

  segments: z.array(z.string().min(3).max(4000)).max(40).optional(),

});



function toPayload(

  row: {

    id: string;

    transcript: string;

    summary: string | null;

    mood: string | null;

    signals: string | null;

    actions: string;

    source: string;

    createdAt: Date;

  },

  reflection?: ReturnType<typeof reflectionFromPlan> | null,

  meta?: { aiOrganized: boolean; atCap?: boolean }

): VoiceCapturePayload & { aiOrganized?: boolean; atCap?: boolean } {

  let applied: VoiceCapturePayload["applied"] = [];

  let coachNote: string | null = null;

  let storedReflection = reflection ?? null;

  try {

    const parsed = JSON.parse(row.actions) as {

      applied?: VoiceCapturePayload["applied"];

      coachNote?: string;

      reflection?: VoiceCapturePayload["reflection"];

    };

    applied = parsed.applied ?? [];

    coachNote = parsed.coachNote ?? null;

    if (!storedReflection && parsed.reflection) storedReflection = parsed.reflection;

  } catch {

    /* ignore */

  }



  let signals: string[] = [];

  try {

    if (row.signals) signals = JSON.parse(row.signals);

  } catch {

    /* ignore */

  }



  return {

    id: row.id,

    transcript: row.transcript,

    summary: row.summary,

    mood: row.mood,

    signals,

    coachNote,

    applied,

    reflection: storedReflection,

    source: row.source as VoiceCaptureSource,

    createdAt: row.createdAt.toISOString(),

    aiOrganized: meta?.aiOrganized,

    atCap: meta?.atCap,

  };

}



export async function GET(request: Request) {

  try {

    const session = await getSession();

    if (!session) return unauthorized();



    const { searchParams } = new URL(request.url);

    const q = searchParams.get("q")?.trim();



    const captures = await prisma.voiceCapture.findMany({

      where: { userId: session.id },

      orderBy: { createdAt: "desc" },

      take: q ? 100 : 20,

    });



    if (q) {

      const ql = q.toLowerCase();

      const filtered = captures.filter((c) =>

        `${c.transcript} ${c.summary ?? ""}`.toLowerCase().includes(ql)

      );

      return json({

        captures: filtered.slice(0, 15).map((row) => {

          const payload = toPayload(row);

          const idx = row.transcript.toLowerCase().indexOf(ql);

          const snippet =

            idx >= 0

              ? `${idx > 0 ? "…" : ""}${row.transcript.slice(Math.max(0, idx - 30), idx + 90)}${idx + 90 < row.transcript.length ? "…" : ""}`

              : row.summary;

          return { ...payload, snippet };

        }),

        query: q,

      });

    }



    return json({ captures: captures.map((row) => toPayload(row)) });

  } catch (error) {

    console.error("[api/voice-capture]", error);

    return serverError("Voice capture unavailable. Run: npx pnpm@9.15.0 db:push");

  }

}



export async function POST(request: Request) {

  try {

    const session = await getSession();

    if (!session) return unauthorized();



    const body = await request.json();

    const parsed = postSchema.safeParse(body);

    if (!parsed.success) return badRequest("Say something — transcript too short.");



    const { transcript, source = "capture", segments } = parsed.data;



    const [user, recentMemories, activeGoals, morningCtx, tier, capCheck] = await Promise.all([

      prisma.user.findUnique({ where: { id: session.id }, select: { name: true } }),

      prisma.memory.findMany({

        where: { userId: session.id },

        orderBy: { createdAt: "desc" },

        take: 8,

        select: { content: true },

      }),

      prisma.goal.findMany({

        where: { userId: session.id, status: "ACTIVE" },

        take: 8,

        select: { title: true },

      }),

      source === "morning_reflection"

        ? getMorningReflectionContext(session.id)

        : Promise.resolve(null),

      getSubscriptionTier(session.id),

      canUseAiVoiceOrganize(session.id, source),

    ]);



    const apiKey = getOpenAiApiKey();

    const useAi = Boolean(apiKey && capCheck.allowed);

    const atCap = Boolean(apiKey && !capCheck.allowed);



    const { plan, usage } = await parseVoiceCaptureBySource(

      transcript,

      source,

      {

        userName: user?.name ?? null,

        recentMemories: recentMemories.map((m) => m.content),

        activeGoals: activeGoals.map((g) => g.title),

        yesterdayMood: morningCtx?.yesterdayMood,

        yesterdaySummary: morningCtx?.yesterdaySummary,

      },

      useAi ? apiKey : null,

      segments

    );



    if (useAi && usage) {

      await recordAiUsage(session.id, "voice_organize", usage, capCheck.weight);

    }



    if (atCap && !plan.coachNote?.includes("limit")) {

      plan.coachNote =

        `Monthly AI organize limit reached (${capCheck.units}/${capCheck.cap}) — captured with smart rules. Resets next month.` +

        (tier === "trial" ? " Upgrade to Pro for 90/month." : "");

    }



    const reflection = reflectionFromPlan(plan);

    const applied = await applyVoiceCapturePlan(session.id, plan, source, transcript);



    const row = await prisma.voiceCapture.create({

      data: {

        userId: session.id,

        transcript,

        summary: plan.summary,

        mood: plan.mood ?? null,

        signals: JSON.stringify(plan.signals),

        actions: JSON.stringify({

          applied,

          coachNote: plan.coachNote ?? null,

          reflection,

          segmentCount: segments?.length ?? null,

          aiOrganized: useAi,

        }),

        source,

      },

    });



    return json(

      {

        capture: toPayload(row, reflection, { aiOrganized: useAi, atCap }),

        coachNote: plan.coachNote ?? null,

        reflection,

        aiOrganized: useAi,

        atCap,

      },

      201

    );

  } catch (error) {

    console.error("[api/voice-capture]", error);

    return serverError("Could not process voice capture.");

  }

}


