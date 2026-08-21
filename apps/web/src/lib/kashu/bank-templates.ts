/**
 * Canadian bank statement fingerprint templates.
 * Used to classify payroll / bills / transfers more accurately per issuer.
 * Patterns inspired by common TD, RBC, Scotiabank, BMO, CIBC statement layouts.
 */

export type BankId = "td" | "rbc" | "scotiabank" | "bmo" | "cibc" | "generic";

export type BankTemplate = {
  id: BankId;
  label: string;
  /** Match in filename, header text, or account label */
  detect: RegExp;
  payroll: RegExp;
  transfer: RegExp;
  billHints: Array<{ match: RegExp; title: string }>;
};

export const BANK_TEMPLATES: BankTemplate[] = [
  {
    id: "td",
    label: "TD Canada Trust",
    detect: /\bTD\b|canada trust|tdct|green.?shield/i,
    payroll: /COX|MSP|PAYROLL|SALARY|DIRECT DEPOSIT|WAGE|DEPOSIT FROM/i,
    transfer: /E-?TRANSFER|INTERAC|ACCT.?TRANSFER|BILL PMT|ONLINE TRANSFER/i,
    billHints: [
      { match: /RBC.*MORT|MORTGAGE/i, title: "Mortgage" },
      { match: /AVIVA/i, title: "Aviva" },
      { match: /BELL/i, title: "Bell Canada" },
      { match: /ENWIN|ENBRIDGE|SANDPIPER/i, title: "Utilities" },
      { match: /LINCOLN|AFS|AUTO/i, title: "Auto" },
      { match: /NETFLIX/i, title: "Netflix" },
      { match: /PLANET FITNESS/i, title: "Planet Fitness" },
    ],
  },
  {
    id: "rbc",
    label: "RBC Royal Bank",
    detect: /\bRBC\b|royal bank/i,
    payroll: /PAYROLL|SALARY|DIRECT DEPOSIT|DEPOSIT|MSP|WAGE/i,
    transfer: /E-?TRANSFER|INTERAC|TRANSFER/i,
    billHints: [
      { match: /MORTGAGE/i, title: "Mortgage" },
      { match: /HYDRO|ENBRIDGE|UTIL/i, title: "Utilities" },
    ],
  },
  {
    id: "scotiabank",
    label: "Scotiabank",
    detect: /scotia|bns\b/i,
    payroll: /PAYROLL|SALARY|DIRECT DEPOSIT|DEPOSIT|WAGE/i,
    transfer: /E-?TRANSFER|INTERAC|TRANSFER/i,
    billHints: [],
  },
  {
    id: "bmo",
    label: "BMO",
    detect: /\bBMO\b|bank of montreal/i,
    payroll: /PAYROLL|SALARY|DIRECT DEPOSIT|DEPOSIT|WAGE/i,
    transfer: /E-?TRANSFER|INTERAC|TRANSFER/i,
    billHints: [],
  },
  {
    id: "cibc",
    label: "CIBC",
    detect: /\bCIBC\b|imperial/i,
    payroll: /PAYROLL|SALARY|DIRECT DEPOSIT|DEPOSIT|WAGE/i,
    transfer: /E-?TRANSFER|INTERAC|TRANSFER/i,
    billHints: [],
  },
  {
    id: "generic",
    label: "Generic / unknown bank",
    detect: /.*/,
    payroll: /PAYROLL|SALARY|DIRECT[\s-]?DEPOSIT|WAGE|MSP|EMPLOYER|ADP|CERIDIAN|GUSTO/i,
    transfer: /E-?TRANSFER|INTERAC|VENMO|PAYPAL|TRANSFER TO|TRANSFER FROM/i,
    billHints: [],
  },
];

export function detectBankTemplate(
  textOrName: string
): BankTemplate {
  for (const t of BANK_TEMPLATES) {
    if (t.id === "generic") continue;
    if (t.detect.test(textOrName)) return t;
  }
  return BANK_TEMPLATES[BANK_TEMPLATES.length - 1]!;
}
