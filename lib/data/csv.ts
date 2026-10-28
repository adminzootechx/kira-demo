/**
 * CSV ingestion.
 *
 * Turns an export from LUSTRE (or any ERP) into the `CustomerSource` records the
 * analytics layer scores. Nothing here computes an insight — it only produces
 * the raw shape, so an imported book runs through exactly the same algorithms
 * as the sample one.
 */

import { asOf } from "./asOf";
import type { CustomerSource } from "@/lib/analytics/customer";

/* ------------------------------------------------------------------ */
/* Parsing                                                             */
/* ------------------------------------------------------------------ */

/**
 * RFC 4180-style parser: quoted fields, escaped quotes, embedded commas and
 * newlines. Splitting on commas is the usual shortcut and it corrupts any
 * export containing a company name like "Rosen, Bros & Co".
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  // Strip a UTF-8 BOM, which Excel writes and which otherwise corrupts the
  // first header name.
  const input = text.replace(/^﻿/, "");

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];

    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      // Swallow CRLF as one break.
      if (char === "\r" && input[i + 1] === "\n") i += 1;
      row.push(field);
      field = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else {
      field += char;
    }
  }

  row.push(field);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

/* ------------------------------------------------------------------ */
/* Value coercion                                                      */
/* ------------------------------------------------------------------ */

