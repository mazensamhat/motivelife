import { describe, expect, it } from "vitest";
import { askLocalAssistant } from "./assistant";
import { attributeEngagement, buildCatalog, resolveName } from "./normalize";
import { makeSamplePeerBook, normalizeRecaps, scoreBook, scorePm, scoreTeams } from "./scoring";
import { readTemperature } from "./temperature";
import type { OrgChart, RecapFile } from "./types";

const org: OrgChart = {
  company: "Test",
  directors: [{ id: "dir-canada", name: "Director" }],
  teams: [
    { id: "team-canada-a", name: "Team Canada A", directorId: "dir-canada" },
    { id: "team-canada-b", name: "Team Canada B", directorId: "dir-canada" },
  ],
  pms: [{ id: "pm-mazen-samhat", name: "Mazen Samhat", teamId: "team-canada-a" }],
};

const mazenFile: RecapFile = {
  sourceFile: "test.xlsx",
  assignedPm: { id: "pm-mazen-samhat", name: "Mazen Samhat", teamId: "team-canada-a" },
  records: [
    {
      account: "AJAX NISSAN",
      date: "2025-11-19",
      subject: "vAuto Performance Review Ajax Nissan",
      activityType: "Performance Review",
      comments: "No comments captured in the exported report.",
      createdBy: "Mazen Samhat",
    },
    {
      account: "AJAX NISSAN",
      date: "2026-07-08",
      subject: "QBR Ajax Nissan",
      activityType: "Quarterly Business Review",
      comments:
        "**Customer Impression**\nThe customer expressed appreciation and a willingness to learn. They were engaged throughout the call.",
      createdBy: "Mazen Samhat",
    },
    {
      account: "vAuto Performance Review Ajax Nissan",
      date: "2026-04-01",
      subject: "vAuto Performance Review Ajax Nissan",
      activityType: "Performance Review",
      comments: "No comments captured in the exported report.",
      createdBy: "Automated Process",
    },
    {
      account: "(D) SHIFT AUTO GROUP",
      date: "2026-04-08",
      subject: "Monthly BPR",
      activityType: "General",
      comments:
        '**Customer Impression**\nThe customer expressed a mix of frustration and engagement. They showed dissatisfaction with tools being mandated, referring to them as "stupid."',
      createdBy: "Mazen Samhat",
    },
    {
      account: "STEELE SUBARU",
      date: "2025-09-01",
      subject: "Visit",
      activityType: "Unspecified",
      comments: "No comments captured in the exported report.",
      createdBy: "Mazen Samhat",
    },
    {
      account: "STEELE SUBARU",
      date: "2026-05-05",
      subject: "vAuto Performance Review Steele Subaru",
      activityType: "Performance Review",
      comments:
        "**Customer Impression**\nThe customer exhibited a proactive attitude, demonstrating a willingness to learn and adapt.",
      createdBy: "Automated Process",
    },
    {
      account: "STEELE SUBARU",
      date: "2026-07-21",
      subject: "Follow-up Steele Subaru",
      activityType: "Follow-Up Visit",
      comments: "No comments captured in the exported report.",
      createdBy: "Mazen Samhat",
    },
  ],
};

describe("normalize", () => {
  it("merges Salesforce title rows onto the real store", () => {
    const catalog = buildCatalog(["AJAX NISSAN", "STEELE SUBARU"]);
    const hit = resolveName("vAuto Performance Review Ajax Nissan", catalog);
    expect(hit.storeName).toBe("AJAX NISSAN");
    expect(hit.match).toMatch(/alias|fuzzy/);
  });

  it("fans a multi-store Steele session onto each rooftop", () => {
    const catalog = buildCatalog(["STEELE BUICK GMC", "FREDERICTON HYUNDAI", "STEELE VALLEY CHEVROLET"]);
    const attrs = attributeEngagement(
      "vAuto Session Steele Buick GMC, Fredericton Hyundai, Steele Valley Chev.",
      "session",
      catalog,
    );
    expect(attrs.map((a) => a.storeName).sort()).toEqual([
      "FREDERICTON HYUNDAI",
      "STEELE BUICK GMC",
      "STEELE VALLEY CHEVROLET",
    ]);
  });
});

