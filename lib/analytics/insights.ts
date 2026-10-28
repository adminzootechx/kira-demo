/**
 * Plain-language analytics over the real sales rollups and customer book:
 * a year-ahead forecast, seasonal pace for targets, the revenue bridge, the
 * "what to know today" briefing and the levers that could close a target gap.
 * Every figure is computed from data; nothing here is stored or assumed
 * beyond the constants named below.
 */

export type Month = { month: string; revenue: number; carats: number; stones: number; orders: number };

const daysInMonth = (ym: string) => new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0)).getUTCDate();
const shiftYear = (ym: string, by: number) => `${Number(ym.slice(0, 4)) + by}${ym.slice(4)}`;
const nextMonth = (ym: string) => {
  const y = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7));
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
};

/** The newest month is partial until the data reaches its last day. */
export function completeMonths(monthly: Month[], asOf: string): Month[] {
  const last = monthly[monthly.length - 1];
  if (!last) return monthly;
  const isPartial = last.month === asOf.slice(0, 7) && Number(asOf.slice(8, 10)) < daysInMonth(last.month);
  return isPartial ? monthly.slice(0, -1) : monthly;
}

/** Weight on the recent growth rate carried into the future; the rest fades to flat. */
const GROWTH_CARRY = 0.7;

export type ForecastMonth = { month: string; revenue: number; low: number; high: number };

/**
 * Seasonal-naive forecast with a year-on-year drift. Each future month starts
 * from the same month a year earlier and is scaled by how the latest three
 * complete months compare with a year before, pulled part-way back toward flat
 * (GROWTH_CARRY) because growth rarely holds. The band is one standard
 * deviation of the recent monthly year-on-year ratios. Needs 15 complete
 * months; returns null otherwise rather than inventing a shape.
 */
export function forecast(monthly: Month[], asOf: string, horizon = 6): ForecastMonth[] | null {
  const done = completeMonths(monthly, asOf);
  if (done.length < 15) return null;
  const rev = new Map(done.map((m) => [m.month, m.revenue]));
  const last = done[done.length - 1].month;

  const ratios: number[] = [];
  let m = last;
  for (let i = 0; i < 6; i++) {
    const prev = rev.get(shiftYear(m, -1));
    if (prev && prev > 0) ratios.push((rev.get(m) ?? 0) / prev);
    m = prevMonth(m);
  }
  if (ratios.length < 3) return null;

  const recent = ratios.slice(0, 3);
  const r = 1 + GROWTH_CARRY * (recent.reduce((a, b) => a + b, 0) / recent.length - 1);
  const mean = ratios.reduce((a, b) => a + b, 0) / ratios.length;
  const sd = Math.sqrt(ratios.reduce((a, b) => a + (b - mean) ** 2, 0) / ratios.length);

  const out: ForecastMonth[] = [];
  let f = last;
  for (let i = 0; i < horizon; i++) {
    f = nextMonth(f);
    const base = rev.get(shiftYear(f, -1));
    if (!base) continue;
    out.push({ month: f, revenue: base * r, low: Math.max(0, base * (r - sd)), high: base * (r + sd) });
  }
  return out;
}

function prevMonth(ym: string) {
  const y = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7));
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

/**
 * How much of a year's sales normally lands by `asOf`, from last year's
 * shape. A diamond book is seasonal, so 5 months in is not 5/12 of the way;
 * measuring a target against this is fairer than a straight line. Returns
 * null without a full prior year, and the caller falls back to a straight line.
 */
export function seasonalShare(monthly: Month[], asOf: string): number | null {
  const year = Number(asOf.slice(0, 4)) - 1;
  const months = monthly.filter((m) => m.month.startsWith(`${year}-`));
  if (months.length < 12) return null;
  const total = months.reduce((a, m) => a + m.revenue, 0);
  if (total <= 0) return null;
  const asOfMonth = asOf.slice(5, 7);
  let done = 0;
  for (const m of months) {
    if (m.month.slice(5, 7) < asOfMonth) done += m.revenue;
    else if (m.month.slice(5, 7) === asOfMonth) done += m.revenue * (Number(asOf.slice(8, 10)) / daysInMonth(m.month));
  }
  return done / total;
}

/* ------------------------------------------------------------------ */
/* Revenue bridge                                                      */
/* ------------------------------------------------------------------ */

type Acct = { ytd: number; lastYear: number };

export type BridgeStep = { label: string; value: number; note: string };

