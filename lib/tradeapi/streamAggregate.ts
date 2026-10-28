import "server-only";

import { flags, MONTH_LABELS, slug } from "@/lib/data/csv";
import type { CustomerSource } from "@/lib/analytics/customer";
import type { LotRowInput } from "@/lib/db/repository";

/**
 * Streaming per-customer aggregation, shared by every bulk-import path
 * (the Trade Data API backfill, and a direct Excel-file import) so a batch
 * of rows can be folded into running totals and discarded immediately,
 * rather than holding the whole dataset in memory for one big
 * aggregateCustomers() call at the end. Same reduction aggregateCustomers.ts
 * does for the normal 30-day sync — extracted here since both bulk-import
 * paths need it and neither should hold millions of rows in memory to get it.
 */

export type Bucket = {
  nameCounts: Map<string, number>;
  curRevenue: number;
  priorRevenue: number;
  allRevenue: number;
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

export type StreamWindow = { currentFromMs: number; priorFromMs: number; priorToMs: number; asOfMs: number };

/** The current/prior comparison windows, fixed to a known `asOf` up front —
 *  the thing that makes single-pass streaming possible, since a row can be
 *  classified the moment it arrives instead of waiting to see the whole
 *  dataset first (as aggregateCustomers.ts, which derives asOf from the
 *  data itself, has to). Correct whenever the caller fetches/reads through
 *  the given asOf date, which both bulk-import paths do. */
export function makeStreamWindow(asOfISODate: string): StreamWindow {
  const DAY = 86_400_000;
  const asOfMs = Date.parse(asOfISODate);
  const currentFromMs = asOfMs - 365 * DAY;
  const priorToMs = currentFromMs;
  const priorFromMs = priorToMs - 365 * DAY;
  return { currentFromMs, priorFromMs, priorToMs, asOfMs };
}

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

/** Folds one batch of rows into the running per-customer buckets. The
 *  caller is free to drop the batch afterward — nothing here retains a
 *  row reference past this call. */
export function foldRows(buckets: Map<string, Bucket>, rows: LotRowInput[], window: StreamWindow) {
  for (const r of rows) {
    if (!r.saleDate) continue; // mirrors aggregateCustomers.ts: no usable sale date, row dropped
    let b = buckets.get(r.customerKey);
    if (!b) {
      b = {
        nameCounts: new Map(), curRevenue: 0, priorRevenue: 0, allRevenue: 0,
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
    if (saleMs >= window.currentFromMs && saleMs <= window.asOfMs) {
      b.curRevenue += r.amount;
      if (r.orderNo) b.curOrderIds.add(r.orderNo);
    }
    if (saleMs >= window.priorFromMs && saleMs <= window.priorToMs) {
      b.priorRevenue += r.amount;
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
}

/** Same finalization math as aggregateCustomers.ts's final loop. */
export function finalizeBuckets(buckets: Map<string, Bucket>): CustomerSource[] {
  const out: CustomerSource[] = [];
  let i = 0;
  for (const b of buckets.values()) {
    i += 1;
    const name = [...b.nameCounts.entries()].sort((a, z) => z[1] - a[1])[0][0];
    const ytd = Math.round(b.curRevenue * 100) / 100;
    const lastYear = Math.round(b.priorRevenue * 100) / 100;
    const spanDays = Math.round((Date.parse(b.last) - Date.parse(b.first)) / 86_400_000) + 1;
    const span = Math.max(spanDays, 30);
    const transactions = Math.max(1, Math.round((b.allOrderIds.size || 1) * (365 / span)));
    const avgTxn = b.curOrderIds.size ? Math.round(ytd / b.curOrderIds.size) : Math.round(ytd);
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

/** Buckets hold Maps and Sets, which JSON drops — these round-trip them so
 *  the running totals can be stored and later topped up with new rows. */
export function serializeBuckets(buckets: Map<string, Bucket>): string {
  return JSON.stringify([...buckets], (_k, v) =>
    v instanceof Map ? { __map: [...v] } : v instanceof Set ? { __set: [...v] } : v,
  );
}

export function deserializeBuckets(json: string): Map<string, Bucket> {
  return new Map(
    JSON.parse(json, (_k, v) =>
      v && typeof v === "object" && "__map" in v ? new Map(v.__map)
      : v && typeof v === "object" && "__set" in v ? new Set(v.__set)
      : v,
    ),
  );
}
