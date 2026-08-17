import { z } from "zod";
import { prisma } from "@forward/database";
import {
  KASHU_INCOME_KINDS,
  KASHU_ITEM_FREQUENCIES,
  KASHU_PAY_FREQUENCIES,
  KASHU_PRIORITIES,
  MONEY_ITEM_TYPES,
  type KashuChatTurn,
  type KashuProposal,
} from "@forward/shared";
import { getSession } from "@/lib/session";
import { badRequest, json, unauthorized, serverError } from "@/lib/api";
import { loadKashuForecast, toKashuMoneyRows, toKashuProfileRow } from "@/lib/kashu/load";
import { runKashuWhatIf } from "@/lib/kashu/forecast";
import { ensureKashuSchema } from "@/lib/kashu/ensure-schema";
import { getOrCreateFinancialProfile } from "@/lib/life-finance-engine";
import {
  answerFromForecast,
  buildFollowUps,
  composeProposalAnswer,
  extractSpendAmount,
  interpretKashuMessage,
  isConfirmUtterance,
  isRejectUtterance,
} from "@/lib/kashu/conversation";
import { applyKashuProposals } from "@/lib/kashu/apply-proposals";

const proposalSchema: z.ZodType<KashuProposal> = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("profile"),
    id: z.string(),
    label: z.string(),
    patch: z.object({
      monthlyTakeHome: z.number().positive().optional().nullable(),
      payFrequency: z.enum(KASHU_PAY_FREQUENCIES).optional().nullable(),
      nextPayday: z.string().optional().nullable(),
      paydayAnchorDay: z.number().int().min(1).max(31).optional().nullable(),
      liquidBalance: z.number().min(0).optional().nullable(),
      safetyFloor: z.number().min(0).optional().nullable(),
      emergencyReserve: z.number().min(0).optional().nullable(),
      lifestyleBurnDaily: z.number().min(0).optional().nullable(),
      incomeKind: z.enum(KASHU_INCOME_KINDS).optional().nullable(),
      incomeConservative: z.number().min(0).optional().nullable(),
      incomeHigh: z.number().min(0).optional().nullable(),
    }),
  }),
  z.object({
    kind: z.enum(["add_bill", "update_bill"]),
    id: z.string(),
    label: z.string(),
    existingId: z.string().optional(),
    bill: z.object({
      title: z.string().min(1).max(200),
      amount: z.number().positive(),
      type: z.enum(MONEY_ITEM_TYPES),
      frequency: z.enum(KASHU_ITEM_FREQUENCIES),
      intervalDays: z.number().int().positive().optional().nullable(),
      dueDay: z.number().int().min(1).max(31).optional().nullable(),
      nextDueDate: z.string().optional().nullable(),
      priority: z.enum(KASHU_PRIORITIES),
      autoPay: z.boolean().optional(),
    }),
  }),
]);

const schema = z.object({
  message: z.string().min(1).max(4000).optional(),
  question: z.string().min(1).max(4000).optional(),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "kashu"]),
        text: z.string().max(4000),
      })
    )
    .max(24)
    .optional(),
  pendingProposals: z.array(proposalSchema).max(20).optional(),
  apply: z.array(proposalSchema).max(20).optional(),
});

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    await ensureKashuSchema();
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest("Ask Kashu a cash-flow question, or tell it your income and bills.");

    const message = (parsed.data.message ?? parsed.data.question ?? "").trim();
    const history: KashuChatTurn[] = parsed.data.history ?? [];

    let applied: Awaited<ReturnType<typeof applyKashuProposals>> | undefined;
    const toApply =
      parsed.data.apply ??
      (message && isConfirmUtterance(message) && parsed.data.pendingProposals?.length
        ? parsed.data.pendingProposals
        : null);

    if (toApply?.length) {
      applied = await applyKashuProposals(session.id, toApply);
    }

    const loaded = await loadKashuForecast(session.id);
    const { forecast, profile } = loaded;
    const items = await prisma.moneyItem.findMany({ where: { userId: session.id } });

    if (toApply?.length && (!message || isConfirmUtterance(message))) {
      const bits: string[] = [];
      if (applied?.profileUpdated) bits.push("income and buffers");
      if (applied && applied.billsCreated > 0) {
        bits.push(`${applied.billsCreated} bill${applied.billsCreated === 1 ? "" : "s"}`);
      }
      if (applied && applied.billsUpdated > 0) {
        bits.push(`${applied.billsUpdated} updated`);
      }
      const answer = `Saved ${bits.join(" · ") || "your updates"}. Safe to Spend is now ${forecast.safeToSpend.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}. ${forecast.message}`;
      return json({
        answer,
        proposals: [],
        followUps: buildFollowUps(profile, forecast, items.length),
        whatIf: null,
        forecastSummary: forecast.message,
        applied,
      });
    }

    if (message && isRejectUtterance(message)) {
      return json({
        answer: "Okay — nothing saved. Tell me the amounts again, or ask a cash-flow question.",
        proposals: [],
        followUps: buildFollowUps(profile, forecast, items.length),
        whatIf: null,
        forecastSummary: forecast.message,
      });
    }

    if (!message) return badRequest("Say something to Kashu.");

    const knownBills = items.map((i) => ({
      id: i.id,
      title: i.title,
      currentAmount: i.currentAmount,
      type: i.type,
      frequency: i.frequency,
      dueDay: i.dueDay,
    }));

    const { proposals, llmReply } = await interpretKashuMessage({
      message,
      history,
      profile,
      bills: knownBills,
      forecast,
    });

    const spendAmount = extractSpendAmount(message);
    let whatIf: ReturnType<typeof runKashuWhatIf> | null = null;
    if (
      proposals.length === 0 &&
      spendAmount != null &&
      /can i|afford|spend|weekend|today|buy/i.test(message)
    ) {
      const profileRow = await getOrCreateFinancialProfile(session.id);
      whatIf = runKashuWhatIf(toKashuProfileRow(profileRow), toKashuMoneyRows(items), {
        spendToday: spendAmount,
      });
    }

    let answer: string;
    if (proposals.length > 0) {
      answer = llmReply?.includes("confirm") || llmReply?.includes("add")
        ? llmReply!
        : composeProposalAnswer(proposals, forecast);
      if (llmReply && !proposals.length) answer = llmReply;
    } else if (llmReply) {
      answer = llmReply;
    } else {
      answer = answerFromForecast(message, forecast, whatIf?.explanation ?? null);
    }

    return json({
      answer,
      proposals,
      followUps: buildFollowUps(profile, forecast, items.length),
      whatIf: whatIf
        ? {
            spendToday: spendAmount,
            verdict: whatIf.verdict,
            canAfford: whatIf.canAfford,
            explanation: whatIf.explanation,
          }
        : null,
      forecastSummary: forecast.message,
      applied,
    });
  } catch (error) {
    console.error("[api/kashu/ask]", error);
    return serverError("Kashu could not answer that.");
  }
}
