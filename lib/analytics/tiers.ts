import type { Customer } from "@/lib/data/types";
import { growthRate } from "./customer";

/**
 * Sales-rep tiers — Silver / Gold / Lustre Diamond — from real customer data
 * already loaded (revenue, growth, retention), not a separate fetch. A
 * composite score rather than revenue alone, so a rep growing fast or
 * keeping their accounts active can rank above a bigger but flat/churning
 * one, per the user's explicit choice.
 */

export type TierName = "Silver" | "Gold" | "Lustre Diamond";

export type RepTier = {
  name: string;
  customers: number;
  ytd: number;
  lastYear: number;
  growth: number;
  /** % of this rep's customers not currently overdue on their own cycle. */
  retention: number;
  /** Each 0-100, normalised against the real spread across all reps. */
  revenueScore: number;
  growthScore: number;
  retentionScore: number;
  /** 0-100: 60% revenue + 25% growth + 15% retention. */
  composite: number;
  tier: TierName;
};

/** What a rep's row of someone ELSE's tier gets reduced to on /api/team/tiers
 *  for a non-admin viewer: name, tier, and whatever the array position
 *  already conveys (rank) — no revenue, growth, or score. Declared here
 *  (not in the route file) so the client page can import it without pulling
 *  the route's server-only imports (db client, auth) into the client bundle. */
export type PublicRepTier = Pick<RepTier, "name" | "tier"> & Partial<Omit<RepTier, "name" | "tier">>;

export const TIER_WEIGHTS = { revenue: 0.6, growth: 0.25, retention: 0.15 };
// Lowered from 70 (2026-10-04, at the user's request) after the real data
// showed nobody within reach: the top score on the actual team is 66, so a
// 70 floor made Lustre Diamond unattainable rather than aspirational. 50 puts
// the top 2 reps in reach today while leaving real room to climb.
export const TIER_THRESHOLDS: Record<TierName, number> = { "Lustre Diamond": 50, Gold: 40, Silver: 0 };

/** Real export data has the same person under slightly different spellings
 *  of their own name (double spaces, trailing spaces) — collapses those to
 *  one canonical row instead of splitting one rep's numbers across two. */
function normalizeOwnerName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

/** Rows that aren't a real salesperson at all. */
function isRealRep(name: string): boolean {
  if (!name || name === "Unassigned") return false;
  if (/^\d+$/.test(name)) return false; // a bare numeric code, not a name
  return true;
}

function tierForScore(score: number): TierName {
  if (score >= TIER_THRESHOLDS["Lustre Diamond"]) return "Lustre Diamond";
  if (score >= TIER_THRESHOLDS.Gold) return "Gold";
  return "Silver";
}

function normalize(value: number, min: number, max: number): number {
  if (max <= min) return value > 0 ? 100 : 0;
  return Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
}

type RawRep = { name: string; customers: number; ytd: number; lastYear: number; growth: number; retention: number };

function rawStats(customers: Customer[]): RawRep[] {
  const byOwner = new Map<string, { name: string; customers: Customer[] }>();
  for (const c of customers) {
    const name = normalizeOwnerName(c.owner);
    if (!isRealRep(name)) continue;
    const bucket = byOwner.get(name) ?? { name, customers: [] };
    bucket.customers.push(c);
    byOwner.set(name, bucket);
  }

  return [...byOwner.values()].map(({ name, customers: cs }) => {
    const ytd = cs.reduce((s, c) => s + c.ytd, 0);
    const lastYear = cs.reduce((s, c) => s + c.lastYear, 0);
    const growth = growthRate(ytd, lastYear);
    const notOverdue = cs.filter((c) => c.daysSince <= c.cycleDays[1]).length;
    const retention = cs.length ? (notOverdue / cs.length) * 100 : 0;
    return { name, customers: cs.length, ytd, lastYear, growth, retention };
  });
}

function scoreStats(raw: RawRep[]): RepTier[] {

  const revenues = raw.map((r) => r.ytd);
  const growths = raw.map((r) => r.growth);
  const retentions = raw.map((r) => r.retention);
  const revMin = Math.min(...revenues), revMax = Math.max(...revenues);
  const growMin = Math.min(...growths), growMax = Math.max(...growths);
  const retMin = Math.min(...retentions), retMax = Math.max(...retentions);

  return raw
    .map((r) => {
      const revenueScore = normalize(r.ytd, revMin, revMax);
      const growthScore = normalize(r.growth, growMin, growMax);
      const retentionScore = normalize(r.retention, retMin, retMax);
      const composite =
        revenueScore * TIER_WEIGHTS.revenue +
        growthScore * TIER_WEIGHTS.growth +
        retentionScore * TIER_WEIGHTS.retention;
      return {
        ...r,
        revenueScore: Math.round(revenueScore),
        growthScore: Math.round(growthScore),
        retentionScore: Math.round(retentionScore),
        composite: Math.round(composite),
        tier: tierForScore(composite),
      };
    })
    .sort((a, b) => b.composite - a.composite);
}

export function computeRepTiers(customers: Customer[]): RepTier[] {
  return scoreStats(rawStats(customers));
}

export type SalesNeeded = {
  /** Extra sales this year that would get the rep there, all else equal. */
  extraSales: number;
  /** The same as a share of what they have sold so far. */
  extraPercent: number;
};

/**
 * How much more a rep must sell to reach a goal, found by re-scoring the whole
 * team with that rep's sales raised until the goal holds. Re-scoring (rather
 * than a formula) is what keeps it honest: more sales also lifts the rep's
 * growth, and the revenue and growth scales are set by the team's spread, so
 * both move together. Everyone else's numbers are held where they are.
 * Returns null if no realistic amount gets there.
 */
export function salesNeeded(
  customers: Customer[],
  repName: string,
  reached: (me: RepTier, team: RepTier[]) => boolean,
): SalesNeeded | null {
  const raw = rawStats(customers);
  const idx = raw.findIndex((r) => r.name.trim().toLowerCase() === repName.trim().toLowerCase());
  if (idx < 0) return null;
  const base = raw[idx];
  const test = (extra: number) => {
    const next = raw.map((r, i) => {
      if (i !== idx) return r;
      const ytd = r.ytd + extra;
      return { ...r, ytd, growth: growthRate(ytd, r.lastYear) };
    });
    const team = scoreStats(next);
    const me = team.find((t) => t.name === base.name)!;
    return reached(me, team);
  };
  const cap = Math.max(base.ytd, ...raw.map((r) => r.ytd), 1) * 5;
  if (test(0)) return { extraSales: 0, extraPercent: 0 };
  if (!test(cap)) return null;
  let lo = 0, hi = cap;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (test(mid)) hi = mid; else lo = mid;
  }
  const extraSales = Math.ceil(hi / 1000) * 1000;
  return { extraSales, extraPercent: base.ytd > 0 ? (extraSales / base.ytd) * 100 : 0 };
}
