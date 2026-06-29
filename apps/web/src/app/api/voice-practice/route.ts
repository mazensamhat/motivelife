import { z } from "zod";
import { prisma } from "@forward/database";
import type { VoicePracticeDomain, VoicePracticeMode, VoicePracticePayload } from "@forward/shared";
import {
  VOICE_PRACTICE_MODES_BY_DOMAIN,
  pickPracticePrompt,
  practiceDomainForMode,
} from "@forward/shared";
import { scoreVoicePractice } from "@forward/ai";
import { getSession } from "@/lib/session";
import { badRequest, json, unauthorized, serverError } from "@/lib/api";

const ALL_MODES = [
  ...VOICE_PRACTICE_MODES_BY_DOMAIN.career,
  ...VOICE_PRACTICE_MODES_BY_DOMAIN.relationships,
  ...VOICE_PRACTICE_MODES_BY_DOMAIN.leadership,
] as const;

const postSchema = z.object({
  transcript: z.string().min(10).max(8000),
  mode: z.enum(ALL_MODES as unknown as [VoicePracticeMode, ...VoicePracticeMode[]]),
  durationSeconds: z.number().min(3).max(600),
  prompt: z.string().max(500).optional(),
});

function toPayload(row: {
  id: string;
  transcript: string;
  actions: string;
  createdAt: Date;
}): VoicePracticePayload | null {
  try {
    const parsed = JSON.parse(row.actions) as {
      practice?: Omit<VoicePracticePayload, "id" | "transcript" | "createdAt">;
    };
    if (!parsed.practice) return null;
    const { domain, ...practiceRest } = parsed.practice;
    return {
      id: row.id,
      transcript: row.transcript,
      createdAt: row.createdAt.toISOString(),
      ...practiceRest,
      domain: domain ?? practiceDomainForMode(parsed.practice.mode),
    };
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const { searchParams } = new URL(request.url);
    const domain = searchParams.get("domain") as VoicePracticeDomain | null;

    const rows = await prisma.voiceCapture.findMany({
      where: { userId: session.id, source: "voice_practice" },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    let sessions = rows
      .map((row) => toPayload(row))
      .filter((s): s is VoicePracticePayload => s !== null);

    if (domain === "career" || domain === "relationships") {
      sessions = sessions.filter((s) => s.domain === domain);
    }

    return json({ sessions: sessions.slice(0, 8) });
  } catch (error) {
    console.error("[api/voice-practice]", error);
    return serverError("Voice practice unavailable.");
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const body = await request.json();
    const parsed = postSchema.safeParse(body);
    if (!parsed.success) return badRequest("Practice answer too short — aim for at least 20 seconds.");

    const { transcript, mode, durationSeconds } = parsed.data;
    const domain = practiceDomainForMode(mode as VoicePracticeMode);
    const prompt = parsed.data.prompt ?? pickPracticePrompt(mode as VoicePracticeMode);

    const { scores, tips, coachNote } = scoreVoicePractice(
      transcript,
      mode as VoicePracticeMode,
      durationSeconds
    );

    const practice = {
      domain,
      mode: mode as VoicePracticeMode,
      prompt,
      durationSeconds,
      scores,
      tips,
      coachNote,
    };

    const row = await prisma.voiceCapture.create({
      data: {
        userId: session.id,
        transcript,
        summary: coachNote,
        mood: scores.overall >= 75 ? "energized" : scores.overall >= 60 ? "neutral" : "anxious",
        signals: JSON.stringify([
          domain === "relationships" ? "relationship_signal" : "career_signal",
          "voice_practice",
        ]),
        actions: JSON.stringify({ practice }),
        source: "voice_practice",
      },
    });

    const payload: VoicePracticePayload = {
      id: row.id,
      transcript,
      createdAt: row.createdAt.toISOString(),
      ...practice,
    };

    return json({ session: payload }, 201);
  } catch (error) {
    console.error("[api/voice-practice]", error);
    return serverError("Could not score voice practice.");
  }
}
