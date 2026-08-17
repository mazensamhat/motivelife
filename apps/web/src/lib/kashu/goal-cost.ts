export function parseGoalMonthlyNeed(input: {
  title: string;
  description?: string | null;
  targetDate?: Date | string | null;
  progress?: number | null;
  targetAmount?: number | null;
  monthlyContribution?: number | null;
  savingsRemaining?: number | null;
}): number | null {
  if (input.monthlyContribution && input.monthlyContribution >= 25) {
    return Math.round(input.monthlyContribution);
  }

  const blob = `${input.title} ${input.description ?? ""}`;
  const monthlyMatch = blob.match(
    /\$?\s*([\d,]+(?:\.\d+)?)\s*(?:\/\s*mo(?:nth)?|a month|per month|monthly)/i
  );
  if (monthlyMatch) {
    const n = Number(monthlyMatch[1]!.replace(/,/g, ""));
    if (Number.isFinite(n) && n >= 25) return Math.round(n);
  }

  let total = input.targetAmount && input.targetAmount > 0 ? input.targetAmount : null;
  if (total == null) {
    const totalMatch = blob.match(/\$\s*([\d,]+(?:\.\d+)?)/);
    if (totalMatch) {
      const n = Number(totalMatch[1]!.replace(/,/g, ""));
      if (Number.isFinite(n) && n >= 100) total = n;
    }
  }
  if (total == null && input.savingsRemaining && input.savingsRemaining >= 100) {
    total = input.savingsRemaining;
  }
  if (total == null) return null;

  const remaining = total * (1 - Math.min(100, Math.max(0, input.progress ?? 0)) / 100);
  let months = 12;
  if (input.targetDate) {
    const target = input.targetDate instanceof Date ? input.targetDate : new Date(input.targetDate);
    if (!Number.isNaN(target.getTime())) {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date(target.getFullYear(), target.getMonth(), target.getDate());
      months = Math.max(1, Math.round((end.getTime() - start.getTime()) / (30 * 86400000)));
    }
  }
  const monthly = remaining / months;
  return monthly >= 25 ? Math.round(monthly) : null;
}
