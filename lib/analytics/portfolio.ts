/**
 * Engine 2 — book-level aggregates.
 *
 * Everything the Customers page shows above the tables: the KPI band, the
 * class distribution, the RFM grid and the concentration exposures. All of it
 * is counted from the scored customer records, so the headline figures and the
 * rows underneath them can never disagree.
 */

import type { Customer, CustomerClass } from "@/lib/data/types";
import type { Tone } from "@/lib/format";
import { annualRunRate, predictReorder, rfmLabel } from "./customer";

/** An account is "active" if it has bought within the last 180 days. */
export const ACTIVE_WINDOW_DAYS = 180;
/** Churn probability at which an account is treated as materially at risk. */
export const ELEVATED_CHURN = 60;
/** Headroom below which an expansion opportunity is not worth planning around. */
export const MATERIAL_EXPANSION = 1_500_000;
/** Prior-year revenue below which a collapse is not an executive concern. */
export const MATERIAL_DECLINE = 1_200_000;

export type PortfolioKpis = {
  total: number;
  active: number;
  atRisk: number;
  atRiskAnnualValue: number;
  reordersDue: number;
  expansionAccounts: number;
  expansionValue: number;
  totalRevenue: number;
};

/** Past their window by this many of their own cycles (and at least LAPSED_MIN_DAYS), a customer has lapsed. */
export const LAPSED_AFTER_CYCLES = 3;
export const LAPSED_MIN_DAYS = 90;

export type CallKind = "Due now" | "Past their usual time" | "Lapsed" | "At risk";

/**
 * The one rule every work list uses (Home, My day, notifications, Things to
 * check), so their counts agree. Due now: inside the usual buying window or
 * entering it within a week. Past their usual time: missed the window but
 * still recent enough to be a reorder conversation. Lapsed: so far past it that
 * it is a win-back. At risk: none of those, but buying has dropped sharply.
 */
export function callKind(c: Customer): CallKind | null {
  if (c.pausedUntil) return null; // a note has paused this customer's alerts
  const p = predictReorder(c);
  if (c.daysSince > Math.max(c.cycleDays[1] * LAPSED_AFTER_CYCLES, LAPSED_MIN_DAYS)) return "Lapsed";
  if (p.status === "Overdue") return "Past their usual time";
  if (p.status === "Due now" || (c.daysSince <= ACTIVE_WINDOW_DAYS && p.daysToExpected >= 0 && p.daysToExpected <= 7)) {
    return "Due now";
  }
  if (c.churnRisk >= ELEVATED_CHURN) return "At risk";
  return null;
}

/** At risk of leaving: still buying but slipping. A customer who stopped long ago has already left. */
export const isAtRisk = (c: Customer) => !c.pausedUntil && c.churnRisk >= ELEVATED_CHURN && c.daysSince <= ACTIVE_WINDOW_DAYS;

export function portfolioKpis(customers: Customer[]): PortfolioKpis {
  const active = customers.filter((c) => c.daysSince <= ACTIVE_WINDOW_DAYS);
  const atRisk = customers.filter(isAtRisk);
  const reordersDue = customers.filter((c) => callKind(c) === "Due now");

  // Under-penetrated accounts worth acting on: LUSTRE holds a small share of a
  // large capacity, and the headroom is material enough to build a plan around.
  const expansion = customers.filter(
    (c) =>
      c.walletShare < 20 &&
      c.daysSince <= ACTIVE_WINDOW_DAYS &&
      c.estimatedCapacity * 0.35 - c.ytd >= MATERIAL_EXPANSION,
  );

  return {
    total: customers.length,
    active: active.length,
    atRisk: atRisk.length,
    atRiskAnnualValue: atRisk.reduce((s, c) => s + annualRunRate(c.ytd), 0),
    reordersDue: reordersDue.length,
    expansionAccounts: expansion.length,
    // Headroom to a realistic 35% share, not to full capacity.
    expansionValue: expansion.reduce(
      (s, c) => s + Math.max(0, c.estimatedCapacity * 0.35 - c.ytd),
      0,
    ),
    totalRevenue: customers.reduce((s, c) => s + c.ytd, 0),
  };
}