/** Splits the change in sales between two periods into what each kind of account contributed. */
export function revenueBridge(customers: Acct[]) {
  let prior = 0, now = 0, added = 0, lost = 0, grew = 0, shrank = 0;
  let nAdded = 0, nLost = 0, nGrew = 0, nShrank = 0;
  for (const c of customers) {
    prior += c.lastYear;
    now += c.ytd;
    if (c.lastYear === 0 && c.ytd > 0) { added += c.ytd; nAdded += 1; }
    else if (c.ytd === 0 && c.lastYear > 0) { lost -= c.lastYear; nLost += 1; }
    else if (c.ytd > c.lastYear) { grew += c.ytd - c.lastYear; nGrew += 1; }
    else if (c.ytd < c.lastYear) { shrank += c.ytd - c.lastYear; nShrank += 1; }
  }
  const steps: BridgeStep[] = [
    { label: "New customers", value: added, note: `${nAdded} accounts that did not buy before` },
    { label: "Customers who bought more", value: grew, note: `${nGrew} accounts` },
    { label: "Customers who bought less", value: shrank, note: `${nShrank} accounts` },
    { label: "Customers who stopped", value: lost, note: `${nLost} accounts with no sales this period` },
  ];
  return { prior, now, steps };
}

/* ------------------------------------------------------------------ */
/* Briefing                                                            */
/* ------------------------------------------------------------------ */

const money = (n: number) =>
  Math.abs(n) >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : Math.abs(n) >= 1e3 ? `$${(n / 1e3).toFixed(0)}K` : `$${Math.round(n)}`;

export type BriefingInput = {
  overview: { revenue: number; priorRevenue: number; growth: number; avgDiscount: number };
  hasPrior: boolean;
  /** The window the sales figure covers, e.g. "1 Apr to 2 Oct". */
  periodLabel?: string;
  countries: { name: string; revenue: number; growth: number; share: number }[];
  specs: { spec: string; growth: number; revenue: number }[];
  customers: { name: string; ytd: number; churnRisk: number }[];
  overdueReorders: { count: number; value: number };
};

/** A handful of sentences, each backed by a figure computed from the data. */
export function briefing(i: BriefingInput): string[] {
  const out: string[] = [];
  const o = i.overview;
  const lead = i.periodLabel ? `From ${i.periodLabel},` : "So far,";
  if (i.hasPrior) {
    out.push(
      o.growth >= 0
        ? `${lead} sales were ${money(o.revenue)}, up ${o.growth.toFixed(0)}% on the same dates last year (${money(o.priorRevenue)}).`
        : `${lead} sales were ${money(o.revenue)}, down ${Math.abs(o.growth).toFixed(0)}% on the same dates last year (${money(o.priorRevenue)}).`,
    );
  } else out.push(`Sales are ${money(o.revenue)} so far. There is not yet a full year of history to compare with.`);

  const top = i.countries[0];
  if (top) out.push(`${top.name} is the biggest market at ${top.share.toFixed(0)}% of sales${i.hasPrior ? `, ${top.growth >= 0 ? "up" : "down"} ${Math.abs(top.growth).toFixed(0)}%` : ""}.`);

  const falling = [...i.countries].filter((c) => c.revenue > o.revenue * 0.02).sort((a, b) => a.growth - b.growth)[0];
  if (i.hasPrior && falling && falling.growth < -10) out.push(`${falling.name} is the weakest large market, down ${Math.abs(falling.growth).toFixed(0)}%.`);

  const total = i.customers.reduce((a, c) => a + c.ytd, 0);
  if (total > 0) {
    const top5 = [...i.customers].sort((a, b) => b.ytd - a.ytd).slice(0, 5);
    const share = top5.reduce((a, c) => a + c.ytd, 0) / total;
    out.push(`Your five biggest customers account for ${(share * 100).toFixed(0)}% of sales, led by ${top5[0].name}.`);
  }

  if (i.overdueReorders.count > 0) {
    out.push(`${i.overdueReorders.count} customers are past their usual reorder time; they typically order about ${money(i.overdueReorders.value)} between them.`);
  }

  const rising = [...i.specs].sort((a, b) => b.growth - a.growth)[0];
  if (i.hasPrior && rising && rising.growth > 20) out.push(`Fastest-growing stone type: ${rising.spec}, up ${rising.growth.toFixed(0)}%.`);

  if (o.avgDiscount > 0) out.push(`The average discount is ${o.avgDiscount.toFixed(1)}% off the natural Rapaport list, which is how lab-grown stones trade.`);
  return out;
}

/* ------------------------------------------------------------------ */
/* Closing a target gap                                                */
/* ------------------------------------------------------------------ */

export type Lever = { label: string; expected: number; detail: string };

type Account = { name: string; ytd: number; lastYear: number; avgTxn: number; churnRisk: number };

/** What-if lift in order size applied to the sales still to come. */
const ORDER_SIZE_LIFT = 0.05;

/**
 * Where the missing sales could come from. Each lever is an expected value:
 * the amount at stake times the chance the account keeps buying
 * (1 - churn risk), so the numbers are deliberately cautious.
 */
