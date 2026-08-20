import type {
  KashuCashStatus,
  KashuStatementScanInsights,
  KashuScanInsightTip,
} from "@forward/shared";
import {
  buildKashuForecast,
  type KashuMoneyRow,
  type KashuProfileRow,
} from "@/lib/kashu/forecast";

function money(n: number) {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

/**
 * After a statement scan, project cash-flow with confirmed bills + pending
 * recurrings so Kashu can recommend timing moves and flag bottlenecks.
 */
export function buildPostScanInsights(opts: {
  profile: KashuProfileRow;
  moneyItems: KashuMoneyRow[];
  pendingCandidates: Array<{
    id: string;
    title: string;
    amount: number;
    frequency: string;
    priority: string;
    nextDueDate: Date | null;
    autoPay?: boolean;
    intervalDays?: number | null;
    confidence?: number | null;
  }>;
}): KashuStatementScanInsights {
  const pendingRows: KashuMoneyRow[] = opts.pendingCandidates.map((c) => {
    const dueDay = c.nextDueDate
      ? Math.min(28, Math.max(1, c.nextDueDate.getUTCDate()))
      : 15;
    const type =
      c.priority === "MANDATORY" || c.priority === "NECESSARY"
        ? "BILL"
        : c.priority === "LIFESTYLE"
          ? "SUBSCRIPTION"
          : "BILL";
    return {
      id: c.id,
      type,
      title: c.title,
      currentAmount: c.amount,
      dueDay,
      autoPay: Boolean(c.autoPay),
      frequency: c.frequency,
      intervalDays: c.intervalDays ?? null,
      nextDueDate: c.nextDueDate,
      priority: c.priority,
      confidence: c.confidence ?? null,
    };
  });

  // Prefer confirmed money items; add pending that don't collide on title+amount.
  const confirmedKeys = new Set(
    opts.moneyItems.map(
      (m) => `${m.title.toLowerCase()}|${Math.round(m.currentAmount)}`
    )
  );
  const extras = pendingRows.filter(
    (p) => !confirmedKeys.has(`${p.title.toLowerCase()}|${Math.round(p.currentAmount)}`)
  );
  const items = [...opts.moneyItems, ...extras];

  const forecast = buildKashuForecast(opts.profile, items, {
    horizonDays: 60,
  });

  const tips: KashuScanInsightTip[] = [];

  if (forecast.status === "red") {
    tips.push({
      id: "status-red",
      kind: "bottleneck",
      emoji: "🚨",
      title: "Tight stretch ahead",
      detail: `Your projected low dips to ${money(forecast.projectedLow)}${
        forecast.projectedLowDate ? ` around ${forecast.projectedLowDate}` : ""
      }. Confirm bills, then shift due dates or cut lifestyle burn.`,
      projectedLow: forecast.projectedLow,
    });
  } else if (forecast.status === "yellow") {
    tips.push({
      id: "status-yellow",
      kind: "bottleneck",
      emoji: "👀",
      title: "Cash gets close to the floor",
      detail: `Watch the ${forecast.projectedLowDate ?? "next few weeks"} — projected low ${money(forecast.projectedLow)} vs your safety floor.`,
      projectedLow: forecast.projectedLow,
    });
  } else {
    tips.push({
      id: "status-green",
      kind: "balance",
      emoji: "💚",
      title: "Flow looks healthier",
      detail: `Safe to spend about ${money(forecast.safeToSpend)} right now. Projected low ${money(forecast.projectedLow)}.`,
      projectedLow: forecast.projectedLow,
    });
  }

  for (const c of forecast.collisions.slice(0, 3)) {
    tips.push({
      id: `collision-${c.date}-${c.title}`,
      kind: "collision",
      emoji: "💥",
      title: `Collision · ${c.date}`,
      detail: `${c.title} pushes you ${money(c.shortfall)} below the floor. Move it after payday or trim something else that week.`,
    });
  }

  for (const s of forecast.timingScenarios.slice(0, 3)) {
    tips.push({
      id: `timing-${s.billId}-${s.moveToDay}`,
      kind: "timing",
      emoji: "📅",
      title: `Move ${s.billTitle}: day ${s.currentDueDay} → ${s.moveToDay}`,
      detail: s.note,
      projectedLow: s.projectedLow,
    });
  }

  if (forecast.daysUntilPayday != null && forecast.daysUntilPayday <= 4) {
    tips.push({
      id: "payday-soon",
      kind: "payday",
      emoji: "🎉",
      title: "Payday is close",
      detail: `About ${forecast.daysUntilPayday} day${forecast.daysUntilPayday === 1 ? "" : "s"} until payday${forecast.nextPayday ? ` (${forecast.nextPayday})` : ""}. Hold big discretionary spends until then if the week looks tight.`,
    });
  }

  const heavyWave = forecast.billWaves.find((w) => w.totalObligations >= 800);
  if (heavyWave) {
    tips.push({
      id: `wave-${heavyWave.id}`,
      kind: "wave",
      emoji: "🌊",
      title: heavyWave.label,
      detail: `${money(heavyWave.totalObligations)} in obligations lands in this pay cycle. Stagger due dates or fund it from the prior payday.`,
    });
  }

  if (tips.length === 1 && items.length < 2) {
    tips.push({
      id: "need-bills",
      kind: "bottleneck",
      emoji: "🧾",
      title: "Confirm the bills Kashu found",
      detail:
        "Once you confirm recurrings, Kashu can simulate moving due dates to raise your cash-flow floor.",
    });
  }

  return {
    status: forecast.status as KashuCashStatus,
    projectedLow: forecast.projectedLow,
    projectedLowDate: forecast.projectedLowDate,
    safeToSpend: forecast.safeToSpend,
    collisions: forecast.collisions.slice(0, 5).map((c) => ({
      date: c.date,
      title: c.title,
      shortfall: c.shortfall,
    })),
    timing: forecast.timingScenarios.slice(0, 3),
    tips: tips.slice(0, 8),
  };
}