describe("temperature", () => {
  it("does not treat pre-March 2026 blank comments as a cold visit", () => {
    const reading = readTemperature("No comments captured in the exported report.", "2025-11-19");
    expect(reading.status).toBe("legacy_unscored");
    expect(reading.score).toBeNull();
    expect(reading.label).toBe("Not captured (legacy)");
  });

  it("flags missing notes after the requirement date without scoring them cold", () => {
    const reading = readTemperature("No comments captured in the exported report.", "2026-04-01");
    expect(reading.status).toBe("missing_notes");
    expect(reading.score).toBeNull();
  });

  it("scores a warm customer impression", () => {
    const reading = readTemperature(
      "**Customer Impression**\nThe customer expressed appreciation and a willingness to learn. They were engaged.",
      "2026-07-08",
    );
    expect(reading.status).toBe("scored");
    expect(reading.score).toBeGreaterThan(65);
    expect(reading.label).toMatch(/Warm|Hot/);
  });
});

describe("scoring", () => {
  const engagements = normalizeRecaps([mazenFile]);
  const stores = scoreBook(engagements, "2026-08-18");

  it("gives Ajax Nissan one store score after alias merge", () => {
    const ajax = stores.filter((s) => s.storeKey === "ajax-nissan");
    expect(ajax).toHaveLength(1);
    expect(ajax[0].counts.total).toBe(3);
  });

  it("does not drop a store to At Risk only because 2025 notes are blank", () => {
    const ajax = stores.find((s) => s.storeKey === "ajax-nissan")!;
    expect(ajax.breakdown.temperature.applied).toBe(true);
    expect(ajax.score).toBeGreaterThanOrEqual(55);
    expect(ajax.temperature.readings).toBe(1);
  });

  it("keeps Steele Subaru scorable from cadence even when most history has no notes", () => {
    const steele = stores.find((s) => s.storeKey === "steele-subaru")!;
    expect(steele.counts.withNotes).toBe(1);
    expect(steele.score).toBeGreaterThan(0);
    expect(steele.nextAction.length).toBeGreaterThan(10);
  });

  it("scores the PM without using legacy blanks as a penalty", () => {
    const pm = scorePm(stores, org)!;
    expect(pm.pmName).toBe("Mazen Samhat");
    expect(pm.storeCount).toBeGreaterThanOrEqual(2);
    expect(pm.noteCaptureAfterCutoff).toBeGreaterThan(0);
    expect(pm.score).toBeGreaterThan(40);
  });
});

describe("local assistant", () => {
  const engagements = normalizeRecaps([mazenFile]);
  const stores = scoreBook(engagements, "2026-08-18");
  const pms = [scorePm(stores, org)!];
  const teams = scoreTeams(pms, org);
  const ctx = { org, engagements, stores, pms, teams, asOf: "2026-08-18" };

  it("answers last engagement for Ajax Nissan", () => {
    const answer = askLocalAssistant("When was the last engagement with Ajax Nissan?", ctx);
    expect(answer.intent).toBe("last_engagement");
    expect(answer.answer).toContain("2026-07-08");
    expect(answer.citations[0].storeName).toBe("AJAX NISSAN");
  });

  it("explains temperature without calling missing notes a bad visit", () => {
    const answer = askLocalAssistant("What is the temperature at Ajax Nissan?", ctx);
    expect(answer.intent).toBe("temperature");
    expect(answer.answer.toLowerCase()).toMatch(/warm|hot|mixed/);
    expect(answer.answer.toLowerCase()).not.toContain("cold because there were no comments");
  });

  it("lists at-risk / stale stores", () => {
    const answer = askLocalAssistant("Which stores are at risk?", ctx);
    expect(answer.intent).toBe("at_risk");
    expect(answer.bullets.length).toBeGreaterThan(0);
  });

  it("builds a weekly briefing", () => {
    const answer = askLocalAssistant("Who should I call this week?", ctx);
    expect(answer.intent).toBe("briefing");
    expect(answer.answer).toContain("Mazen Samhat");
  });
});

describe("sample peer book", () => {
  it("marks illustration recaps so they cannot be confused with live Salesforce", () => {
    const peer = makeSamplePeerBook(mazenFile.records);
    expect(peer.assignedPm.id).toBe("pm-sample-west");
    expect(peer.sourceFile).toMatch(/Illustration/);
    expect(peer.records[0].subject).toMatch(/^\[SAMPLE\]/);
  });
});
