import * as XLSX from "xlsx";
import type { RawEngagement, RecapFile } from "./types";

function cell(row: unknown[], index: number): string {
  const value = row[index];
  if (value == null || value === "") return "";
  if (value instanceof Date) return value.toISOString();
  return String(value).trim();
}

function excelDateToIso(value: string): string {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const parsed = Date.parse(value);
  if (!Number.isNaN(parsed)) {
    const d = new Date(parsed);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  return "";
}

function monthKeyFrom(iso: string): { year: number; month: number; monthKey: string; quarter: string } | null {
  if (!iso) return null;
  const year = Number(iso.slice(0, 4));
  const month = Number(iso.slice(5, 7));
  if (!year || !month) return null;
  const quarter = `Q${Math.ceil(month / 3)}`;
  return { year, month, monthKey: `${year}-${String(month).padStart(2, "0")}`, quarter };
}

function headerIndex(headers: string[]): Record<string, number> {
  const norm = headers.map((h) => h.toLowerCase().replace(/\s+/g, " ").replace(/↑/g, "").trim());
  const find = (...needles: string[]) =>
    norm.findIndex((h) => needles.every((n) => h.includes(n)));
  return {
    account: find("company", "account"),
    completed: find("completed"),
    end: find("end") !== -1 && find("end") !== find("completed") ? find("end") : norm.findIndex((h) => h === "end"),
    lastModified: find("last modified"),
    contact: find("contact"),
    subject: find("subject") === find("case subject") ? norm.findIndex((h) => h === "subject") : find("subject"),
    caseSubject: find("case subject"),
    related: find("related"),
    activityType: find("activity type"),
    status: (() => {
      const idxs = norm.map((h, i) => (h === "status" || h.includes("status") ? i : -1)).filter((i) => i >= 0);
      return idxs.at(-1) ?? -1;
    })(),
    comments: find("comment"),
    createdBy: find("created by"),
  };
}

export function parseRecapWorkbook(
  data: ArrayBuffer | Uint8Array,
  meta: { sourceFile: string; assignedPmId: string; assignedPmName: string; teamId?: string; region?: string },
): RecapFile {
  const workbook = XLSX.read(data, { type: "array", cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<(string | number | Date | null)[]>(sheet, {
    header: 1,
    raw: false,
    defval: "",
  });

  let headerRow = -1;
  for (let i = 0; i < Math.min(rows.length, 40); i += 1) {
    const joined = (rows[i] || []).map((c) => String(c || "").toLowerCase()).join(" | ");
    if (joined.includes("subject") && (joined.includes("activity") || joined.includes("created by"))) {
      headerRow = i;
      break;
    }
  }
  if (headerRow < 0) throw new Error("Could not find a Salesforce recap header row (Subject / Activity Type).");

  const map = headerIndex((rows[headerRow] || []).map((c) => String(c || "")));
  const records: RawEngagement[] = [];

  for (let i = headerRow + 1; i < rows.length; i += 1) {
    const row = rows[i] || [];
    const subject = cell(row, map.subject);
    const account = cell(row, map.account) || subject;
    if (!account && !subject) continue;
    const end = cell(row, map.end);
    const completed = cell(row, map.completed);
    const iso = excelDateToIso(end) || excelDateToIso(completed) || excelDateToIso(cell(row, map.lastModified));
    if (!iso) continue;
    const parts = monthKeyFrom(iso);
    records.push({
      account,
      caId: (subject.match(/CA\d{6,}/i) || [""])[0],
      date: iso,
      year: parts?.year,
      month: parts?.month,
      monthKey: parts?.monthKey,
      quarter: parts?.quarter,
      completed,
      end,
      lastModified: cell(row, map.lastModified),
      subject: subject || account,
      activityType: cell(row, map.activityType) || "Unspecified",
      status: cell(row, map.status) || "Completed",
      comments: cell(row, map.comments) || "No comments captured in the exported report.",
      createdBy: cell(row, map.createdBy) || meta.assignedPmName,
      assignedPmId: meta.assignedPmId,
      assignedPmName: meta.assignedPmName,
    });
  }

  return {
    sourceFile: meta.sourceFile,
    assignedPm: {
      id: meta.assignedPmId,
      name: meta.assignedPmName,
      role: "Performance Manager",
      region: meta.region,
      teamId: meta.teamId,
    },
    records,
  };
}

export async function parseRecapFile(
  file: File,
  meta: { assignedPmId: string; assignedPmName: string; teamId?: string; region?: string },
): Promise<RecapFile> {
  const buffer = await file.arrayBuffer();
  return parseRecapWorkbook(buffer, { ...meta, sourceFile: file.name });
}
