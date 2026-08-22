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

  // Biweekly Saturday pay stays on Saturday.
  const satPay = derivePayRhythm(
    [
      { postedAt: "2026-06-13", amount: 3700 },
      { postedAt: "2026-06-27", amount: 3700 },
      { postedAt: "2026-07-11", amount: 3700 },
      { postedAt: "2026-07-25", amount: 3700 },
    ],
    new Date("2026-08-20T12:00:00Z")
  );
  assert.ok(satPay, "satPay");
  assert.equal(satPay!.nextPayday, "2026-08-22");
  assert.equal(new Date(`${satPay!.nextPayday}T12:00:00Z`).getUTCDay(), 6);

  // Far-future last deposit must not invent "1336d until payday"
  const weird = derivePayRhythm(
    [{ postedAt: "2030-04-04", amount: 5000 }],
    new Date("2026-08-21T12:00:00Z")
  );
  assert.ok(weird, "weird rhythm");
  const ahead = Math.round(
    (new Date(weird!.nextPayday + "T12:00:00Z").getTime() -
      new Date("2026-08-21T12:00:00Z").getTime()) /
      86400000
  );
  assert.ok(ahead >= 0 && ahead <= 35, `next payday must be near-term got ${weird!.nextPayday} (${ahead}d)`);
}

main();