/** Tolerates currency symbols, thousands separators and bracketed negatives. */
export function toNumber(raw: string): number | null {
  if (!raw) return null;
  const cleaned = raw
    .replace(/[$€£₹,\s]/g, "")
    .replace(/^\((.*)\)$/, "-$1")
    .replace(/%$/, "");
  if (cleaned === "" || cleaned === "-") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/**
 * Accepts ISO (2026-07-12), UK/EU (12/07/2026) and written ("12 Jul 2026")
 * dates, returning epoch milliseconds. Ambiguous day/month order is read as
 * day-first, which is what the existing data and the trade both use.
 */
export function toDate(raw: string): number | null {
  if (!raw) return null;
  const value = raw.trim();

  const iso = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return Date.UTC(+iso[1], +iso[2] - 1, +iso[3]);

  const slash = value.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})$/);
  if (slash) {
    const year = +slash[3] < 100 ? 2000 + +slash[3] : +slash[3];
    return Date.UTC(year, +slash[2] - 1, +slash[1]);
  }

  const written = value.match(/^(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})$/);
  if (written) {
    const month = MONTHS.indexOf(written[2].slice(0, 3).toLowerCase());
    if (month >= 0) return Date.UTC(+written[3], month, +written[1]);
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

/* ------------------------------------------------------------------ */
/* Schema                                                              */
/* ------------------------------------------------------------------ */

export type FieldKind = "text" | "number" | "date";

export type FieldSpec = {
  /** Key on the produced record. */
  key: string;
  label: string;
  kind: FieldKind;
  required: boolean;
  /** Header names recognised automatically, lower-cased and stripped. */
  aliases: string[];
  hint?: string;
};

/**
 * The customer import schema. Only name and revenue are strictly required —
 * everything else degrades to a stated default so a partial export still
 * produces a scoreable book rather than an error page.
 */
export const customerFields: FieldSpec[] = [
  { key: "name", label: "Customer name", kind: "text", required: true, aliases: ["customer", "customername", "account", "accountname", "party", "buyer", "client"] },
  { key: "ytd", label: "Revenue this period", kind: "number", required: true, aliases: ["revenue", "sales", "ytd", "salesvalue", "amount", "netamount", "invoicevalue", "totalsales", "value"] },
  { key: "lastYear", label: "Revenue prior period", kind: "number", required: false, aliases: ["lastyear", "prioryear", "previousyear", "ly", "lastyearsales", "py"], hint: "Enables growth and lifetime value." },
  { key: "country", label: "Country / market", kind: "text", required: false, aliases: ["country", "market", "region", "geography", "location"] },
  { key: "owner", label: "Account manager", kind: "text", required: false, aliases: ["owner", "salesperson", "accountmanager", "rep", "salesrep", "executive"] },
  { key: "broker", label: "Broker", kind: "text", required: false, aliases: ["broker", "agent", "channel", "intermediary"] },
  { key: "lastPurchase", label: "Last purchase date", kind: "date", required: false, aliases: ["lastpurchase", "lastorder", "lastinvoice", "lastinvoicedate", "lasttransaction", "lastpurchasedate"], hint: "Drives recency, churn and reorder timing." },
  { key: "firstPurchase", label: "First purchase date", kind: "date", required: false, aliases: ["firstpurchase", "firstorder", "customersince", "onboarded", "firstinvoice"] },
  { key: "transactions", label: "Invoice count", kind: "number", required: false, aliases: ["transactions", "invoices", "orders", "ordercount", "invoicecount", "numberofinvoices"], hint: "Drives RFM frequency. Read as an annual rate — the reorder cycle is inferred from it." },
  { key: "avgTxn", label: "Average order value", kind: "number", required: false, aliases: ["averageordervalue", "avgordervalue", "averageinvoicevalue", "avgtxn", "averagetransaction"], hint: "Measured average order value. Without it, revenue is divided by the invoice count." },
  { key: "carats", label: "Carats", kind: "number", required: false, aliases: ["carats", "carat", "ct", "totalcarats"] },
  { key: "stones", label: "Stones", kind: "number", required: false, aliases: ["stones", "pieces", "pcs", "stonecount", "quantity"] },
  { key: "avgDiscount", label: "Average discount %", kind: "number", required: false, aliases: ["discount", "avgdiscount", "averagediscount", "discountpct", "discountpercent"], hint: "Drives pricing realisation and the discount lever." },
  { key: "paymentScore", label: "Payment score", kind: "number", required: false, aliases: ["paymentscore", "creditscore", "paymentrating", "payment"] },
  { key: "terms", label: "Payment terms", kind: "text", required: false, aliases: ["terms", "paymentterms", "credit", "creditterms"] },
  { key: "estimatedCapacity", label: "Estimated buying capacity", kind: "number", required: false, aliases: ["capacity", "estimatedcapacity", "potential", "wallet", "walletsize", "marketpotential"], hint: "Drives wallet share and expansion." },
  { key: "shape", label: "Preferred shape", kind: "text", required: false, aliases: ["shape", "preferredshape", "cut"] },
  { key: "caratBand", label: "Preferred carat band", kind: "text", required: false, aliases: ["caratband", "sizeband", "preferredcarat"] },
  { key: "colour", label: "Preferred colour", kind: "text", required: false, aliases: ["colour", "color", "preferredcolour"] },
  { key: "clarity", label: "Preferred clarity", kind: "text", required: false, aliases: ["clarity", "preferredclarity"] },
  { key: "lab", label: "Certifying lab", kind: "text", required: false, aliases: ["lab", "certificate", "cert", "laboratory"] },
];

const normalise = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Best-guess column mapping, so a well-named export needs no manual work. */
export function autoMapColumns(headers: string[]): Record<string, number> {
  const mapping: Record<string, number> = {};
  const used = new Set<number>();

  // Two passes, and the order matters. Every exact match is claimed before any
  // containment match, otherwise a field declared earlier can take a column on
  // a loose substring that a later field matches exactly -- "Payment Terms"
  // being claimed by `paymentScore` (alias "payment") instead of `terms`
  // (alias "paymentterms").
  for (const field of customerFields) {
    const exact = headers.findIndex(
      (h, i) => !used.has(i) && field.aliases.includes(normalise(h)),
    );
    if (exact >= 0) {
      mapping[field.key] = exact;
      used.add(exact);
    }
  }

  for (const field of customerFields) {
    if (mapping[field.key] !== undefined) continue;
    // Longest alias first so "lastpurchase" wins over "purchase".
    const sorted = [...field.aliases].sort((a, b) => b.length - a.length);
    const partial = headers.findIndex(
      (h, i) => !used.has(i) && sorted.some((a) => normalise(h).includes(a)),
    );
    if (partial >= 0) {
      mapping[field.key] = partial;
      used.add(partial);
    }
  }

  return mapping;
}

/* ------------------------------------------------------------------ */
/* Record construction                                                 */
/* ------------------------------------------------------------------ */

export type ImportIssue = { row: number; field: string; message: string };

export type ImportResult = {
  records: CustomerSource[];
  issues: ImportIssue[];
  /** Rows that could not produce a usable record at all. */
  skipped: number;
  totalRows: number;
};

const REFERENCE = Date.parse(`${asOf.date} UTC`);
const DAY = 86_400_000;
export const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function slug(name: string, index: number): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  return base ? `${base}-${index}` : `imported-${index}`;
}

export const flags: Record<string, string> = {
  belgium: "🇧🇪", dubai: "🇦🇪", uae: "🇦🇪", "united arab emirates": "🇦🇪",
  israel: "🇮🇱", "hong kong": "🇭🇰", india: "🇮🇳", usa: "🇺🇸",
  "united states": "🇺🇸", china: "🇨🇳", thailand: "🇹🇭", japan: "🇯🇵",
};

