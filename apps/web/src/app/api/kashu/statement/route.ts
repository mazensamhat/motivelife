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

    return json({
      ok: true,
      statementId: statement.id,
      summary: parsed.summary,
      endingBalance: parsed.endingBalance ?? null,
      transactionCount: parsed.transactions?.length ?? 0,
      recurringCandidates: candidatesCreated,
      payFrequencyGuess: freq,
      paydayGuess: parsed.paydayGuess ?? null,
    });
  } catch (error) {
    console.error("[api/kashu/statement POST]", error);
    const message = error instanceof Error ? error.message : "Could not parse statement.";
    return badRequest(message);
  }
}
