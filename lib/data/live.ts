"use client";

import type { Dimensions as MaybeDimensions } from "@/lib/db/dimensions";

/** The rollups, once a page has confirmed an import exists. */
export type Dimensions = NonNullable<MaybeDimensions>;

/**
 * Adapters from the imported lot rows to the shapes the pages already render.
 *
 * Every field the export can support is computed here. Fields it cannot are
 * returned as `null` rather than estimated — stock on hand, stock-to-sales and
 * dead-stock probability all need current inventory, and targets and activity
 * counts need datasets LUSTRE has not sent. A page renders `null` as "—" and
 * says why, which is the difference between an honest gap and a made-up
 * number.
 */

/** "1 Apr", and "22 Aug 2026" when the year is wanted. */
function day(iso: string, withYear = false): string {
  const [y, m, d] = iso.split("-").map(Number);
  const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                 "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1];
  return `${d} ${month}${withYear ? ` ${y}` : ""}`;
}

/** The window the figures cover, e.g. "1 Apr – 22 Aug 2026". */
export function periodLabel(d: Dimensions): string {
  return `${day(d.period.currentFrom)} – ${day(d.period.currentTo, true)}`;
}

const SHAPE_NAMES: Record<string, string> = {
  RB: "Round Brilliant", OV: "Oval", PE: "Pear", MQ: "Marquise", EM: "Emerald",
  PR: "Princess", CU: "Cushion", RAD: "Radiant", HT: "Heart", ASH: "Asscher",
  CUSQ: "Cushion Square",
};
export const shapeName = (s: string) => SHAPE_NAMES[s] ?? s;

export type LiveSpec = {
  spec: string; shape: string; carat: string; colour: string; clarity: string;
  revenue: number; carats: number; stones: number; rate: number; growth: number;
  velocity: number; daysToSell: number; avgDiscount: number;
  status: "Accelerating" | "Steady" | "Weakening" | "Oversupplied" | "Short";
  stockCt: null; deadStockRisk: null; stockToSales: null;
};

export function liveSpecs(d: Dimensions, days: number): LiveSpec[] {
  return d.specs.map((s) => ({
    spec: `${shapeName(s.shape)} / ${s.carat} / ${s.colour} / ${s.clarity}`,
    shape: shapeName(s.shape), carat: s.carat, colour: s.colour, clarity: s.clarity,
    revenue: s.revenue, carats: s.carats, stones: s.stones, rate: s.rate,
    growth: s.growth, avgDiscount: s.avgDiscount,
    velocity: Math.round(s.stones / (days / 30)),
    daysToSell: s.daysToSell,
    status: s.growth > 15 ? "Accelerating" : s.growth < -15 ? "Oversupplied"
          : s.growth < -5 ? "Weakening" : "Steady",
    stockCt: null, deadStockRisk: null, stockToSales: null,
  }));
}

/** Shape x carat-band demand, indexed against the portfolio average = 100. */
export function liveHeatmap(d: Dimensions) {
  const shapes = [...new Set(d.shapeDemand.map((s) => s.shape))]
    .map((s) => ({ s, rev: d.shapeDemand.filter((x) => x.shape === s).reduce((a, b) => a + b.revenue, 0) }))
    .sort((a, b) => b.rev - a.rev).slice(0, 7).map((x) => x.s);
  const cols = [...new Set(d.shapeDemand.map((s) => s.carat))].sort();
  const cells = shapes.map((sh) =>
    cols.map((c) => d.shapeDemand.find((x) => x.shape === sh && x.carat === c)?.revenue ?? 0));
  const all = cells.flat().filter((v) => v > 0);
  const avg = all.length ? all.reduce((a, b) => a + b, 0) / all.length : 1;
  return {
    rows: shapes.map(shapeName), cols,
    values: cells.map((r) => r.map((v) => Math.round((v / avg) * 100))),
  };
}

export type LiveRep = {
  id: string; name: string; initials: string; region: string; flag: string;
  revenue: number; carats: number; stones: number; accounts: number;
  growth: number; retention: number; avgDiscount: number; avgOrderValue: number;
  orders: number; score: number;
  target: null; achievement: null; touches: null; recovery: null;
};

const initials = (n: string) =>
  n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

/**
 * A composite score over the factors the export supports: revenue rank,
 * growth, retention and discount discipline. SOW 5.5 lists thirteen factors;
 * activity, follow-up, response time and target achievement are not among
 * these because no delivered dataset carries them.
 */
export function liveReps(d: Dimensions): LiveRep[] {
  const max = Math.max(...d.owners.map((o) => o.revenue), 1);
  const discs = d.owners.map((o) => o.avgDiscount).filter((x) => x > 0);
  const medDisc = discs.length ? discs.sort((a, b) => a - b)[Math.floor(discs.length / 2)] : 0;
  return d.owners.map((o) => {
    const revScore = (o.revenue / max) * 40;
    const growthScore = Math.max(0, Math.min(25, (o.growth + 20) / 2));
    const retScore = (Math.min(100, o.retention) / 100) * 20;
    // Below the median discount is better realisation, so it scores higher.
    const discScore = medDisc > 0 ? Math.max(0, Math.min(15, 15 - (o.avgDiscount - medDisc) * 3)) : 7.5;
    return {
      id: o.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      name: o.name, initials: initials(o.name), region: "", flag: "",
      revenue: o.revenue, carats: o.carats, stones: o.stones,
      accounts: o.customers, growth: o.growth, retention: o.retention,
      avgDiscount: o.avgDiscount, avgOrderValue: o.avgOrderValue,
      orders: o.orders,
      score: Math.round(revScore + growthScore + retScore + discScore),
      target: null, achievement: null, touches: null, recovery: null,
    };
  });
}

/**
 * Internal price benchmark. The benchmark is the median realised rate for the
 * same specification across the whole book, which is what SOW 5.4 asks for —
 * comparable historical transactions, not an external price feed.
 */
/**
 * Each stone type's recent price per carat against its own price over the full
 * history. "Money left behind" is what the recent carats would have brought at
 * that usual price, when they sold below it.
 */
export function liveBenchmark(d: Dimensions) {
  return d.specs.slice(0, 12).map((s) => {
    const realised = s.rate;
    const benchmark = s.usualRate || s.rate;
    const variance = benchmark > 0 ? ((realised - benchmark) / benchmark) * 100 : 0;
    return {
      spec: `${shapeName(s.shape)} / ${s.carat} / ${s.colour} / ${s.clarity}`,
      benchmark, realised, variance, stones: s.stones,
      leakage: realised < benchmark ? (benchmark - realised) * s.carats : 0,
    };
  });
}

export function liveDiscountBands(d: Dimensions) {
  const total = d.discountBands.reduce((a, b) => a + b.revenue, 0) || 1;
  return d.discountBands.map((b) => ({
    band: b.band, txns: b.stones, value: b.revenue / 1e6,
    share: Math.round((b.revenue / total) * 100),
  }));
}
