import "server-only";

import { flags, MONTH_LABELS, slug } from "@/lib/data/csv";
import type { CustomerSource } from "@/lib/analytics/customer";
import type { LotRowInput } from "@/lib/db/repository";

/**
 * Rolls stone-level API rows up into customer-grain records — the same
 * transformation data-samples/sale_data_ingest.py does for the workbook path,
 * so a customer synced from the API scores through the exact same
 * buildCustomerProfiles pipeline as a CSV import.
 */

type Bucket = {
  nameCounts: Map<string, number>;
  allRevenue: number;
  curRevenue: number;
  priorRevenue: number;
  allOrderIds: Set<string>;
  curOrderIds: Set<string>;
  carats: number;
  lots: number;
  discSum: number;
  discCount: number;
  first: string;
  last: string;
  country: Map<string, number>;
  owner: Map<string, number>;
  broker: Map<string, number>;
  terms: Map<string, number>;
  shape: Map<string, number>;
  caratBand: Map<string, number>;
  colour: Map<string, number>;
  clarity: Map<string, number>;
  lab: Map<string, number>;
};

function bump(map: Map<string, number>, v: string | null) {
  if (!v) return;
  map.set(v, (map.get(v) ?? 0) + 1);
}

function top(map: Map<string, number>): string {
  let best = "";
  let bestN = -1;
  for (const [k, n] of map) {
    if (n > bestN) {
      best = k;
      bestN = n;
    }
  }
  return best;
}

