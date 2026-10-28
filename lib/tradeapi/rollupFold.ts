import type { LotRowInput } from "@/lib/db/repository";

/**
 * Folds sale rows into the sums stored in the `rollups` table. Every measure
 * is additive, so a later window is just a sum of periods and an auto-sync can
 * add new days without touching old ones.
 */

export type Cell = {
  revenue: number; carats: number; stones: number;
  discSum: number; discN: number; stockSum: number; stockN: number;
  rapVal: number; rapAmt: number; listVal: number; listAmt: number;
  orders: Set<string>;
};
export type RollupAcc = Map<string, Cell>;

const SEP = "\u0001";
/** Distinct-order counts are only kept where a page shows them, to bound memory. */
const ORDER_DIMS = new Set(["all", "owner", "country"]);

/** Discount is percent off the natural Rapaport list (lab-grown trades at 98-100% off), so bands sit just under 100. */
export const DISCOUNT_BANDS = [
  { label: "Under 97%", max: 97 },
  { label: "97 to 98.5%", max: 98.5 },
  { label: "98.5 to 99%", max: 99 },
  { label: "99 to 99.5%", max: 99.5 },
  { label: "99.5 to 99.9%", max: 99.9 },
  { label: "99.9 to 100%", max: 100.0001 },
  { label: "Over 100% (data error)", max: Infinity },
] as const;

export function discountBand(d: number | null): string | null {
  if (d === null || d <= 0 || d > 150) return null; // 0 is a missing figure written as a number
  return DISCOUNT_BANDS.find((b) => d < b.max)!.label;
}

export function ageingBand(days: number | null): string | null {
  if (days === null) return null;
  return days <= 30 ? "0-30" : days <= 90 ? "31-90" : days <= 180 ? "91-180" : days <= 365 ? "181-365" : "365+";
}

function cell(acc: RollupAcc, key: string): Cell {
  let c = acc.get(key);
  if (!c) {
    c = { revenue: 0, carats: 0, stones: 0, discSum: 0, discN: 0, stockSum: 0, stockN: 0, rapVal: 0, rapAmt: 0, listVal: 0, listAmt: 0, orders: new Set() };
    acc.set(key, c);
  }
  return c;
}

export function foldRollups(acc: RollupAcc, rows: LotRowInput[]) {
  for (const r of rows) {
    if (!r.saleDate) continue;
    const day = r.saleDate;
    const month = day.slice(0, 7);
    const keys: [string, string, string][] = [[day, "all", ""]];
    const add = (period: string, dim: string, value: string | null) => {
      if (value) keys.push([period, dim, value]);
    };
    add(day, "country", r.country);
    add(day, "location", r.location);
    add(day, "owner", r.owner);
    add(day, "broker", r.broker);
    add(day, "ageing", ageingBand(r.daysInStock));
    add(day, "discband", discountBand(r.discPercent));
    add(month, "terms", r.terms);
    if (r.shape) add(month, "spec", `${r.shape}|${r.caratBand}|${r.colour ?? "—"}|${r.clarity ?? "—"}`);

    const hasDisc = r.discPercent !== null && r.discPercent > 0 && r.discPercent <= 150;
    for (const [period, dim, value] of keys) {
      const c = cell(acc, `${period}${SEP}${dim}${SEP}${value}`);
      c.revenue += r.amount;
      c.carats += r.carats;
      c.stones += 1;
      if (hasDisc) { c.discSum += r.discPercent as number; c.discN += 1; }
      if (r.daysInStock !== null) { c.stockSum += r.daysInStock; c.stockN += 1; }
      if (r.rap > 0) { c.rapVal += r.rap * r.carats; c.rapAmt += r.amount; }
      if (r.listPrice > 0) { c.listVal += r.listPrice * r.carats; c.listAmt += r.amount; }
      if (r.orderNo && ORDER_DIMS.has(dim)) c.orders.add(r.orderNo);
    }
  }
}

export function splitKey(key: string): { period: string; dim: string; value: string } {
  const [period, dim, value] = key.split(SEP);
  return { period, dim, value };
}
