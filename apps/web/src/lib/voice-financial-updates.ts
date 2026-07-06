import { prisma } from "@forward/database";
import type { VoiceCaptureAppliedAction, VoiceCapturePlan } from "@forward/shared";
import { getOrCreateFinancialProfile } from "@/lib/life-finance-engine";

function parseMoneyAmount(raw: string): number | null {
  const n = parseFloat(raw.replace(/,/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function isIncomeMoneyNote(note: { title: string; notes?: string }) {
  const text = `${note.title} ${note.notes ?? ""}`.toLowerCase();
  return /income|take[- ]?home|salary|paycheck|monthly pay|gross annual|annual salary|earn|make per month/.test(
    text
  );
}

function isAnnualIncomeNote(note: { title: string; notes?: string }) {
  const text = `${note.title} ${note.notes ?? ""}`.toLowerCase();
  return /annual|year|gross/.test(text) && !/month|monthly|take[- ]?home/.test(text);
}

function extractIncomeFromTranscript(transcript: string) {
  const updates: { monthlyTakeHome?: number; grossAnnualIncome?: number } = {};

  const monthlyPatterns = [
    /(?:update|change|set).*?(?:take[- ]?home|monthly income|my income|income).*?(?:to|is)\s*\$?\s*([\d,]+(?:\.\d+)?)/i,
    /(?:take[- ]?home|monthly income).*?(?:is|to)\s*\$?\s*([\d,]+(?:\.\d+)?)/i,
    /make\s*\$?\s*([\d,]+(?:\.\d+)?)\s*(?:per|each|a)\s*month/i,
    /earn(?:ing)?\s*\$?\s*([\d,]+(?:\.\d+)?)\s*(?:per|each|a)\s*month/i,
  ];

  for (const pattern of monthlyPatterns) {
    const match = transcript.match(pattern);
    if (match) {
      const amount = parseMoneyAmount(match[1]);
      if (amount) {
        updates.monthlyTakeHome = amount;
        break;
      }
    }
  }

  const annualPatterns = [
    /(?:gross|annual).*?(?:income|salary).*?(?:is|to)\s*\$?\s*([\d,]+(?:\.\d+)?)/i,
    /make\s*\$?\s*([\d,]+(?:\.\d+)?)\s*(?:per|each|a)\s*year/i,
  ];

  for (const pattern of annualPatterns) {
    const match = transcript.match(pattern);
    if (match) {
      const amount = parseMoneyAmount(match[1]);
      if (amount) {
        updates.grossAnnualIncome = amount;
        break;
      }
    }
  }

  return updates;
}

export async function applyVoiceFinancialUpdates(
  userId: string,
  transcript: string | undefined,
  moneyNotes: VoiceCapturePlan["moneyNotes"]
): Promise<VoiceCaptureAppliedAction[]> {
  const updates: { monthlyTakeHome?: number; grossAnnualIncome?: number } = {};

  for (const note of moneyNotes) {
    if (!isIncomeMoneyNote(note) || note.amount == null || note.amount <= 0) continue;
    if (isAnnualIncomeNote(note)) {
      updates.grossAnnualIncome = note.amount;
    } else {
      updates.monthlyTakeHome = note.amount;
    }
  }

  if (transcript) {
    const fromText = extractIncomeFromTranscript(transcript);
    if (fromText.monthlyTakeHome != null) updates.monthlyTakeHome = fromText.monthlyTakeHome;
    if (fromText.grossAnnualIncome != null) updates.grossAnnualIncome = fromText.grossAnnualIncome;
  }

  if (updates.monthlyTakeHome == null && updates.grossAnnualIncome == null) {
    return [];
  }

  await getOrCreateFinancialProfile(userId);
  await prisma.financialProfile.update({
    where: { userId },
    data: {
      ...(updates.monthlyTakeHome != null && { monthlyTakeHome: updates.monthlyTakeHome }),
      ...(updates.grossAnnualIncome != null && { grossAnnualIncome: updates.grossAnnualIncome }),
      setupComplete: true,
    },
  });

  const parts: string[] = [];
  if (updates.monthlyTakeHome != null) {
    parts.push(`take-home $${updates.monthlyTakeHome.toLocaleString()}/mo`);
  }
  if (updates.grossAnnualIncome != null) {
    parts.push(`gross $${updates.grossAnnualIncome.toLocaleString()}/yr`);
  }

  return [
    {
      type: "money",
      label: `Income profile updated (${parts.join(", ")})`,
      href: "/money",
    },
  ];
}
