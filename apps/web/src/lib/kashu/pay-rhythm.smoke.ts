import assert from "node:assert/strict";
import { derivePayRhythm, resolvePaycheckAmount } from "./pay-rhythm";

function main() {
  // Cox-style alternating base / commission
  const deposits = [
    { postedAt: "2026-06-12", amount: 3698.25 },
    { postedAt: "2026-06-26", amount: 8773.01 },
    { postedAt: "2026-07-10", amount: 3703.06 },
    { postedAt: "2026-07-24", amount: 7689.86 },
  ];
  const r = derivePayRhythm(deposits, new Date("2026-08-20T12:00:00Z"));
  assert.ok(r, "rhythm");
  assert.equal(r!.payFrequency, "BIWEEKLY");
  assert.equal(r!.nextPayday, "2026-08-21");
  // Jul 24 high → Aug 7 low (past) → Aug 21 high
  assert.ok(r!.typicalPaycheck > 6000, `expected high band, got ${r!.typicalPaycheck}`);
  assert.ok(r!.typicalPaycheck < 10000, `paycheck too high ${r!.typicalPaycheck}`);

  assert.equal(
    resolvePaycheckAmount({ monthlyTakeHome: 12000, payFrequency: "MONTHLY" }),
    5530
  );
  assert.equal(
    resolvePaycheckAmount({
      typicalPaycheck: 3698,
      monthlyTakeHome: 12000,
      payFrequency: "MONTHLY",
    }),
    3698
  );

  console.log("pay-rhythm.smoke OK", {
    next: r!.nextPayday,
    amount: r!.typicalPaycheck,
    low: r!.lowBand,
    high: r!.highBand,
  });
}

main();
