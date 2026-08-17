import { prisma } from "@forward/database";
import type { KashuProposal } from "@forward/shared";
import { getOrCreateFinancialProfile } from "@/lib/life-finance-engine";

export async function applyKashuProposals(
  userId: string,
  proposals: KashuProposal[]
): Promise<{ profileUpdated: boolean; billsCreated: number; billsUpdated: number }> {
  let profileUpdated = false;
  let billsCreated = 0;
  let billsUpdated = 0;

  const profilePatch = proposals.find((p) => p.kind === "profile");
  if (profilePatch && profilePatch.kind === "profile") {
    await getOrCreateFinancialProfile(userId);
    const { nextPayday, ...rest } = profilePatch.patch;
    const data: Record<string, unknown> = { ...rest };
    if (nextPayday !== undefined) {
      data.nextPayday = nextPayday ? new Date(nextPayday) : null;
    }
    // Drop undefined keys so we don't null out existing fields.
    for (const key of Object.keys(data)) {
      if (data[key] === undefined) delete data[key];
    }
    if (Object.keys(data).length > 0) {
      await prisma.financialProfile.update({
        where: { userId },
        data,
      });
      profileUpdated = true;
    }
  }

  const existing = await prisma.moneyItem.findMany({
    where: { userId },
    select: { id: true, title: true },
  });

  for (const p of proposals) {
    if (p.kind === "profile") continue;
    const match =
      (p.existingId ? existing.find((e) => e.id === p.existingId) : null) ??
      existing.find((e) => titlesLoose(e.title, p.bill.title));

    const freq = p.bill.frequency;
    const intervalDays =
      p.bill.intervalDays ??
      (freq === "WEEKLY" ? 7 : freq === "BIWEEKLY" ? 14 : freq === "SEMI_MONTHLY" ? 15 : null);

    if (p.kind === "update_bill" && match) {
      await prisma.moneyItem.update({
        where: { id: match.id },
        data: {
          title: p.bill.title,
          currentAmount: p.bill.amount,
          type: p.bill.type,
          frequency: p.bill.frequency,
          intervalDays,
          dueDay: p.bill.dueDay ?? undefined,
          nextDueDate: p.bill.nextDueDate ? new Date(p.bill.nextDueDate) : undefined,
          priority: p.bill.priority,
          autoPay: p.bill.autoPay ?? undefined,
          source: "ask",
        },
      });
      billsUpdated += 1;
    } else {
      const created = await prisma.moneyItem.create({
        data: {
          userId,
          title: p.bill.title,
          currentAmount: p.bill.amount,
          type: p.bill.type,
          frequency: p.bill.frequency,
          intervalDays,
          dueDay: p.bill.dueDay ?? undefined,
          nextDueDate: p.bill.nextDueDate ? new Date(p.bill.nextDueDate) : undefined,
          priority: p.bill.priority,
          autoPay: p.bill.autoPay ?? false,
          source: "ask",
          notes: "Added from Ask Kashu",
        },
      });
      existing.push({ id: created.id, title: created.title });
      billsCreated += 1;
    }
  }

  return { profileUpdated, billsCreated, billsUpdated };
}

function titlesLoose(a: string, b: string): boolean {
  const n = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const na = n(a);
  const nb = n(b);
  return Boolean(na && nb && (na === nb || na.includes(nb) || nb.includes(na)));
}