export function aggregateCustomers(rows: LotRowInput[]): CustomerSource[] {
  // The comparison window is taken from the data itself, the same way
  // data-samples/sale_data_ingest.py derives it for the CSV path: the current
  // window is the longest run (capped at 366 days) ending at the most recent
  // sale, and the prior window is the same length exactly 365 days earlier —
  // same months of the year on both sides, so growth is like-for-like rather
  // than an all-time cumulative total mislabelled as "this year".
  let dataStart: string | null = null;
  let asOf: string | null = null;
  for (const r of rows) {
    if (!r.saleDate) continue;
    if (dataStart === null || r.saleDate < dataStart) dataStart = r.saleDate;
    if (asOf === null || r.saleDate > asOf) asOf = r.saleDate;
  }

  const DAY = 86_400_000;
  let currentFromMs = -Infinity;
  let priorFromMs = -Infinity;
  let priorToMs = -Infinity;
  let hasComparableHistory = false;
  if (asOf !== null && dataStart !== null) {
    const asOfMs = Date.parse(asOf);
    priorToMs = asOfMs - 365 * DAY;
    const lengthDays = Math.min(Math.round((priorToMs - Date.parse(dataStart)) / DAY) + 1, 366);
    // ponytail: below 28 days of comparable history (the existing 30-day
    // rolling sync's normal case) there's no real prior-year twin to compare
    // against — same flat-growth fallback the old cumulative-only code used.
    hasComparableHistory = lengthDays >= 28;
    currentFromMs = asOfMs - (lengthDays - 1) * DAY;
    priorFromMs = currentFromMs - 365 * DAY;
  }

  const buckets = new Map<string, Bucket>();

  for (const r of rows) {
    if (!r.saleDate) continue; // mirrors the workbook ingest: no usable sale date, row dropped
    let b = buckets.get(r.customerKey);
    if (!b) {
      b = {
        nameCounts: new Map(), allRevenue: 0, curRevenue: 0, priorRevenue: 0,
        allOrderIds: new Set(), curOrderIds: new Set(), carats: 0, lots: 0,
        discSum: 0, discCount: 0, first: r.saleDate, last: r.saleDate,
        country: new Map(), owner: new Map(), broker: new Map(), terms: new Map(),
        shape: new Map(), caratBand: new Map(), colour: new Map(), clarity: new Map(), lab: new Map(),
      };
      buckets.set(r.customerKey, b);
    }
    bump(b.nameCounts, r.customerName);
    b.allRevenue += r.amount;
    if (r.orderNo) b.allOrderIds.add(r.orderNo);
    const saleMs = Date.parse(r.saleDate);
    if (hasComparableHistory) {
      if (saleMs >= currentFromMs && saleMs <= (asOf ? Date.parse(asOf) : -Infinity)) {
        b.curRevenue += r.amount;
        if (r.orderNo) b.curOrderIds.add(r.orderNo);
      }
      if (saleMs >= priorFromMs && saleMs <= priorToMs) {
        b.priorRevenue += r.amount;
      }
    }
    b.carats += r.carats;
    b.lots += 1;
    if (r.discPercent !== null && r.discPercent >= 0 && r.discPercent <= 100) {
      b.discSum += r.discPercent;
      b.discCount += 1;
    }
    if (r.saleDate < b.first) b.first = r.saleDate;
    if (r.saleDate > b.last) b.last = r.saleDate;
    bump(b.country, r.country);
    bump(b.owner, r.owner);
    bump(b.broker, r.broker);
    bump(b.terms, r.terms);
    bump(b.shape, r.shape);
    bump(b.caratBand, r.caratBand);
    bump(b.colour, r.colour);
    bump(b.clarity, r.clarity);
    bump(b.lab, r.lab);
  }

  const out: CustomerSource[] = [];
  let i = 0;
  for (const b of buckets.values()) {
    i += 1;
    const name = [...b.nameCounts.entries()].sort((a, z) => z[1] - a[1])[0][0];
    const ytd = Math.round((hasComparableHistory ? b.curRevenue : b.allRevenue) * 100) / 100;
    const lastYear = Math.round((hasComparableHistory ? b.priorRevenue : b.allRevenue) * 100) / 100;
    const spanDays = Math.round((Date.parse(b.last) - Date.parse(b.first)) / 86_400_000) + 1;
    const span = Math.max(spanDays, 30);
    const transactions = Math.max(1, Math.round((b.allOrderIds.size || 1) * (365 / span)));
    const curOrders = hasComparableHistory ? b.curOrderIds.size : b.allOrderIds.size;
    const avgTxn = curOrders ? Math.round(ytd / curOrders) : Math.round(ytd);
    const country = top(b.country) || "Unspecified";
    const firstDate = new Date(b.first);
    const lastDate = new Date(b.last);
    const meanInterval = Math.max(4, Math.round(365 / Math.max(transactions, 1)));

    out.push({
      id: slug(name, i),
      name,
      country,
      flag: flags[country.toLowerCase()] ?? "🏳️",
      ytd,
      lastYear,
      carats: Math.round(b.carats),
      stones: b.lots,
      transactions,
      firstPurchase: `${MONTH_LABELS[firstDate.getUTCMonth()]} ${firstDate.getUTCFullYear()}`,
      lastPurchase: `${lastDate.getUTCDate()} ${MONTH_LABELS[lastDate.getUTCMonth()]} ${lastDate.getUTCFullYear()}`,
      daysSince: Math.max(0, Math.round((Date.now() - Date.parse(b.last)) / 86_400_000)),
      cycleDays: [Math.max(2, Math.round(meanInterval * 0.75)), Math.round(meanInterval * 1.25)],
      cycleType: meanInterval <= 12 ? "High frequency" : transactions >= 6 ? "Regular" : "Irregular",
      avgTxn,
      owner: top(b.owner) || "Unassigned",
      broker: top(b.broker) || null,
      terms: top(b.terms) || "30 days",
      paymentScore: 85,
      avgDiscount: b.discCount ? Math.round((b.discSum / b.discCount) * 100) / 100 : 4.5,
      estimatedCapacity: Math.round(ytd * 3),
      preferences: {
        shape: top(b.shape) || "Unspecified",
        carat: top(b.caratBand) || "Unspecified",
        colour: top(b.colour) || "—",
        clarity: top(b.clarity) || "—",
        lab: top(b.lab) || "—",
      },
      crossSell: [],
      action: "Synced from the Trade Data API.",
    });
  }
  return out;
}
