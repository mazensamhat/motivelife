import { z } from "zod";
import { prisma } from "@forward/database";
import { getSession } from "@/lib/session";
import { badRequest, json, unauthorized, serverError } from "@/lib/api";
import { loadKashuForecast } from "@/lib/kashu/load";
import { ensureKashuSchema } from "@/lib/kashu/ensure-schema";
import { getOpenAiApiKey, OPENAI_MODEL } from "@/lib/openai-config";
import { extractSpendAmount } from "@/lib/kashu/conversation";
import { runKashuWhatIf } from "@/lib/kashu/forecast";
import { toKashuMoneyRows, toKashuProfileRow } from "@/lib/kashu/load";
import { getOrCreateFinancialProfile } from "@/lib/life-finance-engine";

const schema = z.object({
  message: z.string().min(1).max(2000),
  history: z
    .array(z.object({ role: z.enum(["user", "vyra"]), text: z.string().max(2000) }))
    .max(16)
    .optional(),
});

function money(n: number) {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest("Ask VYRA a life question.");

    const message = parsed.data.message.trim();
    await ensureKashuSchema();

    const [kashu, goals, user, items, profileRow] = await Promise.all([
      loadKashuForecast(session.id).catch(() => null),
      prisma.goal.findMany({
        where: { userId: session.id, status: { not: "COMPLETED" } },
        orderBy: { updatedAt: "desc" },
        take: 8,
        select: { title: true, domain: true, progress: true },
      }),
      prisma.user.findUnique({
        where: { id: session.id },
        select: { lifeDestination: true, name: true },
      }),
      prisma.moneyItem.findMany({ where: { userId: session.id } }),
      getOrCreateFinancialProfile(session.id),
    ]);

    const specialists: Array<{ id: string; label: string; href: string; note: string }> = [];
    const q = message.toLowerCase();

    let kashuNote: string | null = null;
    const spend = extractSpendAmount(message);
    if (kashu && (/afford|spend|cash|money|bill|payday|kashu|safe to spend/.test(q) || spend)) {
      specialists.push({
        id: "kashu",
        label: "Kashu",
        href: spend ? "/kashu" : "/kashu",
        note: "Money specialist",
      });
      if (spend) {
        const whatIf = runKashuWhatIf(toKashuProfileRow(profileRow), toKashuMoneyRows(items), {
          spendToday: spend,
        });
        kashuNote = whatIf.explanation;
      } else {
        kashuNote = `Kashu: Safe to Spend ${money(kashu.forecast.safeToSpend)}. ${kashu.forecast.message}`;
      }
    }

    if (/goal|uplift|destination|vacation|mission|progress/.test(q) || /goal/.test(q)) {
      specialists.push({
        id: "uplift",
        label: "UPLIFT",
        href: "/goals",
        note: "Goals specialist",
      });
    }
    if (/job|career|resume|interview|salary|offer/.test(q)) {
      specialists.push({
        id: "career",
        label: "Career",
        href: "/career",
        note: "Work specialist",
      });
    }
    if (/family|kids|drive|commute|kinzo/.test(q)) {
      specialists.push({
        id: "kinzo",
        label: "KINZO",
        href: "/family-map",
        note: "Family specialist",
      });
    }
    if (/today|schedule|task|dayo|mission/.test(q)) {
      specialists.push({
        id: "dayo",
        label: "DayO",
        href: "/dashboard",
        note: "Today specialist",
      });
    }

    const briefing = {
      destination: user?.lifeDestination ?? null,
      goals: goals.map((g) => `${g.title} (${g.progress}%)`),
      kashu: kashu
        ? {
            safeToSpend: kashu.forecast.safeToSpend,
            projectedLow: kashu.forecast.projectedLow,
            nextPayday: kashu.forecast.nextPayday,
            collisions: kashu.forecast.collisions.slice(0, 3),
            message: kashu.forecast.message,
          }
        : null,
      kashuNote,
    };

    let answer =
      kashuNote ??
      (user?.lifeDestination
        ? `Your UPLIFT destination is “${user.lifeDestination}”. `
        : "No UPLIFT destination yet — set one in UPLIFT. ") +
        (kashu
          ? `Kashu says Safe to Spend is ${money(kashu.forecast.safeToSpend)}. `
          : "") +
        "I don’t replace specialists — I route the decision.";

    if (/should i take this job|change jobs|new job/.test(q)) {
      answer = [
        user?.lifeDestination
          ? `UPLIFT destination: ${user.lifeDestination}.`
          : "UPLIFT has no destination yet — set where you’re headed.",
        kashu
          ? `Kashu: Safe to Spend ${money(kashu.forecast.safeToSpend)}${kashu.forecast.collisions.length ? `; ${kashu.forecast.collisions.length} cash-flow collision(s) on the radar` : "; no collisions this horizon"}.`
          : "Kashu doesn’t have a cash-flow model yet.",
        "A job change is a life decision: career fit + cash-flow + calendar + family commute. Open Career for the role, Kashu for money, KINZO if the commute hits household logistics.",
      ].join(" ");
    }

    const apiKey = getOpenAiApiKey();
    if (apiKey) {
      try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: OPENAI_MODEL,
            temperature: 0.25,
            messages: [
              {
                role: "system",
                content: `You are VYRA, MotiveLife Chief of Staff. You synthesize specialists — you do not own goals (UPLIFT) or money (Kashu) or family (KINZO) or the day (DayO).
Answer in under 90 words. Cite which specialist you consulted. Never invent bills, balances, or goals. If money is involved, use the Kashu JSON only.`,
              },
              {
                role: "user",
                content: `Briefing:\n${JSON.stringify(briefing)}\n\nQuestion: ${message}`,
              },
            ],
          }),
        });
        if (response.ok) {
          const data = (await response.json()) as {
            choices?: Array<{ message?: { content?: string } }>;
          };
          const content = data.choices?.[0]?.message?.content?.trim();
          if (content) answer = content;
        }
      } catch (error) {
        console.warn("[vyra/ask] openai", error);
      }
    }

    if (specialists.length === 0) {
      specialists.push(
        { id: "uplift", label: "UPLIFT", href: "/goals", note: "Goals" },
        { id: "kashu", label: "Kashu", href: "/kashu", note: "Money" },
        { id: "dayo", label: "DayO", href: "/dashboard", note: "Today" }
      );
    }

    return json({ answer, specialists, briefing });
  } catch (error) {
    console.error("[api/vyra/ask]", error);
    return serverError("VYRA could not answer that.");
  }
}
