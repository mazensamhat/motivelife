/**
 * Smoke checks for Kashu Phase 5 conversational parser.
 * Run: npx tsx apps/web/src/lib/kashu/conversation.smoke.ts
 */
import type { KashuProposal } from "@forward/shared";
import {
  extractSpendAmount,
  isConfirmUtterance,
  isRejectUtterance,
  parseKashuUtterance,
} from "./conversation";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const asOf = new Date("2026-08-17T12:00:00");

const dump = parseKashuUtterance(
  "I make $3,700 every two weeks. Next payday is Friday. Rent is $1,800 on the 1st. Car is $380 every 14 days. Phone $85 on the 23rd. Checking is $4,200. Safety floor $500. Emergency reserve $3000.",
  { asOf }
);

const profile = dump.find((p) => p.kind === "profile");
assert(profile?.kind === "profile", "profile proposal");
if (!profile || profile.kind !== "profile") throw new Error("profile");
assert((profile.patch.monthlyTakeHome ?? 0) > 7000, `monthly from biweekly got ${profile.patch.monthlyTakeHome}`);
assert(profile.patch.payFrequency === "BIWEEKLY", "biweekly freq");
assert(profile.patch.liquidBalance === 4200, "balance");
assert(profile.patch.safetyFloor === 500, "floor");
assert(profile.patch.emergencyReserve === 3000, "reserve");
assert(profile.patch.nextPayday?.startsWith("2026-08-21"), `friday payday ${profile.patch.nextPayday}`);

const bills = dump.filter(
  (p): p is Extract<KashuProposal, { kind: "add_bill" | "update_bill" }> => p.kind !== "profile"
);
assert(bills.length >= 3, `bills ${bills.length}`);
assert(
  bills.some((p) => /rent/i.test(p.bill.title) && p.bill.amount === 1800),
  "rent"
);
assert(
  bills.some((p) => /car/i.test(p.bill.title) && p.bill.frequency === "BIWEEKLY"),
  "car biweekly"
);

const update = parseKashuUtterance("Rent is $1,950 on the 1st", {
  asOf,
  existingBills: [
    {
      id: "rent1",
      title: "Rent",
      currentAmount: 1800,
      type: "HOUSING",
      frequency: "MONTHLY",
      dueDay: 1,
    },
  ],
});
assert(update.some((p) => p.kind === "update_bill" && p.existingId === "rent1"), "update existing rent");

assert(extractSpendAmount("Can I spend $400 this weekend?") === 400, "spend extract");
assert(isConfirmUtterance("yes"), "confirm");
assert(isRejectUtterance("skip"), "reject");

console.log("kashu conversation smoke: ok");
