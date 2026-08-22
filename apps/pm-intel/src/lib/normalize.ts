import type { AttributionKind, StoreAttribution } from "./types";

const NOISE = new Set([
  "ltd",
  "limited",
  "inc",
  "incorporated",
  "llc",
  "the",
  "of",
  "and",
  "auto",
  "group",
  "sales",
  "motors",
  "motor",
  "o/a",
  "oa",
]);

const PREFIXES = [
  /^reminder\s+/i,
  /^gotomeeting invitation\s+-\s+/i,
  /^vauto performance review with\s+/i,
  /^vauto performance review\s+/i,
  /^vauto review\s+/i,
  /^vauto session with\s+/i,
  /^vauto session\s+/i,
  /^vauto call with\s+/i,
  /^vauto call\s+/i,
  /^performance review\s+/i,
  /^call with [^ ]+\s+at\s+/i,
  /^meeting with [^ ]+\s+at\s+/i,
];

const PERSON_MEETING = /^(meeting with|vauto call with|vauto session with|vauto performance review with|performance review)\s+/i;

export const ALIASES: Record<string, string> = {
  "AJAX NISSAN": "AJAX NISSAN",
  "ACURA PICKERING": "ACURA PICKERING",
  "ARROW MOTORS": "ARROW MOTORS",
  "ATLANTIC MAZDA": "ATLANTIC MAZDA",
  "AUDI HALIFAX": "AUDI HALIFAX",
  "CAMPUS HONDA": "CAMPUS HONDA VICTORIA",
  "CANYON CREEK TOYOTA": "CANYON CREEK TOYOTA",
  "CAPITAL HYUNDAI": "CAPITAL HYUNDAI",
  "CARHUB": "YOUR WAY AUTO",
  "COUNTY MAZDA": "COUNTY MAZDA",
  "DISCOVER KIA": "DISCOVER KIA CHARLOTTETOWN",
  "DIXIE FORD": "DIXIE FORD",
  "HUMBER FORD": "HUMBER MOTORS FORD",
  "JAGUAR LAND ROVER MONCTON": "STEELE LAND ROVER JAGUAR MONCTON",
  "JIM PATTISON AUTO GROUP": "THE JIM PATTISON AUTO GROUP HEADQUARTERS",
  "JIM PATTISON HYUNDAI NORTHSHORE": "JIM PATTISON HYUNDAI NORTHSHORE",
  "JIM PATTISON TOYOTA & LEXUS VICTORIA": "JIM PATTISON TOYOTA VICTORIA",
  "LAKE SIDE CHEVROELT": "LAKESIDE CHEVROLET BUICK GMC LTD",
  "LAKESIDE CHEVROLET": "LAKESIDE CHEVROLET BUICK GMC LTD",
  "LAKESIDE": "LAKESIDE CHEVROLET BUICK GMC LTD",
  "MIDWAY NISSAN": "MIDWAY NISSAN",
  "MONCTON ACURA": "ACURA OF MONCTON",
  "MORNINGSIDE NISSAN": "MORNINGSIDE NISSAN",
  "PICKERING HONDA": "PICKERING HONDA",
  "PORSCHE OF HALIFAX": "PORSCHE OF HALIFAX",
  "PROVINCIAL CHRYSLER": "PROVINCIAL CHRYSLER DODGE JEEP RAM",
  "STEELE AUTO GROUP": "STEELE AUTO GROUP",
  "STEELE SUBARU": "STEELE SUBARU",
  "STEELE VOLKSWAGEN": "STEELE VOLKSWAGEN",
  "BRIDGEWATER VOLKSWAGEN": "STEELE VOLKSWAGEN",
  "STOCKIE CHRYSLER": "STOCKIE CHRYSLER",
  "TANTRAMAR CHEVROLET": "TANTRAMAR CHEVROLET BUICK GMC (2009) LIMITED",
  "TOYOTA SURREY": "JIM PATTISON TOYOTA - SURREY",
  "UNICAR AUTO GROUP": "UNICAR AUTO GROUP",
  "VOLKSWAGEN SURREY": "JIM PATTISON VOLKSWAGEN SURREY",
  "VOLVO NORTH VANCOUVER": "JIM PATTISON VOLVO CARS NORTH VANCOUVER",
  "YOUR WAY AUTO": "YOUR WAY AUTO",
  "PARK LANE CHEVROLET": "PARK LANE CHEVROLET CADILLAC LTD",
  "JIM PATTISON CHRYSLER": "JIM PATTISON CHRYSLER JEEP DODGE",
  "STEELE BUICK GMC": "STEELE BUICK GMC",
  "FREDERICTON HYUNDAI": "FREDERICTON HYUNDAI",
  "STEELE VALLEY CHEV": "STEELE VALLEY CHEVROLET",
  "STEELE VALLEY CHEVROLET": "STEELE VALLEY CHEVROLET",
  "ST CROIX AUTO": "ST. CROIX AUTO GROUP",
  "STEELE ST JOHNS CHRYSLER DODGE JEEP RAM": "STEELE ST. JOHN'S CHRYSLER DODGE JEEP RAM",
  "CANYON CREEK TOYOTA 2018": "CANYON CREEK TOYOTA (2018)",
};

