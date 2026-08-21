import assert from "node:assert/strict";
import {
  detectPayrollDeposits,
  reconstructPayCadence,
  seedPayrollFromAnchor,
  looksLikePayrollCredit,
} from "./payroll-detect";

function main() {
  // Never treat family e-transfers as payroll (Aug 7 "My Wife" case)
  assert.equal(
    looksLikePayrollCredit({
      postedAt: "2026-08-07",
      amount: 900,
      description: "E-TRANSFER My Wife",
      direction: "credit",
    }),
    false
  );

  const credits = [
    {
      postedAt: "2026-07-24",
      amount: 7689.86,
      description: "COX AUTOMOTIVE MSP",
      classification: "income",
      direction: "credit",
    },
    {
      postedAt: "2026-08-07",
      amount: 3698.25,
      description: "COX AUTOMOTIVE MSP",
      classification: "income",
      direction: "credit",
    },
    {
      postedAt: "2026-08-07",
      amount: 900,
      description: "E-TRANSFER My Wife",
      classification: "transfer",
      direction: "credit",
    },
    {
      postedAt: "2026-08-21",
      amount: 7689.86,
      description: "COX AUTOMOTIVE MSP",
      classification: "income",
      direction: "credit",
    },
  ];

  const deposits = detectPayrollDeposits(credits);
  assert.equal(deposits.length, 3, `expected 3 payroll deposits, got ${deposits.length}`);
  assert.ok(deposits.some((d) => d.postedAt === "2026-08-07"));
  assert.ok(!deposits.some((d) => d.amount === 900));

  // Cadence fill when Aug 7 deposit was missed by OCR
  const sparse = detectPayrollDeposits([
    credits[0]!,
    credits[3]!,
  ]);
  const filled = reconstructPayCadence(sparse, 14, "2026-07-01", "2026-09-01");
  assert.ok(
    filled.some((p) => p.postedAt === "2026-08-07"),
    "reconstruct should insert Aug 7 between Jul 24 and Aug 21"
  );

  // Seed from Buffers next payday alone
  const seeded = seedPayrollFromAnchor({
    deposits: [],
    nextPayday: "2026-08-21",
    typicalAmount: 7700,
    asOfYmd: "2026-08-20",
  });
  assert.ok(seeded.some((d) => d.postedAt === "2026-08-21"));
  assert.ok(seeded.some((d) => d.postedAt === "2026-08-07"), "seed should add prior biweekly step");

  const fromSeed = reconstructPayCadence(seeded, 14, "2026-07-01", "2026-09-05");
  assert.ok(fromSeed.some((p) => p.postedAt === "2026-08-07"));

  console.log("payroll-detect.smoke OK", {
    deposits: deposits.map((d) => d.postedAt),
    filledAug7: filled.find((p) => p.postedAt === "2026-08-07"),
  });
}

main();
