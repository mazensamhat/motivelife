import { z } from "zod";
import { prisma } from "@forward/database";
import { getSession } from "@/lib/session";
import { badRequest, json, unauthorized, serverError } from "@/lib/api";
import { loadKashuForecast, toKashuMoneyRows, toKashuProfileRow } from "@/lib/kashu/load";
import { runKashuWhatIf } from "@/lib/kashu/forecast";
import { ensureKashuSchema } from "@/lib/kashu/ensure-schema";
import { getOrCreateFinancialProfile } from "@/lib/life-finance-engine";

const schema = z.object({
  question: z.string().min(2).max(500),
});

function extractSpendAmount(question: string): number | null {
  const m =
    question.match(
      /(?:can i (?:afford|spend)|spend|afford)\s*\$?\s*([\d,]+(?:\.\d+)?)/i
    ) ?? question.match(/\$\s*([\d,]+(?:\.\d+)?)/);
  if (!m?.[1]) return null;
  const n = Number(m[1].replace(/,/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function answerFromForecast(
  question: string,
  forecast: Awaited<ReturnType<typeof loadKashuForecast>>["forecast"],
  whatIfExplanation?: string | null
): string {
  const q = question.toLowerCase();
  const money = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

  if (whatIfExplanation) return whatIfExplanation;

  if (/safe to spend|can i spend|how much.*(spend|use)|afford/.test(q)) {
    return `Safe to Spend is ${money(forecast.safeToSpend)} after ${money(forecast.reservedObligations)} reserved and a ${money(forecast.safetyFloor)} safety floor. ${forecast.message}`;
  }
  if (/projected low|lowest|short before|before payday/.test(q)) {
    return `Projected low is ${money(forecast.projectedLow)}${forecast.projectedLowDate ? ` on ${forecast.projectedLowDate}` : ""}. Next payday: ${forecast.nextPayday ?? "not set"}.`;
  }
  if (/collision|shortfall|problem|tight/.test(q)) {
    if (!forecast.collisions.length) {
      return "No cash-flow collisions in the next 30 days above your safety floor.";
    }
    return forecast.collisions
      .slice(0, 3)
      .map((c) => `${c.date}: ${c.title} creates a ${money(c.shortfall)} shortfall.`)
      .join(" ");
  }
  if (/timing|move|optimizer|bell/.test(q) && forecast.timingScenarios.length) {
    return forecast.timingScenarios.map((s) => s.note).join(" ");
  }
  if (/emergency|reserve|buffer|floor/.test(q)) {
    return (
      forecast.emergencyInsight?.message ??
      `Safety floor ${money(forecast.safetyFloor)} is excluded from Safe to Spend. Emergency reserve ${money(forecast.emergencyReserve)} is protected and not used in the normal forecast.`
    );
  }
  if (/payday|next pay|paycheque|paycheck/.test(q)) {
    return `Next payday is ${forecast.nextPayday ?? "not set"} (${forecast.daysUntilPayday ?? "?"} days). Frequency: ${forecast.payFrequency ?? "unknown"}.`;
  }

  return forecast.message;
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    await ensureKashuSchema();
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest("Ask a cash-flow question.");

    const loaded = await loadKashuForecast(session.id);
    const { forecast } = loaded;

    const spendAmount = extractSpendAmount(parsed.data.question);
    let whatIfExplanation: string | null = null;
    let whatIf: ReturnType<typeof runKashuWhatIf> | null = null;

    if (
      spendAmount != null &&
      /can i|afford|spend|weekend|today|buy/i.test(parsed.data.question)
    ) {
      const [profile, items] = await Promise.all([
        getOrCreateFinancialProfile(session.id),
        prisma.moneyItem.findMany({ where: { userId: session.id } }),
      ]);
      whatIf = runKashuWhatIf(toKashuProfileRow(profile), toKashuMoneyRows(items), {
        spendToday: spendAmount,
      });
      whatIfExplanation = whatIf.explanation;
    }

    let answer = answerFromForecast(parsed.data.question, forecast, whatIfExplanation);

    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            temperature: 0.2,
            messages: [
              {
                role: "system",
                content: `You are Kashu, MyMotiveLife cash-flow intelligence. Answer ONLY from the structured forecast JSON and optional what-if result. Be specific with dates and dollar amounts. Never invent bills. If unknown, say what to upload or enter. Keep answers under 80 words.`,
              },
              {
                role: "user",
                content: `Forecast JSON:\n${JSON.stringify({
                  safeToSpend: forecast.safeToSpend,
                  reserved: forecast.reservedObligations,
                  safetyFloor: forecast.safetyFloor,
                  emergencyReserve: forecast.emergencyReserve,
                  projectedLow: forecast.projectedLow,
                  projectedLowDate: forecast.projectedLowDate,
                  nextPayday: forecast.nextPayday,
                  collisions: forecast.collisions,
                  timingScenarios: forecast.timingScenarios,
                  radar: forecast.radar.slice(0, 20),
                  message: forecast.message,
                  whatIf: whatIf
                    ? {
                        spendToday: spendAmount,
                        verdict: whatIf.verdict,
                        verdictLabel: whatIf.verdictLabel,
                        canAfford: whatIf.canAfford,
                        explanation: whatIf.explanation,
                        deltaSafeToSpend: whatIf.deltaSafeToSpend,
                        deltaProjectedLow: whatIf.deltaProjectedLow,
                      }
                    : null,
                })}\n\nQuestion: ${parsed.data.question}`,
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
        console.warn("[kashu/ask] openai fallback", error);
      }
    }

    return json({
      answer,
      forecastSummary: forecast.message,
      whatIf: whatIf
        ? {
            spendToday: spendAmount,
            verdict: whatIf.verdict,
            canAfford: whatIf.canAfford,
            explanation: whatIf.explanation,
          }
        : null,
    });
  } catch (error) {
    console.error("[api/kashu/ask]", error);
    return serverError("Kashu could not answer that.");
  }
}
