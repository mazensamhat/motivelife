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
  shouldAutoConfirmRecurring,
  type StatementSourceInput,
} from "@/lib/kashu/statement-parse";
import { ensureKashuSchema } from "@/lib/kashu/ensure-schema";
import { buildPostScanInsights } from "@/lib/kashu/scan-insights";
import { toKashuMoneyRows, toKashuProfileRow } from "@/lib/kashu/load";
import { derivePayRhythm } from "@/lib/kashu/pay-rhythm";
import { detectPayrollDeposits } from "@/lib/kashu/payroll-detect";

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
    // Optional blob audit path — never blocks the scan.
    const blobPath: string | undefined = undefined;
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

        let prepared: Array<{
          fileName: string;
          mimeType: string;
          kind: StatementSourceInput["kind"];
          buffer: Buffer;
          source: StatementSourceInput;
        }>;
        try {
          prepared = await Promise.all(
            files.map(async (file) => {
              const fileName = file.name || "statement.bin";
              const mimeType = file.type || "application/octet-stream";
              const kind = classifyStatementFile(fileName, mimeType);
              if (kind === "unsupported") {
                throw new Error(
                  `Unsupported file "${fileName}". Use PDF, CSV, TXT, or screenshots (PNG/JPG/WEBP).`
                );
              }
              const buffer = Buffer.from(await file.arrayBuffer());
              if (kind === "image") {
                return {
                  fileName,
                  mimeType: mimeType.startsWith("image/") ? mimeType : "image/jpeg",
                  kind: "image" as const,
                  buffer,
                  source: {
                    fileName,
                    mimeType: mimeType.startsWith("image/") ? mimeType : "image/jpeg",
                    kind: "image" as const,
                    base64: buffer.toString("base64"),
                  } satisfies StatementSourceInput,
                };
              }
              const text = await extractStatementText(buffer, fileName, mimeType);
              return {
                fileName,
                mimeType,
                kind,
                buffer,
                source: {
                  fileName,
                  mimeType,
                  kind,
                  text,
                } satisfies StatementSourceInput,
              };
            })
          );
        } catch (error) {
          return badRequest(error instanceof Error ? error.message : "Could not read files.");
        }

        for (const item of prepared) {
          sourceMeta.push({ fileName: item.fileName, kind: item.kind });
          sources.push(item.source);
        }

        // Fire-and-forget first-file blob — never block the scan response.
        const first = prepared[0];
        if (first) {
          void uploadMarketingTempFetchableUrl(
            `kashu-statements/${session.id}/${Date.now()}-${first.fileName.replace(/[^\w.-]+/g, "_")}`,
            first.buffer,
            first.mimeType
          ).catch((error) => console.warn("[kashu/statement] blob skipped", error));
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
    const recurringList = parsed.recurring ?? [];
    if (recurringList.length) {
      const existing = await prisma.kashuRecurringCandidate.findMany({
        where: {
          userId: session.id,
          status: { in: ["pending", "confirmed"] },
        },
        select: { merchantNorm: true },
      });
      const existingNorms = new Set(
        existing.map((e) => e.merchantNorm).filter(Boolean) as string[]
      );
      const toCreate = recurringList.filter(
        (r) => r.merchantNorm && !existingNorms.has(r.merchantNorm)
      );
      if (toCreate.length) {
        await prisma.kashuRecurringCandidate.createMany({
          data: toCreate.map((r) => ({
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
          })),
        });
        candidatesCreated = toCreate.length;
      }
    }

    // Auto-pin high-confidence TD commitments (mortgage, insurance, utilities…)
    // so the cash calendar fills without forcing a confirm click for every bill.
    let autoPinned = 0;
    const pinnedForReveal: Array<{
      id: string;
      title: string;
      amount: number;
      frequency: string;
      priority: string;
      confidence: number;
      nextDueDate: string | null;
    }> = [];
    const pendingForAuto = await prisma.kashuRecurringCandidate.findMany({
      where: { userId: session.id, status: "pending" },
    });
    for (const c of pendingForAuto) {
      if (!shouldAutoConfirmRecurring(c.title, c.amount, c.confidence)) continue;
      const existingItem = await prisma.moneyItem.findFirst({
        where: {
          userId: session.id,
          title: c.title,
          source: "statement",
        },
      });
      const revealRow = {
        id: c.id,
        title: c.title,
        amount: c.amount,
        frequency: c.frequency,
        priority: c.priority,
        confidence: c.confidence,
        nextDueDate: c.nextDueDate ? c.nextDueDate.toISOString().slice(0, 10) : null,
      };
      if (existingItem) {
        // Refresh amount / due date from latest statement match
        await prisma.moneyItem.update({
          where: { id: existingItem.id },
          data: {
            currentAmount: c.amount,
            frequency: c.frequency,
            intervalDays: c.intervalDays,
            nextDueDate: c.nextDueDate ?? existingItem.nextDueDate,
            dueDay: Math.min(
              28,
              Math.max(1, (c.nextDueDate ?? existingItem.nextDueDate ?? new Date()).getUTCDate())
            ),
            confidence: c.confidence,
            notes: `Matched from statement · ${c.merchantNorm}`,
          },
        });
        await prisma.kashuRecurringCandidate.update({
          where: { id: c.id },
          data: { status: "pending", moneyItemId: existingItem.id },
        });
        autoPinned += 1;
        pinnedForReveal.push(revealRow);
        continue;
      }
      const next = c.nextDueDate ?? new Date();
      const dueDay = Math.min(28, Math.max(1, next.getUTCDate()));
      const moneyType =
        c.priority === "LIFESTYLE" || c.priority === "DISCRETIONARY"
          ? "LIVING_EXPENSE"
          : /netflix|spotify|fitness/i.test(c.title)
            ? "SUBSCRIPTION"
            : "BILL";
      const item = await prisma.moneyItem.create({
        data: {
          userId: session.id,
          type: moneyType,
          title: c.title,
          currentAmount: c.amount,
          dueDay,
          autoPay: c.autoPay,
          frequency: c.frequency,
          intervalDays: c.intervalDays,
          nextDueDate: next,
          priority: c.priority,
          confidence: c.confidence,
          source: "statement",
          notes: `Auto-pinned from statement · ${c.merchantNorm}`,
        },
      });
      // Keep pending so Bills tab can Confirm for Timing (calendar already has the MoneyItem).
      await prisma.kashuRecurringCandidate.update({
        where: { id: c.id },
        data: { status: "pending", moneyItemId: item.id },
      });
      autoPinned += 1;
      pinnedForReveal.push(revealRow);
    }

    await getOrCreateFinancialProfile(session.id);
    const profilePatch: {
      liquidBalance?: number;
      nextPayday?: Date;
      payFrequency?: string;
      monthlyTakeHome?: number;
    } = {};
    if (typeof parsed.endingBalance === "number" && parsed.endingBalance >= 0) {
      profilePatch.liquidBalance = parsed.endingBalance;
    }

    const payrollDeposits = detectPayrollDeposits(
      (parsed.transactions ?? [])
        .filter((t) => t.direction === "credit" && t.amount >= 400)
        .map((t) => ({
          postedAt: (t.postedAt ?? "").slice(0, 10),
          amount: t.amount,
          description: t.description,
          classification: t.classification,
          direction: t.direction,
        }))
    );
    const rhythm = derivePayRhythm(payrollDeposits);
    if (rhythm) {
      profilePatch.payFrequency = rhythm.payFrequency;
      profilePatch.nextPayday = new Date(`${rhythm.nextPayday}T12:00:00`);
      profilePatch.monthlyTakeHome = rhythm.monthlyTakeHome;
    } else {
      const freq = payFrequencyFromGuess(parsed.payFrequencyGuess);
      if (freq) profilePatch.payFrequency = freq;
      if (parsed.paydayGuess) {
        let d = new Date(`${parsed.paydayGuess}T12:00:00`);
        if (!Number.isNaN(d.getTime())) {
          const step =
            freq === "WEEKLY" ? 7 : freq === "SEMI_MONTHLY" ? 15 : 14;
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          while (d.getTime() < today.getTime()) {
            d = new Date(d.getTime() + step * 86400000);
          }
          profilePatch.nextPayday = d;
        }
      }
    }

    if (Object.keys(profilePatch).length) {
      await prisma.financialProfile.update({
        where: { userId: session.id },
        data: profilePatch,
      });
      if (rhythm) {
        await prisma.$executeRaw`
          UPDATE "FinancialProfile"
          SET "typicalPaycheck" = ${rhythm.typicalPaycheck}
          WHERE "userId" = ${session.id}
        `.catch(() => {});
      }
    }

    // Also refresh any existing MoneyItems that match recurring titles (even if already confirmed)
    for (const r of recurringList) {
      if (!shouldAutoConfirmRecurring(r.title, r.amount, r.confidence)) continue;
      const match = await prisma.moneyItem.findFirst({
        where: {
          userId: session.id,
          OR: [
            { title: r.title },
            {
              title: {
                contains: r.title.split(" ")[0] ?? r.title,
                mode: "insensitive",
              },
            },
          ],
        },
      });
      if (!match) continue;
      const titleOk =
        match.title.toLowerCase() === r.title.toLowerCase() ||
        (r.merchantNorm &&
          match.title.toUpperCase().includes(r.merchantNorm.split(" ")[0] ?? ""));
      if (!titleOk && Math.abs(match.currentAmount - r.amount) > 50) continue;
      await prisma.moneyItem.update({
        where: { id: match.id },
        data: {
          currentAmount: r.amount,
          nextDueDate: r.nextDueDate ? new Date(r.nextDueDate) : match.nextDueDate,
          frequency: r.frequency,
          intervalDays: r.intervalDays,
          confidence: r.confidence,
          source: match.source ?? "statement",
        },
      });
    }

    // Learning is non-blocking — never hold the scan UI on it.
    void (async () => {
      try {
        const { applyObservation, teachFromTransactions } = await import("@/lib/kashu/learning");
        const { loadLearningState, saveLearningState } = await import(
          "@/lib/kashu/learning-store"
        );
        let learning = await loadLearningState(session.id);
        if (typeof parsed.endingBalance === "number") {
          learning = applyObservation(learning, parsed.endingBalance, "statement");
        }
        const bills = await prisma.moneyItem.findMany({
          where: { userId: session.id },
          select: { title: true, currentAmount: true },
        });
        const profileLearn = await prisma.financialProfile.findUnique({
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
          profileLearn?.lifestyleBurnDaily ?? 0
        );
        if (lessons.length) {
          learning.lessons = [...lessons, ...learning.lessons].slice(0, 8);
        }
        await saveLearningState(session.id, learning);
      } catch (error) {
        console.warn("[kashu statement] learning", error);
      }
    })();

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

    const [pending, moneyItems, profileRow] = await Promise.all([
      prisma.kashuRecurringCandidate.findMany({
        where: { userId: session.id, status: "pending" },
        orderBy: { confidence: "desc" },
        take: 30,
      }),
      prisma.moneyItem.findMany({
        where: { userId: session.id },
        select: {
          id: true,
          type: true,
          title: true,
          currentAmount: true,
          targetAmount: true,
          dueDay: true,
          autoPay: true,
          frequency: true,
          intervalDays: true,
          nextDueDate: true,
          priority: true,
          confidence: true,
        },
      }),
      prisma.financialProfile.findUnique({ where: { userId: session.id } }),
    ]);

    const commitments = [
      ...pinnedForReveal,
      ...pending.map((row) => ({
        id: row.id,
        title: row.title,
        amount: row.amount,
        frequency: row.frequency,
        priority: row.priority,
        confidence: row.confidence,
        nextDueDate: row.nextDueDate ? row.nextDueDate.toISOString().slice(0, 10) : null,
      })),
    ].slice(0, 30);

    let insights = null;
    if (profileRow) {
      try {
        insights = buildPostScanInsights({
          profile: toKashuProfileRow(profileRow),
          moneyItems: toKashuMoneyRows(moneyItems),
          pendingCandidates: pending.map((p) => ({
            id: p.id,
            title: p.title,
            amount: p.amount,
            frequency: p.frequency,
            priority: p.priority,
            nextDueDate: p.nextDueDate,
            autoPay: p.autoPay,
            intervalDays: p.intervalDays,
            confidence: p.confidence,
          })),
        });
      } catch (error) {
        console.warn("[kashu statement] insights", error);
      }
    }

    const freq =
      (rhythm?.payFrequency as ReturnType<typeof payFrequencyFromGuess>) ??
      payFrequencyFromGuess(parsed.payFrequencyGuess);

    return json({
      ok: true,
      statementId: statement.id,
      summary: parsed.summary ?? null,
      endingBalance: parsed.endingBalance ?? null,
      transactionCount: txs.length,
      recurringCandidates: candidatesCreated,
      autoPinned,
      payFrequencyGuess: freq,
      paydayGuess: rhythm?.nextPayday ?? parsed.paydayGuess ?? null,
      sourceCount: sourceMeta.length,
      scan: {
        statementId: statement.id,
        summary: parsed.summary ?? null,
        endingBalance: parsed.endingBalance ?? null,
        transactionCount: txs.length,
        recurringCandidates: candidatesCreated,
        autoPinned,
        payFrequencyGuess: freq,
        paydayGuess: rhythm?.nextPayday ?? parsed.paydayGuess ?? null,
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
        insights,
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