export function closeTheGap(
  accounts: Account[],
  overdueIds: Set<string>,
  nameOf: (a: Account) => string,
  remainingFraction: number,
  projectedRemaining: number,
): Lever[] {
  const overdue = accounts.filter((a) => overdueIds.has(nameOf(a)));
  const overdueValue = overdue.reduce((s, a) => s + a.avgTxn * (1 - a.churnRisk / 100), 0);
  const drifting = accounts.filter((a) => a.churnRisk >= 50 && a.lastYear > 0);
  const driftValue = drifting.reduce((s, a) => s + a.lastYear * remainingFraction * (1 - a.churnRisk / 100), 0);
  return [
    {
      label: "Get overdue customers to reorder",
      expected: overdueValue,
      detail: `${overdue.length} customers past their usual reorder time, at their typical order size.`,
    },
    {
      label: "Keep drifting customers buying",
      expected: driftValue,
      detail: `${drifting.length} high-risk customers, at last year's pace for the rest of the year.`,
    },
    {
      label: `Lift order size by ${ORDER_SIZE_LIFT * 100}% (what if)`,
      expected: projectedRemaining * ORDER_SIZE_LIFT,
      detail: "Applied to the sales expected for the rest of the year.",
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Pricing                                                             */
/* ------------------------------------------------------------------ */

/**
 * A salesperson's pricing, where `discount` is the average percent off the
 * natural Rapaport list (higher means a lower price) and `sales` is what they
 * actually invoiced.
 */
type Seller = { name: string; stones: number; discount: number; sales: number };

/** Below this many stones a seller's average is too noisy to compare. */
const MIN_STONES = 200;
/** Standard deviations from the team average that count as unusual. */
const ODD_Z = 1.5;

/** Salespeople whose average discount is unusually far from the team's. Positive z = deeper discounts. */
export function oddSellers(sellers: Seller[]) {
  const pool = sellers.filter((s) => s.stones >= MIN_STONES && s.discount > 0 && s.discount < 100);
  if (pool.length < 4) return [];
  const w = pool.reduce((a, s) => a + s.stones, 0);
  const mean = pool.reduce((a, s) => a + s.discount * s.stones, 0) / w;
  const sd = Math.sqrt(pool.reduce((a, s) => a + s.stones * (s.discount - mean) ** 2, 0) / w);
  if (sd === 0) return [];
  return pool
    .map((s) => ({ ...s, z: (s.discount - mean) / sd, teamAverage: mean }))
    .filter((s) => Math.abs(s.z) >= ODD_Z)
    .sort((a, b) => b.z - a.z);
}

/**
 * What deeper-than-average discounts cost, against the team's own average.
 * With discount d off list L, sales = L × (1 − d/100), so list value is
 * sales / (1 − d/100); at the team average the same stones would have brought
 * L × (1 − avg/100). The gap is L × (d − avg)/100. It compares people with
 * each other, not with an outside price.
 */
export function moneyLeftBehind(sellers: Seller[]) {
  const pool = sellers.filter((s) => s.stones >= MIN_STONES && s.discount > 0 && s.discount < 100);
  const list = (s: Seller) => s.sales / (1 - s.discount / 100);
  const w = pool.reduce((a, s) => a + list(s), 0);
  if (w <= 0) return { total: 0, rows: [] as { name: string; amount: number; discount: number }[], teamAverage: 0 };
  const avg = pool.reduce((a, s) => a + s.discount * list(s), 0) / w;
  const rows = pool
    .map((s) => ({ name: s.name, discount: s.discount, amount: (list(s) * Math.max(0, s.discount - avg)) / 100 }))
    .filter((r) => r.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  return { total: rows.reduce((a, r) => a + r.amount, 0), rows, teamAverage: avg };
}

/** Same stone types the market is demanding, against how fast each sells, for choosing what to stock. */
export function idealMix(specs: { spec: string; revenue: number; daysToSell: number; growth: number }[]) {
  const total = specs.reduce((a, s) => a + s.revenue, 0);
  if (total <= 0) return [];
  // Demand weight: sales share, scaled up for fast sellers and for growth.
  // A stone that sells in half the usual time counts for more shelf space.
  const days = specs.filter((s) => s.daysToSell > 0).map((s) => s.daysToSell);
  const typical = days.length ? days.sort((a, b) => a - b)[Math.floor(days.length / 2)] : 0;
  const scored = specs.map((s) => {
    const speed = typical > 0 && s.daysToSell > 0 ? Math.min(2, Math.max(0.5, typical / s.daysToSell)) : 1;
    const trend = Math.min(1.3, Math.max(0.7, 1 + s.growth / 200));
    return { ...s, share: (s.revenue / total) * 100, weight: (s.revenue / total) * speed * trend };
  });
  const wsum = scored.reduce((a, s) => a + s.weight, 0);
  return scored.map((s) => ({ ...s, suggested: (s.weight / wsum) * 100 })).sort((a, b) => b.suggested - a.suggested);
}
