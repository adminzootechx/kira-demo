import "server-only";

import { sql } from "drizzle-orm";
import { getDb } from "./client";
import { getActiveBook } from "./repository";
import { DISCOUNT_BANDS } from "@/lib/tradeapi/rollupFold";

/**
 * Specification, price, salesperson, location and monthly rollups, read from
 * the `rollups` table that the Excel import fills and every auto-sync tops up.
 *
 * The comparison is like-for-like: the longest window (up to 12 months) that
 * ends at the newest sale and whose mirror twelve months earlier is also fully
 * covered by the data. Both windows are the same length and the same months of
 * the year, so growth is a direct figure and nothing is annualised.
 *
 * Distinct customer counts cannot be summed across periods, so the `customers`
 * figures come from the customer book (accounts that bought in the last twelve
 * months) rather than from the rollups, and are labelled that way on screen.
 */

const DAY = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const num = (v: unknown): number => (v === null || v === undefined ? 0 : Number(v));
const grow = (c: number, p: number) => (p > 0 ? ((c - p) / p) * 100 : c > 0 ? 100 : 0);

type Raw = Record<string, unknown>;

export type Dimensions = NonNullable<Awaited<ReturnType<typeof getDimensions>>>;

export async function getDimensions() {
  const db = getDb();
  const rows = async (q: ReturnType<typeof sql>) => (await db.execute(q)).rows as Raw[];

  const [bounds] = await rows(sql`select min(period) as first, max(period) as last from rollups where dim = 'all'`);
  if (!bounds?.last) return null;
  const asOf = String(bounds.last);
  const earliest = String(bounds.first);

  // The mirror year has to exist, so the current window cannot start before
  // the data's first day plus a year.
  const mirrorStart = iso(Date.parse(earliest) + 365 * DAY);
  const currentFrom = mirrorStart > asOf ? earliest : [iso(Date.parse(asOf) - 364 * DAY), mirrorStart].sort().pop()!;
  const hasPrior = mirrorStart <= asOf;
  const priorFrom = iso(Date.parse(currentFrom) - 365 * DAY);
  const priorTo = iso(Date.parse(asOf) - 365 * DAY);
  const currentDays = Math.round((Date.parse(asOf) - Date.parse(currentFrom)) / DAY) + 1;

  // Month-grain dimensions use whole months covering the same span.
  const curM = [currentFrom.slice(0, 7), asOf.slice(0, 7)] as const;
  const shiftYear = (m: string) => `${Number(m.slice(0, 4)) - 1}${m.slice(4)}`;
  const priM = [shiftYear(curM[0]), shiftYear(curM[1])] as const;

  const cur = sql`period between ${currentFrom} and ${asOf}`;
  const prior = sql`period between ${priorFrom} and ${priorTo}`;
  const curMonth = sql`period between ${curM[0]} and ${curM[1]}`;
  const priMonth = sql`period between ${priM[0]} and ${priM[1]}`;

  const [overview, monthly, countries, locations, specs, owners, brokers, discounts, ageing, shapes, terms, moves] =
    await Promise.all([
      rows(sql`
        select sum(revenue) filter (where ${cur}) as revenue, sum(carats) filter (where ${cur}) as carats,
               sum(stones) filter (where ${cur}) as stones, sum(orders) filter (where ${cur}) as orders,
               sum(revenue) filter (where ${prior}) as prior_revenue,
               sum(disc_sum) filter (where ${cur}) / nullif(sum(disc_n) filter (where ${cur}), 0) as avg_disc
        from rollups where dim = 'all'`),
      rows(sql`
        select substr(period,1,7) as month, sum(revenue) as revenue, sum(carats) as carats,
               sum(stones) as stones, sum(orders) as orders
        from rollups where dim = 'all' group by 1 order by 1`),
      rows(sql`
        select value as name, sum(revenue) filter (where ${cur}) as revenue,
               sum(revenue) filter (where ${prior}) as prior_revenue, sum(carats) filter (where ${cur}) as carats
        from rollups where dim = 'country'
        group by 1 having sum(revenue) filter (where ${cur}) > 0 order by 2 desc limit 20`),
      rows(sql`
        select value as name, sum(revenue) as revenue, sum(carats) as carats, sum(stones) as stones,
               sum(stock_sum) / nullif(sum(stock_n), 0) as avg_days
        from rollups where dim = 'location' and ${cur} group by 1 order by 2 desc`),
      rows(sql`
        select value, sum(revenue) filter (where ${curMonth}) as revenue,
               sum(revenue) filter (where ${priMonth}) as prior_revenue,
               sum(carats) filter (where ${curMonth}) as carats, sum(stones) filter (where ${curMonth}) as stones,
               sum(disc_sum) filter (where ${curMonth}) / nullif(sum(disc_n) filter (where ${curMonth}), 0) as avg_disc,
               sum(stock_sum) filter (where ${curMonth}) / nullif(sum(stock_n) filter (where ${curMonth}), 0) as days_to_sell,
               sum(revenue) / nullif(sum(carats), 0) as usual_rate
        from rollups where dim = 'spec'
        group by 1 having sum(stones) filter (where ${curMonth}) >= 30 order by 2 desc nulls last limit 40`),
      rows(sql`
        select value as name, sum(revenue) filter (where ${cur}) as revenue,
               sum(revenue) filter (where ${prior}) as prior_revenue, sum(carats) filter (where ${cur}) as carats,
               sum(stones) filter (where ${cur}) as stones, sum(orders) filter (where ${cur}) as orders,
               sum(disc_sum) filter (where ${cur}) / nullif(sum(disc_n) filter (where ${cur}), 0) as avg_disc
        from rollups where dim = 'owner'
        group by 1 having sum(revenue) filter (where ${cur}) > 0 order by 2 desc nulls last`),
      rows(sql`
        select value as name, sum(revenue) as revenue, sum(stones) as stones,
               sum(disc_sum) / nullif(sum(disc_n), 0) as avg_disc
        from rollups where dim = 'broker' and ${cur} group by 1 order by 2 desc limit 20`),
      rows(sql`
        select value as band, sum(stones) as stones, sum(revenue) as revenue
        from rollups where dim = 'discband' and ${cur} group by 1`),
      rows(sql`
        select value as band, sum(stones) as stones, sum(carats) as carats, sum(revenue) as revenue
        from rollups where dim = 'ageing' and ${cur} group by 1`),
      rows(sql`
        select split_part(value,'|',1) as shape, split_part(value,'|',2) as carat_band,
               sum(revenue) as revenue, sum(stones) as stones
        from rollups where dim = 'spec' and ${curMonth} group by 1,2`),
      rows(sql`
        select value as name, sum(revenue) as revenue, sum(stones) as stones,
               sum(disc_sum) / nullif(sum(disc_n), 0) as avg_disc
        from rollups where dim = 'terms' and ${curMonth} group by 1 order by 2 desc`),
      // Price movement: revenue per carat over the latest three whole months
      // against the three before, per shape and size band.
      rows(sql`
        with m as (select substr(period,1,7) as mo from rollups where dim = 'all' group by 1 order by 1 desc limit 7),
        ranked as (select mo, row_number() over (order by mo desc) as rn from m)
        select split_part(r.value,'|',1) as shape, split_part(r.value,'|',2) as carat_band,
               sum(r.revenue) filter (where k.rn between 2 and 4) / nullif(sum(r.carats) filter (where k.rn between 2 and 4), 0) as rate,
               sum(r.revenue) filter (where k.rn between 5 and 7) / nullif(sum(r.carats) filter (where k.rn between 5 and 7), 0) as prior_rate,
               sum(r.carats) filter (where k.rn between 2 and 4) as carats
        from rollups r join ranked k on k.mo = r.period
        where r.dim = 'spec' group by 1,2
        having sum(r.carats) filter (where k.rn between 2 and 4) > 200
           and sum(r.carats) filter (where k.rn between 5 and 7) > 200`),
    ]);

  const book = await getActiveBook().catch(() => null);
  const byOwner = new Map<string, { now: number; before: number }>();
  const byCountry = new Map<string, number>();
  let customers = 0, priorCustomers = 0;
  for (const c of book?.customers ?? []) {
    if (c.ytd > 0) { customers += 1; byCountry.set(c.country, (byCountry.get(c.country) ?? 0) + 1); }
    if (c.lastYear > 0) priorCustomers += 1;
    const o = byOwner.get(c.owner) ?? { now: 0, before: 0 };
    if (c.ytd > 0) o.now += 1;
    if (c.lastYear > 0) o.before += 1;
    byOwner.set(c.owner, o);
  }

  const o = overview[0] ?? {};
  const revenue = num(o.revenue), carats = num(o.carats), stones = num(o.stones), ordersN = num(o.orders);
  const priorRevenue = hasPrior ? num(o.prior_revenue) : 0;

  return {
    period: { currentFrom, currentTo: asOf, priorFrom, priorTo, currentDays, priorDays: currentDays, hasPrior },
    overview: {
      revenue, priorRevenue, growth: hasPrior ? grow(revenue, priorRevenue) : 0, carats, stones,
      customers, priorCustomers, orders: ordersN,
      realisedRate: carats > 0 ? revenue / carats : 0,
      avgOrderValue: ordersN > 0 ? revenue / ordersN : 0,
      avgStoneValue: stones > 0 ? revenue / stones : 0,
      avgDiscount: num(o.avg_disc),
    },
    monthly: monthly.map((m) => ({
      month: String(m.month), revenue: num(m.revenue), carats: num(m.carats),
      stones: num(m.stones), orders: num(m.orders),
    })),
    countries: countries.map((c) => ({
      name: String(c.name), revenue: num(c.revenue), customers: byCountry.get(String(c.name)) ?? 0,
      carats: num(c.carats), growth: hasPrior ? grow(num(c.revenue), num(c.prior_revenue)) : 0,
      share: revenue > 0 ? (num(c.revenue) / revenue) * 100 : 0,
    })),
    locations: locations.map((l) => ({
      name: String(l.name), revenue: num(l.revenue), carats: num(l.carats), stones: num(l.stones),
      avgDaysInStock: Math.round(num(l.avg_days)),
    })),
    specs: specs.map((s) => {
      const [shape, carat, colour, clarity] = String(s.value).split("|");
      return {
        spec: `${shape} / ${carat} / ${colour} / ${clarity}`, shape, carat, colour, clarity,
        revenue: num(s.revenue), carats: num(s.carats), stones: num(s.stones),
        rate: num(s.carats) > 0 ? num(s.revenue) / num(s.carats) : 0,
        usualRate: num(s.usual_rate),
        avgDiscount: num(s.avg_disc), daysToSell: Math.round(num(s.days_to_sell)),
        growth: hasPrior ? grow(num(s.revenue), num(s.prior_revenue)) : 0,
      };
    }),
    owners: owners.map((w) => {
      const c = byOwner.get(String(w.name)) ?? { now: 0, before: 0 };
      return {
        name: String(w.name), revenue: num(w.revenue), carats: num(w.carats), stones: num(w.stones),
        customers: c.now, priorCustomers: c.before, orders: num(w.orders), avgDiscount: num(w.avg_disc),
        growth: hasPrior ? grow(num(w.revenue), num(w.prior_revenue)) : 0,
        retention: c.before > 0 ? Math.min(100, (c.now / c.before) * 100) : 0,
        avgOrderValue: num(w.orders) > 0 ? num(w.revenue) / num(w.orders) : 0,
      };
    }),
    brokers: brokers.map((b) => ({
      name: String(b.name), revenue: num(b.revenue), stones: num(b.stones), avgDiscount: num(b.avg_disc),
    })),
    discountBands: DISCOUNT_BANDS.map((b) => {
      const hit = discounts.find((d) => d.band === b.label);
      return { band: b.label, stones: num(hit?.stones), revenue: num(hit?.revenue) };
    }),
    ageing: ["0-30", "31-90", "91-180", "181-365", "365+"].map((band) => {
      const hit = ageing.find((a) => a.band === band);
      return { band, stones: num(hit?.stones), carats: num(hit?.carats), revenue: num(hit?.revenue) };
    }),
    shapeDemand: shapes.map((s) => ({
      shape: String(s.shape), carat: String(s.carat_band), revenue: num(s.revenue), stones: num(s.stones),
    })),
    terms: terms.map((t) => ({
      name: String(t.name), revenue: num(t.revenue), stones: num(t.stones), avgDiscount: num(t.avg_disc),
    })),
    priceMoves: moves.map((m) => ({
      shape: String(m.shape), carat: String(m.carat_band), rate: num(m.rate), priorRate: num(m.prior_rate),
      change: grow(num(m.rate), num(m.prior_rate)), carats: num(m.carats),
    })),
  };
}
