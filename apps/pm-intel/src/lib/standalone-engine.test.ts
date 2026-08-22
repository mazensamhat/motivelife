import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const PMIntel = require("../../standalone/engine.js");

const seed = JSON.parse(readFileSync(new URL("../../public/data/mazen-recap.json", import.meta.url), "utf8"));
seed.assignedPm.teamId = "team-canada-a";

describe("standalone HTML engine", () => {
  const engagements = PMIntel.normalizeRecaps([seed]);
  const stores = PMIntel.scoreBook(engagements, "2026-08-18");
  const org = PMIntel.seedOrgFromFiles([seed]);
  const pm = PMIntel.scorePm(stores, org);

  it("merges Ajax Nissan and answers last engagement", () => {
    const ajax = stores.find((store) => store.storeName === "AJAX NISSAN");
    expect(ajax.lastEngagement.date).toBe("2026-07-08");
    const answer = PMIntel.askLocalAssistant("When was the last engagement with Ajax Nissan?", {
      org,
      engagements,
      stores,
      pms: [pm],
      teams: [],
    });
    expect(answer.answer).toContain("2026-07-08");
  });

  it("does not score 2025 blank comments as cold", () => {
    const reading = PMIntel.readTemperature("No comments captured in the exported report.", "2025-11-19");
    expect(reading.status).toBe("legacy_unscored");
    expect(reading.score).toBeNull();
  });
});