/* ------------------------------------------------------------------ */
/* Class distribution                                                  */
/* ------------------------------------------------------------------ */

const classTone: Record<CustomerClass, Tone> = {
  Growing: "positive",
  Healthy: "info",
  Stable: "neutral",
  Declining: "warn",
  Dormant: "negative",
  Lost: "negative",
  Recovered: "positive",
  "High Potential": "violet",
  VIP: "accent",
  New: "violet",
  Seasonal: "info",
  "Price Sensitive": "warn",
};

/** Segment counts and revenue, largest first. Empty segments are dropped. */
export function classDistribution(customers: Customer[]) {
  const groups = new Map<CustomerClass, { count: number; value: number }>();
  for (const c of customers) {
    const g = groups.get(c.segment) ?? { count: 0, value: 0 };
    g.count += 1;
    g.value += c.ytd;
    groups.set(c.segment, g);
  }
  return [...groups.entries()]
    .map(([label, g]) => ({
      label,
      count: g.count,
      value: Math.round((g.value / 1_000_000) * 10) / 10,
      tone: classTone[label] ?? ("neutral" as Tone),
    }))
    .sort((a, b) => b.count - a.count);
}

/* ------------------------------------------------------------------ */
/* RFM grid                                                            */
/* ------------------------------------------------------------------ */

/** Recency x frequency cells, sized by the revenue sitting in each. */
export function buildRfmGrid(customers: Customer[]) {
  const cells = new Map<string, { r: number; f: number; customers: number; value: number }>();
  for (const c of customers) {
    const key = `${c.rfm.r}-${c.rfm.f}`;
    const cell = cells.get(key) ?? { r: c.rfm.r, f: c.rfm.f, customers: 0, value: 0 };
    cell.customers += 1;
    cell.value += c.ytd;
    cells.set(key, cell);
  }
  return [...cells.values()]
    .map((cell) => ({
      ...cell,
      value: Math.round((cell.value / 1_000_000) * 10) / 10,
      label: rfmLabel(cell.r, cell.f),
    }))
    .sort((a, b) => b.r - a.r || b.f - a.f);
}

/* ------------------------------------------------------------------ */
/* Concentration exposure                                              */
/* ------------------------------------------------------------------ */

function shareOfTopN(sorted: number[], total: number, n: number): number {
  const slice = sorted.slice(0, n).reduce((s, v) => s + v, 0);
  return total > 0 ? Math.round((slice / total) * 1000) / 10 : 0;
}

