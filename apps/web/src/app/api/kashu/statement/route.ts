import { prisma } from "@forward/database";
import { getSession } from "@/lib/session";
import { badRequest, json, unauthorized, serverError } from "@/lib/api";
import { getOrCreateFinancialProfile } from "@/lib/life-finance-engine";
import { uploadMarketingTempFetchableUrl } from "@/lib/marketing-blob-temp";
import {
  assertStatementBatchLimits,
  classifyStatementFile,
  extractStatementText,
  parseStatementSourcesWithAi,
  payFrequencyFromGuess,
  type StatementSourceInput,
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
            return s.parsedJson
              ? (JSON.parse(s.parsedJson) as { summary?: string }).summary
              : null;
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

function collectFormFiles(form: FormData): File[] {
  const out: File[] = [];
  for (const key of ["files", "file"]) {
    for (const value of form.getAll(key)) {
      if (value instanceof File && value.size > 0) out.push(value);
    }
  }
  // Dedupe by name+size+lastModified in case both keys were sent.
  const seen = new Set<string>();
  return out.filter((f) => {
    const key = `${f.name}:${f.size}:${f.lastModified}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    await ensureKashuSchema();
    const contentType = request.headers.get("content-type") ?? "";
    const sources: StatementSourceInput[] = [];
    let blobPath: string | undefined;
    const sourceMeta: Array<{ fileName: string; kind: StatementSourceInput["kind"] }> = [];

    if (contentType.includes("application/json")) {
      const body = (await request.json()) as { text?: string; fileName?: string };
      if (!body.text?.trim()) {
        return badRequest("Paste statement text or upload PDF / CSV / screenshots.");
      }
      sources.push({
        fileName: body.fileName?.trim() || "pasted-statement.txt",
        mimeType: "text/plain",
        kind: "paste",
        text: body.text.trim().slice(0, 80_000),
      });
      sourceMeta.push({ fileName: sources[0]!.fileName, kind: "paste" });
    } else {
      const form = await request.formData();
      const pasted = form.get("text");
      if (typeof pasted === "string" && pasted.trim()) {
        sources.push({
          fileName: "pasted-statement.txt",
          mimeType: "text/plain",
          kind: "paste",
          text: pasted.trim().slice(0, 80_000),
        });
        sourceMeta.push({ fileName: "pasted-statement.txt", kind: "paste" });
      }

      const files = collectFormFiles(form);
      if (files.length) {
        try {
          assertStatementBatchLimits(
            files.map((f) => ({ size: f.size, name: f.name || "file" }))
          );
        } catch (error) {
          return badRequest(error instanceof Error ? error.message : "Upload too large.");
        }

        for (const file of files) {
          const fileName = file.name || "statement.bin";
          const mimeType = file.type || "application/octet-stream";
          const kind = classifyStatementFile(fileName, mimeType);
          if (kind === "unsupported") {
            return badRequest(
              `Unsupported file "${fileName}". Use PDF, CSV, TXT, or screenshots (PNG/JPG/WEBP).`
            );
          }

          const buffer = Buffer.from(await file.arrayBuffer());
          sourceMeta.push({ fileName, kind });

          if (kind === "image") {
            sources.push({
              fileName,
              mimeType: mimeType.startsWith("image/") ? mimeType : "image/jpeg",
              kind: "image",
              base64: buffer.toString("base64"),
            });
          } else {
            const text = await extractStatementText(buffer, fileName, mimeType);
            sources.push({
              fileName,
              mimeType,
              kind,
              text,
            });
          }

          // Best-effort store first file for audit; skip if blob unavailable.
          if (!blobPath) {
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
          }
        }
      }

      if (!sources.length) {
        return badRequest(
          "Choose one or more PDF / CSV / TXT / screenshot files, or paste statement text."
        );
      }
    }

    const hasReadable =
      sources.some((s) => s.text?.trim()) || sources.some((s) => s.kind === "image" && s.base64);
    if (!hasReadable) {
      return badRequest(
        "Could not read those files. Try a PDF export, CSV, clearer screenshots, or paste."
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    const parsed = await parseStatementSourcesWithAi(sources, apiKey);

    const batchLabel =
      sourceMeta.length === 1
        ? sourceMeta[0]!.fileName
        : `batch (${sourceMeta.length}): ${sourceMeta
            .map((s) => s.fileName)
            .slice(0, 4)
            .join(", ")}${sourceMeta.length > 4 ? "…" : ""}`;

    const rawText = sources
      .filter((s) => s.text?.trim())
      .map((s) => `===== ${s.fileName} =====\n${s.text}`)
      .join("\n\n")
      .slice(0, 80_000);

    const statement = await prisma.kashuStatement.create({
      data: {
        userId: session.id,
        fileName: batchLabel.slice(0, 200),
        mimeType:
          sourceMeta.length > 1
            ? "application/x-kashu-batch"
            : sourceMeta[0]?.kind === "image"
              ? sources.find((s) => s.kind === "image")?.mimeType || "image/jpeg"
              : sources[0]?.mimeType || "text/plain",
        blobPath,
        rawText:
          rawText ||
          `[image-only batch: ${sourceMeta.map((s) => s.fileName).join(", ")}]`,
        parsedJson: JSON.stringify({ ...parsed, sources: sourceMeta }),
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
      sourceCount: sourceMeta.length,
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
        sources: sourceMeta,
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
