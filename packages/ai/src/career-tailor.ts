import type { TailoredCareerBriefing } from "@forward/shared";
import { DEFAULT_LIFE_PREFERENCES } from "@forward/shared";
import { buildPersonaSystemPrompt } from "./persona-prompt";

export type TailorCareerInput = {
  resumeText: string;
  company: string;
  role: string;
  jobUrl?: string | null;
  notes?: string | null;
  nextStep?: string | null;
  userName?: string | null;
};

export function generateTailoredCareerBriefingRules(input: TailorCareerInput): TailoredCareerBriefing {
  const { company, role } = input;
  return {
    dynamicOpening: `You're targeting ${role} at ${company} — today should move that application forward.`,
    chiefOfStaffLine: `I've reviewed your resume against ${role} at ${company}. Lead with outcomes that match their stack and scope; tighten your summary before you apply or interview.`,
    challengeLine: `Block 25 minutes to tailor your resume summary and top two bullets for ${company}.`,
    resumeEdits: [
      `Rewrite your summary to mirror "${role}" language from the posting`,
      `Add one quantified win that maps to ${company}'s likely priorities`,
      `Move the most relevant skills for this role to the top of your skills section`,
    ],
    generatedAt: new Date().toISOString(),
  };
}

export async function generateTailoredCareerBriefingWithAI(
  input: TailorCareerInput,
  apiKey: string
): Promise<TailoredCareerBriefing> {
  const fallback = generateTailoredCareerBriefingRules(input);

  try {
    const schema = `{
  "dynamicOpening": string,
  "chiefOfStaffLine": string,
  "challengeLine": string|null,
  "resumeEdits": string[3-5]
}`;

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
            content: `${buildPersonaSystemPrompt({
              userName: input.userName ?? null,
              beliefs: [],
              preferences: DEFAULT_LIFE_PREFERENCES,
              activeContext: null,
              lifeDestination: null,
              graph: null,
              learnedToday: [],
            })}\n\nYou are tailoring a user's chief of staff briefing for a specific job application. Be direct, warm, no emojis. Output JSON only.`,
          },
          {
            role: "user",
            content: `Job: ${input.role} at ${input.company}
${input.jobUrl ? `Posting: ${input.jobUrl}` : ""}
${input.notes ? `Notes: ${input.notes}` : ""}
${input.nextStep ? `Next step: ${input.nextStep}` : ""}

Resume (excerpt):
${input.resumeText.slice(0, 12000)}

Return JSON matching:
${schema}

dynamicOpening: one sentence hook for Today dashboard referencing this role.
chiefOfStaffLine: 2-3 sentences as their chief of staff — what you noticed in their resume vs this role.
challengeLine: one concrete 20-30 min action for today, or null.
resumeEdits: specific bullet edits (not generic advice).`,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.4,
      }),
    });

    if (!response.ok) return fallback;

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return fallback;

    const parsed = JSON.parse(content) as Partial<TailoredCareerBriefing>;
    return {
      dynamicOpening: parsed.dynamicOpening?.trim() || fallback.dynamicOpening,
      chiefOfStaffLine: parsed.chiefOfStaffLine?.trim() || fallback.chiefOfStaffLine,
      challengeLine:
        parsed.challengeLine === null
          ? null
          : parsed.challengeLine?.trim() || fallback.challengeLine,
      resumeEdits:
        parsed.resumeEdits?.filter((line) => typeof line === "string" && line.trim()).slice(0, 5) ??
        fallback.resumeEdits,
      generatedAt: new Date().toISOString(),
    };
  } catch {
    return fallback;
  }
}

export function parseTailoredCareerBriefing(raw: string | null | undefined): TailoredCareerBriefing | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as TailoredCareerBriefing;
    if (!parsed.chiefOfStaffLine || !parsed.dynamicOpening) return null;
    return parsed;
  } catch {
    return null;
  }
}
