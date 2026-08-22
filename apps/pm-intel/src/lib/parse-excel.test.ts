import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { parseRecapWorkbook } from "./parse-excel";

describe("parseRecapWorkbook", () => {
  it("reads a Salesforce-style header block and maps rows", () => {
    const aoa = [
      ["Mazen PM Dealer Recap"],
      [],
      [
        "Company / Account",
        "End",
        "Subject",
        "Activity Type",
        "Status",
        "Comments",
        "Created By",
      ],
      [
        "AJAX NISSAN",
        "7/8/2026, 10:00 AM",
        "QBR Ajax Nissan",
        "Quarterly Business Review",
        "Completed",
        "**Customer Impression**\nEngaged and willing to learn.",
        "Mazen Samhat",
      ],
      [
        "",
        "8/18/2025, 10:35 AM",
        "vAuto Performance Review Arrow Motors",
        "",
        "Completed",
        "",
        "Automated Process",
      ],
    ];
    const sheet = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, "Recap");
    const buffer = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as Uint8Array;
    const recap = parseRecapWorkbook(buffer, {
      sourceFile: "test.xlsx",
      assignedPmId: "pm-mazen-samhat",
      assignedPmName: "Mazen Samhat",
      teamId: "team-canada-a",
    });
    expect(recap.records).toHaveLength(2);
    expect(recap.records[0].account).toBe("AJAX NISSAN");
    expect(recap.records[0].activityType).toBe("Quarterly Business Review");
    expect(recap.records[1].account).toBe("vAuto Performance Review Arrow Motors");
    expect(recap.records[1].activityType).toBe("Unspecified");
    expect(recap.records[1].date).toMatch(/^2025-08-1/);
  });
});