/**
 * Builds source records from parsed rows.
 *
 * Missing optional inputs fall back to conservative defaults rather than
 * failing the row — but the caller is told what was assumed, so an import is
 * never silently worse than it looks.
 */
export function buildRecords(
  rows: string[][],
  mapping: Record<string, number>,
): ImportResult {
  const [, ...body] = rows;
  const issues: ImportIssue[] = [];
  const records: CustomerSource[] = [];
  let skipped = 0;

  const get = (row: string[], key: string): string => {
    const index = mapping[key];
    return index === undefined ? "" : (row[index] ?? "").trim();
  };

  body.forEach((row, i) => {
    const rowNumber = i + 2; // 1-based, plus the header line
    const name = get(row, "name");
    const ytd = toNumber(get(row, "ytd"));

    if (!name) {
      issues.push({ row: rowNumber, field: "name", message: "No customer name — row skipped." });
      skipped += 1;
      return;
    }
    if (ytd === null) {
      issues.push({ row: rowNumber, field: "ytd", message: `No revenue value for "${name}" — row skipped.` });
      skipped += 1;
      return;
    }

    const lastPurchaseMs = toDate(get(row, "lastPurchase"));
    if (get(row, "lastPurchase") && lastPurchaseMs === null) {
      issues.push({ row: rowNumber, field: "lastPurchase", message: `Unrecognised date "${get(row, "lastPurchase")}" — recency defaulted.` });
    }
    const daysSince =
      lastPurchaseMs === null ? 30 : Math.max(0, Math.round((REFERENCE - lastPurchaseMs) / DAY));

    const firstPurchaseMs = toDate(get(row, "firstPurchase"));
    const firstDate = new Date(firstPurchaseMs ?? REFERENCE - 730 * DAY);
    const lastDate = new Date(lastPurchaseMs ?? REFERENCE - 30 * DAY);

    const transactions = Math.max(1, Math.round(toNumber(get(row, "transactions")) ?? 12));
    // `transactions` is an annual rate, so dividing revenue for a shorter
    // period by it understates the order value. An export that measured the
    // average order value directly is believed ahead of the division.
    const avgTxn = Math.round(toNumber(get(row, "avgTxn")) ?? ytd / transactions);
    const lastYear = toNumber(get(row, "lastYear")) ?? ytd;
    const country = get(row, "country") || "Unspecified";

    // A reorder window is inferred from observed frequency when the export
    // does not carry one: the mean interval, widened by a quarter either way.
    const meanInterval = Math.max(4, Math.round(365 / Math.max(transactions, 1)));
    const cycleDays: [number, number] = [
      Math.max(2, Math.round(meanInterval * 0.75)),
      Math.round(meanInterval * 1.25),
    ];

    records.push({
      id: slug(name, i + 1),
      name,
      country,
      flag: flags[country.toLowerCase()] ?? "🏳️",
      ytd,
      lastYear,
      carats: Math.round(toNumber(get(row, "carats")) ?? ytd / 1800),
      stones: Math.round(toNumber(get(row, "stones")) ?? ytd / 2600),
      transactions,
      firstPurchase: `${MONTH_LABELS[firstDate.getUTCMonth()]} ${firstDate.getUTCFullYear()}`,
      lastPurchase: `${lastDate.getUTCDate()} ${MONTH_LABELS[lastDate.getUTCMonth()]} ${lastDate.getUTCFullYear()}`,
      daysSince,
      cycleDays,
      cycleType: meanInterval <= 12 ? "High frequency" : transactions >= 6 ? "Regular" : "Irregular",
      avgTxn,
      owner: get(row, "owner") || "Unassigned",
      broker: get(row, "broker") || null,
      terms: get(row, "terms") || "30 days",
      paymentScore: Math.round(toNumber(get(row, "paymentScore")) ?? 85),
      avgDiscount: toNumber(get(row, "avgDiscount")) ?? 4.5,
      // Without a capacity estimate, assume LUSTRE holds roughly a third.
      estimatedCapacity: Math.round(toNumber(get(row, "estimatedCapacity")) ?? ytd * 3),
      preferences: {
        shape: get(row, "shape") || "Unspecified",
        carat: get(row, "caratBand") || "Unspecified",
        colour: get(row, "colour") || "—",
        clarity: get(row, "clarity") || "—",
        lab: get(row, "lab") || "—",
      },
      crossSell: [],
      action: "Imported record — recommendation generated from the scored profile.",
    });
  });

  return { records, issues, skipped, totalRows: body.length };
}

/** Fields that were not mapped, so the UI can say what will be assumed. */
export function unmappedFields(mapping: Record<string, number>): FieldSpec[] {
  return customerFields.filter((f) => mapping[f.key] === undefined);
}
