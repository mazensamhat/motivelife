import { z } from "zod";
import { prisma } from "@forward/database";
import { getSession } from "@/lib/session";
import { badRequest, json, unauthorized, serverError } from "@/lib/api";
import { loadKashuForecast } from "@/lib/kashu/load";

const schema = z.object({
  question: z.string().min(2).max(500),
});

function answerFromForecast(
  question: string,
  forecast: Awaited<ReturnType<typeof loadKashuForecast>>["forecast"]
): string {
  const q = question.toLowerCase();
  const money = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

  if (/safe to spend|can i spend|how much.*(spend|use)/.test(q)) {
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
    return `Safety floor ${money(forecast.safetyFloor)} is excluded from Safe to Spend. Emergency reserve ${money(forecast.emergencyReserve)} is protected and not used in the normal forecast.`;
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

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest("Ask a cash-flow question.");

    const { forecast } = await loadKashuForecast(session.id);
    let answer = answerFromForecast(parsed.data.question, forecast);

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
                content: `You are Kashu, MyMotiveLife cash-flow intelligence. Answer ONLY from the structured forecast JSON. Be specific with dates and dollar amounts. Never invent bills. If unknown, say what to upload or enter. Keep answers under 80 words.`,
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

    return json({ answer, forecastSummary: forecast.message });
  } catch (error) {
    console.error("[api/kashu/ask]", error);
    return serverError("Kashu could not answer that.");
  }
}
