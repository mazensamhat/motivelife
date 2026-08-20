/**
 * Smoke test: TD Canada multi-statement parse → concept calendar anchors.
 * Run: npx tsx src/lib/kashu/td-statement.smoke.ts
 */
import assert from "node:assert/strict";
import { parseTdCanadaStatement, shouldAutoConfirmRecurring } from "./td-statement";

const SAMPLE = `
===== SOURCE: may.pdf (pdf) =====
STATEMENT OF ACCOUNT
MAY 29/26 - JUN 30/26
DESCRIPTIONWITHDRAWALS DEPOSITS DATE BALANCE
STARTING BALANCE
2600550RBC PYT   MTG3,888.61JUN02
AVIVA-HOME/AUTO  INS1,152.14JUN05
BELL CANADA      BPY859.34JUN09
COX AUTOMOTIVE MSP3,698.25JUN12
LINCOLN AUTO      BPY380.00JUN12
ENWIN UTILITIES   BPY401.00JUN15
NETFLIX.COM       BPY27.11JUN20
TIM HORTONS #06_F5.40JUN21
SEND E-TFR ***12 150.00JUN22
CLOSING BALANCE JUN 30 4,517.32

===== SOURCE: jun.pdf (pdf) =====
STATEMENT OF ACCOUNT
JUN 30/26 - JUL 31/26
DESCRIPTIONWITHDRAWALS
2600555RBC PYT   MTG3,888.61JUL03
AVIVA-HOME/AUTO  INS1,152.14JUL06
BELL CANADA      BPY690.17JUL10
COX AUTOMOTIVE MSP3,703.06JUL10
COX AUTOMOTIVE MSP7,689.86JUL24
LINCOLN AUTO      BPY380.00JUL25
PLANET FITNESS    BPY16.95JUL28
CLOSING BALANCE JUL 31 4,517.32
`;

const jammed = `
===== SOURCE: old.pdf (pdf) =====
STATEMENTOFACCOUNT
AUG29/25-SEP29/25
DESCRIPTIONWITHDRAWALS
2600703RBCPYTMTG3,888.61SEP031,609.48
AVIVA-HOME/AUTOINS1,039.09SEP051,467.26
BELLCANADABPY728.82SEP09512.42OD
COXAUTOMOTIVEMSP3,608.14SEP12
TIMHORTONS#06_F5.40SEP13
SENDE-TFR300.00SEP14
CLOSINGBALANCESEP294,100.00
`;

function main() {
  const r = parseTdCanadaStatement(SAMPLE + "\n" + jammed);
  assert.ok(r.transactions.length >= 8, "expected calendar moves");
  assert.ok(
    !r.transactions.some((t) => /tim|hortons|e-tfr|send/i.test(t.description)),
    "noise should not appear on calendar extract"
  );
  assert.ok(
    r.transactions.some((t) => /mortgage/i.test(t.description) && t.amount === 3888.61),
    "mortgage with trailing balance must parse"
  );
  assert.ok(
    r.transactions.some((t) => /cox/i.test(t.description) && t.amount > 3000),
    "cox payroll"
  );

  const mortgage = r.recurring.find((x) => /mortgage/i.test(x.title));
  assert.ok(mortgage, "recurring mortgage");
  assert.equal(mortgage!.amount, 3888.61);
  assert.ok(shouldAutoConfirmRecurring(mortgage!.title, mortgage!.amount, mortgage!.confidence));

  const aviva = r.recurring.find((x) => /aviva/i.test(x.title));
  assert.ok(aviva, "recurring aviva");
  assert.ok(aviva!.amount >= 1000, `aviva should be main premium, got ${aviva!.amount}`);

  console.log("td-statement.smoke OK", {
    txs: r.transactions.length,
    recurring: r.recurring.map((x) => `${x.title}=${x.amount}`),
    payday: r.paydayGuess,
  });
}

main();
