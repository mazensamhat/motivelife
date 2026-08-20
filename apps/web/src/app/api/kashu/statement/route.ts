import { prisma } from "@forward/database";
import { getSession } from "@/lib/session";
import { badRequest, json, unauthorized, serverError } from "@/lib/api";
import { getOrCreateFinancialProfile } from "@/lib/life-finance-engine";
import { uploadMarketingTempFetchableUrl } from "@/lib/marketing-blob-temp";
import {
  extractStatementText,
  parseStatementWithAi,
  payFrequencyFromGuess,
} from "@/lib/kashu/statement-parse";
import { ensureKashuSchema } from "@/lib/kashu/ensure-schema";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    await ensureKashuSchema();
    const statements = await prisma.kashuStatement.findMany({
      where: { userId: session.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        fileName: true,
        mimeType: true,
        status: true,
        createdAt: true,
        parsedJson: true,
      },
    });

    return json({
      statements: statements.map((s) => ({
        id: s.id,
        fileName: s.fileName,
        mimeType: s.mimeType,
        status: s.status,
        createdAt: s.createdAt.toISOString(),
        summary: (() => {
          try {
            return s.parsedJson ? (JSON.parse(s.parsedJson) as { summary?: string }).summary : null;
          } catch {
            return null;
          }
        })(),
      })),
    });
  } catch (error) {
    console.error("[api/kashu/statement GET]", error);
    return serverError("Could not load statements.");
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    await ensureKashuSchema();
    const contentType = request.headers.get("content-type") ?? "";
    let rawText = "";
    let fileName = "pasted-statement.txt";
    let mimeType = "text/plain";
    let blobPath: string | undefined;

    if (contentType.includes("application/json")) {
      const body = (await request.json()) as { text?: string; fileName?: string };
      if (!body.text?.trim()) return badRequest("Paste statement text or upload a PDF/CSV.");
      rawText = body.text.trim().slice(0, 80_000);
      fileName = body.fileName?.trim() || fileName;
    } else {
      const form = await request.formData();
      const file = form.get("file");
      const pasted = form.get("text");
      if (typeof pasted === "string" && pasted.trim()) {
        rawText = pasted.trim().slice(0, 80_000);
        fileName = "pasted-statement.txt";
      } else if (file instanceof File) {
        const buffer = Buffer.from(await file.arrayBuffer());
        fileName = file.name || "statement.pdf";
        mimeType = file.type || "application/octet-stream";
        rawText = await extractStatementText(buffer, fileName, mimeType);
        try {
          const blobUrl = await uploadMarketingTempFetchableUrl(
            `kashu-statements/${session.id}/${Date.now()}-${fileName.replace(/[^\w.-]+/g, "_")}`,
            buffer,
            mimeType
          );
          if (blobUrl) blobPath = blobUrl;
        } catch (error) {
          console.warn("[kashu/statement] blob skipped", error);
        }
      } else {
        return badRequest("Choose a PDF/CSV/TXT file or paste statement text.");
      }
    }

    if (!rawText.trim()) {
      return badRequest("Could not read text from that file. Try a PDF export, CSV, or paste.");
    }

    const apiKey = process.env.OPENAI_API_KEY;
    const parsed = await parseStatementWithAi(rawText, apiKey);

    const statement = await prisma.kashuStatement.create({
      data: {
        userId: session.id,
        fileName,
        mimeType,
        blobPath,
        rawText,
        parsedJson: JSON.stringify(parsed),
        status: "parsed",
      },
    });

    if (parsed.transactions?.length) {
      await prisma.kashuTransaction.createMany({
        data: parsed.transactions.slice(0, 500).map((t) => ({
          userId: session.id,
          statementId: statement.id,
          postedAt: new Date(t.postedAt),
          description: t.description.slice(0, 200),
          merchantNorm: t.merchantNorm?.slice(0, 120) ?? null,
          amount: t.amount,
          direction: t.direction,
          balanceAfter: t.balanceAfter ?? null,
          classification: t.classification,
          isTransfer: Boolean(t.isTransfer),
          isOneOff: Boolean(t.isOneOff),
        })),
      });
    }

    // Upsert pending recurring candidates
    let candidatesCreated = 0;
    for (const r of parsed.recurring ?? []) {
      const existing = await prisma.kashuRecurringCandidate.findFirst({
        where: {
          userId: session.id,
          merchantNorm: r.merchantNorm,
          status: { in: ["pending", "confirmed"] },
        },
      });
      if (existing) continue;
      await prisma.kashuRecurringCandidate.create({
        data: {
          userId: session.id,
          merchantNorm: r.merchantNorm,
          title: r.title.slice(0, 120),
          amount: r.amount,
          amountMin: r.amountMin,
          amountMax: r.amountMax,
          frequency: r.frequency,
          intervalDays: r.intervalDays,
          nextDueDate: r.nextDueDate ? new Date(r.nextDueDate) : null,
          priority: r.priority,
          confidence: r.confidence,
          autoPay: Boolean(r.autoPay),
          status: "pending",
        },
      });
      candidatesCreated += 1;
    }

    // Apply balance + payday guesses to profile when present
    await getOrCreateFinancialProfile(session.id);
    const profilePatch: {
      liquidBalance?: number;
      nextPayday?: Date;
      payFrequency?: string;
    } = {};
    if (typeof parsed.endingBalance === "number" && parsed.endingBalance >= 0) {
      profilePatch.liquidBalance = parsed.endingBalance;
    }
    if (parsed.paydayGuess) {
      const d = new Date(parsed.paydayGuess);
      if (!Number.isNaN(d.getTime())) profilePatch.nextPayday = d;
    }
    const freq = payFrequencyFromGuess(parsed.payFrequencyGuess);
    if (freq) profilePatch.payFrequency = freq;

    if (Object.keys(profilePatch).length) {
      await prisma.financialProfile.update({
        where: { userId: session.id },
        data: profilePatch,
      });
    }

    try {
      const { applyObservation, teachFromTransactions } = await import("@/lib/kashu/learning");
      const { loadLearningState, saveLearningState } = await import("@/lib/kashu/learning-store");
      let learning = await loadLearningState(session.id);
      if (typeof parsed.endingBalance === "number") {
        learning = applyObservation(learning, parsed.endingBalance, "statement");
      }
      const bills = await prisma.moneyItem.findMany({
        where: { userId: session.id },
        select: { title: true, currentAmount: true },
      });
      const profile = await prisma.financialProfile.findUnique({
        where: { userId: session.id },
        select: { lifestyleBurnDaily: true },
      });
      const lessons = teachFromTransactions(
        (parsed.transactions ?? []).map((t) => ({
          postedAt: t.postedAt,
          amount: t.amount,
          direction: t.direction,
          classification: t.classification,
          isTransfer: t.isTransfer,
          description: t.description,
        })),
        bills,
        profile?.lifestyleBurnDaily ?? 0
      );
      if (lessons.length) {
        learning.lessons = [...lessons, ...learning.lessons].slice(0, 8);
      }
      await saveLearningState(session.id, learning);
    } catch (error) {
      console.warn("[kashu statement] learning", error);
    }

    const txs = parsed.transactions ?? [];
    const classificationCounts: Record<string, number> = {};
    for (const t of txs) {
      const key = t.classification || "other";
      classificationCounts[key] = (classificationCounts[key] ?? 0) + 1;
    }

    const payroll = txs
      .filter(
        (t) =>
          t.direction === "credit" &&
          (t.classification === "income" ||
            /payroll|salary|direct deposit|wage|paycheque|paycheck|employer/i.test(
              t.description
            ))
      )
      .slice(0, 10)
      .map((t) => ({
        title: t.description.slice(0, 80),
        amount: t.amount,
        date: t.postedAt?.slice(0, 10) ?? null,
        emoji: "🥳",
      }));

    // Surface all pending commitments for the live scan board.
    const pending = await prisma.kashuRecurringCandidate.findMany({
      where: { userId: session.id, status: "pending" },
      orderBy: { confidence: "desc" },
      take: 30,
    });
    const commitments = pending.map((row) => ({
      id: row.id,
      title: row.title,
      amount: row.amount,
      frequency: row.frequency,
      priority: row.priority,
      confidence: row.confidence,
      nextDueDate: row.nextDueDate ? row.nextDueDate.toISOString().slice(0, 10) : null,
    }));

    return json({
      ok: true,
      statementId: statement.id,
      summary: parsed.summary ?? null,
      endingBalance: parsed.endingBalance ?? null,
      transactionCount: txs.length,
      recurringCandidates: candidatesCreated,
      payFrequencyGuess: freq,
      paydayGuess: parsed.paydayGuess ?? null,
      scan: {
        statementId: statement.id,
        summary: parsed.summary ?? null,
        endingBalance: parsed.endingBalance ?? null,
        transactionCount: txs.length,
        recurringCandidates: candidatesCreated,
        payFrequencyGuess: freq,
        paydayGuess: parsed.paydayGuess ?? null,
        payroll,
        commitments: commitments.map((c) => ({
          id: c.id,
          title: c.title,
          amount: c.amount,
          date: c.nextDueDate,
          frequency: c.frequency,
          priority: c.priority,
          confidence: c.confidence,
          emoji: commitmentEmoji(c.title, c.priority),
        })),
        classificationCounts,
      },
    });
  } catch (error) {
    console.error("[api/kashu/statement POST]", error);
    const message = error instanceof Error ? error.message : "Could not parse statement.";
    return badRequest(message);
  }
}

function commitmentEmoji(title: string, priority: string): string {
  const t = title.toLowerCase();
  if (/rent|mortgage|housing/.test(t)) return "🏠";
  if (/insurance/.test(t)) return "🛡️";
  if (/phone|mobile|bell|rogers/.test(t)) return "📱";
  if (/netflix|disney|spotify|streaming/.test(t)) return "📺";
  if (/gym|fitness/.test(t)) return "💪";
  if (/car|auto|lease/.test(t)) return "🚗";
  if (/hydro|electric|gas|utility/.test(t)) return "⚡";
  if (priority === "LIFESTYLE" || priority === "DISCRETIONARY") return "✨";
  return "🧾";
}