export function buildConcentration(customers: Customer[]) {
  const total = customers.reduce((s, c) => s + c.ytd, 0);
  const sorted = customers.map((c) => c.ytd).sort((a, b) => b - a);

  const byBrokerMap = new Map<string, { value: number; customers: number }>();
  const byCountryMap = new Map<string, number>();
  for (const c of customers) {
    if (c.broker) {
      const b = byBrokerMap.get(c.broker) ?? { value: 0, customers: 0 };
      b.value += c.ytd;
      b.customers += 1;
      byBrokerMap.set(c.broker, b);
    }
    byCountryMap.set(c.country, (byCountryMap.get(c.country) ?? 0) + c.ytd);
  }

  const byBroker = [...byBrokerMap.entries()]
    .map(([name, b]) => {
      const share = total > 0 ? (b.value / total) * 100 : 0;
      return {
        name,
        share: Math.round(share * 10) / 10,
        customers: b.customers,
        // Concentration risk is about revenue routed, not accounts served.
        risk: share >= 9 ? "High" : share >= 5 ? "Medium" : "Low",
      };
    })
    .sort((a, b) => b.share - a.share);

  const byCountry = [...byCountryMap.entries()]
    .map(([name, value]) => ({
      name,
      share: total > 0 ? Math.round((value / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.share - a.share);

  return {
    top1: shareOfTopN(sorted, total, 1),
    top5: shareOfTopN(sorted, total, 5),
    top10: shareOfTopN(sorted, total, 10),
    top20: shareOfTopN(sorted, total, 20),
    byBroker,
    byCountry,
  };
}

/* ------------------------------------------------------------------ */
/* Generated narrative                                                 */
/* ------------------------------------------------------------------ */

function listNames(names: string[], limit = 3): string {
  const shown = names.slice(0, limit);
  if (shown.length <= 1) return shown[0] ?? "";
  return `${shown.slice(0, -1).join(", ")} and ${shown[shown.length - 1]}`;
}

/**
 * The Customer Intelligence Summary copy, written from the data rather than
 * typed by hand — so it stays true when the client's own book is loaded.
 */
export function portfolioNarrative(customers: Customer[]) {
  // Only accounts large enough for their collapse to matter at book level.
  const declining = customers
    .filter((c) => c.growth < -60 && c.lastYear >= MATERIAL_DECLINE)
    .sort((a, b) => b.lastYear - b.ytd - (a.lastYear - a.ytd));
  const growing = customers
    .filter((c) => c.growth > 30 && c.ytd > 500_000)
    .sort((a, b) => b.growth - a.growth);

  const decliningValue = declining.reduce((s, c) => s + (c.lastYear - c.ytd), 0);
  const owners = new Set(declining.slice(0, 3).map((c) => c.owner));

  return {
    declining: {
      count: declining.length,
      names: listNames(declining.map((c) => c.name)),
      lostValue: decliningValue,
      singlePortfolio: owners.size === 1,
      owner: declining[0]?.owner ?? "",
    },
    growing: {
      count: growing.length,
      names: listNames(growing.map((c) => c.name), 4),
      addedValue: growing.reduce((s, c) => s + (c.ytd - c.lastYear), 0),
    },
  };
}

/* ------------------------------------------------------------------ */
/* Derived working lists                                               */
/* ------------------------------------------------------------------ */

/**
 * Accounts at or approaching their expected reorder window. Lapsed accounts are
 * kept but tagged, so lists can leave them out; the rest are ordered by what an
 * order from them is usually worth, so the most valuable call comes first.
 */
export function buildReorderDue(customers: Customer[]) {
  return customers
    .filter((c) => c.daysSince >= c.cycleDays[0] * 0.8)
    .map((c) => ({
      ...c,
      overdue: c.daysSince - c.cycleDays[1],
      window: `${c.cycleDays[0]}–${c.cycleDays[1]} days`,
      prediction: predictReorder(c),
      kind: callKind(c),
    }))
    .sort((a, b) => Number(a.kind === "Lapsed") - Number(b.kind === "Lapsed") || b.avgTxn - a.avgTxn);
}

/** Under-penetrated accounts ranked by headroom to a realistic 35% share. */
export function buildWalletShareOpportunities(customers: Customer[]) {
  return customers
    .filter((c) => c.walletShare < 30)
    .map((c) => ({
      id: c.id,
      name: c.name,
      flag: c.flag,
      country: c.country,
      current: c.ytd,
      share: c.walletShare,
      capacity: c.estimatedCapacity,
      upside: Math.round(c.estimatedCapacity * 0.35 - c.ytd),
      owner: c.owner,
    }))
    .filter((o) => o.upside > 0)
    .sort((a, b) => b.upside - a.upside);
}

/** Everything the Customers page renders, for whichever book is active. */
export function analyseBook(customers: Customer[]) {
  return {
    customers,
    kpis: portfolioKpis(customers),
    narrative: portfolioNarrative(customers),
    classDistribution: classDistribution(customers),
    rfmGrid: buildRfmGrid(customers),
    concentration: buildConcentration(customers),
    reorderDue: buildReorderDue(customers),
    walletShareOpportunities: buildWalletShareOpportunities(customers),
  };
}
