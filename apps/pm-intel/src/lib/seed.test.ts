import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { askLocalAssistant } from "./assistant";
import { normalizeRecaps, scoreBook, scorePm, seedOrgFromFiles } from "./scoring";
import type { RecapFile } from "./types";

const seed = JSON.parse(readFileSync(new URL("../../public/data/mazen-recap.json", import.meta.url), "utf8")) as RecapFile;

describe("mazen recap seed", () => {
  const file: RecapFile = {
    ...seed,
    assignedPm: { ...seed.assignedPm, teamId: "team-canada-a" },
  };
  const org = seedOrgFromFiles([file]);
  const engagements = normalizeRecaps([file]);
  const stores = scoreBook(engagements, "2026-08-18");
  const pm = scorePm(stores, org)!;

  it("merges Salesforce title rows down from 224 raw accounts", () => {
    expect(seed.records).toHaveLength(1225);
    expect(stores.length).toBeLessThan(200);
    expect(stores.length).toBeGreaterThan(150);
    expect(stores.every((store) => store.kind !== "unmapped")).toBe(true);
  });

  it("answers Ajax Nissan last engagement from the live book", () => {
    const ajax = stores.find((store) => store.storeName === "AJAX NISSAN");
    expect(ajax?.lastEngagement.date).toBe("2026-07-08");
    expect(ajax?.counts.total).toBeGreaterThan(16);
    const answer = askLocalAssistant("When was the last engagement with Ajax Nissan?", {
      org,
      engagements,
      stores,
      pms: [pm],
      teams: [],
    });
    expect(answer.answer).toContain("2026-07-08");
  });

  it("keeps PM note-capture independent from the 2025 blank-comment period", () => {
    expect(pm.noteCaptureAfterCutoff).toBeGreaterThan(30);
    expect(pm.noteCaptureAfterCutoff).toBeLessThan(100);
    expect(pm.storeCount).toBe(stores.length);
  });
});