const GROUP_RULES: Array<{ test: RegExp; group: string }> = [
  { test: /\bJIM PATTISON\b/, group: "Jim Pattison Auto Group" },
  { test: /\bSTEELE\b/, group: "Steele Auto Group" },
  { test: /\bCAPITAL\b/, group: "Capital Auto Group" },
  { test: /\bCAMPUS\b/, group: "Campus Auto Group" },
  { test: /\bRECAR\b/, group: "RECAR" },
  { test: /\bDRIVE AUTO GROUP\b|\bACURA EAST\b/, group: "Drive Auto Group" },
  { test: /\bYOUR WAY\b|\bCARHUB\b/, group: "Your Way Auto" },
  { test: /\bWALLACE\b/, group: "Wallace Group" },
  { test: /\bSIMMONS HONDA\b/, group: "Simmons Honda" },
  { test: /\bDIXIE\b/, group: "Dixie" },
  { test: /\bGANDER\b/, group: "Gander" },
  { test: /\bFREDERICTON\b/, group: "Fredericton" },
];

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function cleanLabel(value: string): string {
  return value
    .replace(/^\(D\)\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(value: string): string[] {
  return cleanLabel(value)
    .toUpperCase()
    .replace(/&/g, " AND ")
    .replace(/[^A-Z0-9]+/g, " ")
    .split(/\s+/)
    .filter((t) => t && !NOISE.has(t.toLowerCase()) && t.length > 1);
}

export function looksLikeStoreName(raw: string): boolean {
  const t = cleanLabel(raw);
  if (!t) return false;
  if (/vauto|meeting with|gotomeeting|call with|reminder /i.test(t)) return false;
  const letters = t.replace(/[^A-Za-z]/g, "");
  if (!letters) return false;
  const upper = letters.replace(/[^A-Z]/g, "").length / letters.length;
  return upper > 0.7 || t === t.toUpperCase();
}

export function stripActivityPrefix(raw: string): string {
  let value = cleanLabel(raw);
  let changed = true;
  while (changed) {
    changed = false;
    for (const re of PREFIXES) {
      if (re.test(value)) {
        value = value.replace(re, "").trim();
        changed = true;
      }
    }
  }
  return value;
}

export function splitMultiStore(raw: string): string[] {
  const stripped = stripActivityPrefix(raw);
  if (!stripped) return [];
  return stripped
    .split(/\s*(?:,|&| and )\s*/i)
    .map((p) => p.replace(/\.+$/, "").trim())
    .filter(Boolean);
}

export function dealerGroupFor(name: string): string | null {
  const upper = name.toUpperCase();
  for (const rule of GROUP_RULES) {
    if (rule.test.test(upper)) return rule.group;
  }
  if (/^\(D\)/i.test(name) || / GROUP$/.test(upper)) return cleanLabel(name);
  return null;
}

function jaccard(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const as = new Set(a);
  const bs = new Set(b);
  let inter = 0;
  as.forEach((x) => {
    if (bs.has(x)) inter += 1;
  });
  return inter / new Set([...a, ...b]).size;
}

export function buildCatalog(names: string[]): string[] {
  const stores = new Set<string>();
  for (const name of names) {
    const cleaned = cleanLabel(name);
    if (looksLikeStoreName(cleaned)) stores.add(cleaned.toUpperCase());
  }
  return [...stores];
}

export function resolveName(raw: string, catalog: string[]): StoreAttribution {
  const cleaned = cleanLabel(raw);
  if (!cleaned) {
    return {
      storeKey: "unmapped",
      storeName: "Unmapped engagement",
      dealerGroup: null,
      kind: "unmapped",
      match: "unresolved",
    };
  }

  const isDealerGroupRow = /^\(D\)/i.test(raw) || / GROUP$/.test(cleaned.toUpperCase());
  const stripped = stripActivityPrefix(cleaned);
  const aliasKey = stripped.toUpperCase();
  if (ALIASES[aliasKey]) {
    const name = ALIASES[aliasKey];
    return {
      storeKey: slugify(name),
      storeName: name,
      dealerGroup: dealerGroupFor(name),
      kind: isDealerGroupRow ? "group" : "store",
      match: "alias",
    };
  }

  if (looksLikeStoreName(cleaned)) {
    const name = cleaned.toUpperCase();
    return {
      storeKey: slugify(name),
      storeName: name,
      dealerGroup: dealerGroupFor(name),
      kind: isDealerGroupRow ? "group" : "store",
      match: "exact",
    };
  }

  if (PERSON_MEETING.test(cleaned) && !/\bat\b/i.test(cleaned) && stripped.split(" ").length <= 3) {
    return {
      storeKey: slugify(`relationship-${stripped}`),
      storeName: cleaned,
      dealerGroup: null,
      kind: "relationship",
      match: "title",
    };
  }

  const tokens = tokenize(stripped);
  let best: { name: string; score: number } | null = null;
  for (const name of catalog) {
    const score = jaccard(tokens, tokenize(name));
    const contains = name.includes(stripped.toUpperCase()) || stripped.toUpperCase().includes(name);
    const blended = score + (contains ? 0.15 : 0);
    if (!best || blended > best.score) best = { name, score: blended };
  }

  if (best && best.score >= 0.45) {
    return {
      storeKey: slugify(best.name),
      storeName: best.name,
      dealerGroup: dealerGroupFor(best.name),
      kind: "store",
      match: "fuzzy",
    };
  }

  if (stripped) {
    const name = stripped.toUpperCase();
    return {
      storeKey: slugify(name),
      storeName: name,
      dealerGroup: dealerGroupFor(name),
      kind: "unmapped",
      match: "unresolved",
    };
  }

  return {
    storeKey: slugify(cleaned),
    storeName: cleaned,
    dealerGroup: null,
    kind: "unmapped",
    match: "unresolved",
  };
}

export function attributeEngagement(account: string, subject: string, catalog: string[]): StoreAttribution[] {
  const raw = cleanLabel(account) || cleanLabel(subject);
  const pieces = splitMultiStore(raw);
  const source = pieces.length > 1 ? pieces : [raw];
  const seen = new Set<string>();
  const out: StoreAttribution[] = [];
  for (const piece of source) {
    const resolved = resolveName(piece, catalog);
    if (seen.has(resolved.storeKey)) continue;
    seen.add(resolved.storeKey);
    out.push(resolved);
  }
  if (!out.length) out.push(resolveName(raw, catalog));
  return out;
}

export function kindRank(kind: AttributionKind): number {
  if (kind === "store") return 3;
  if (kind === "group") return 2;
  if (kind === "relationship") return 1;
  return 0;
}
