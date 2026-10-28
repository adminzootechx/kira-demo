/**
 * Engine 2 — Customer & Buyer Intelligence.
 *
 * Every derived customer metric in the product is computed here, from source
 * fields a transaction export can actually supply. Nothing in this file reads
 * a hand-authored score.
 *
 * The split matters for what comes next: `CustomerSource` is the shape LUSTRE's
 * historical CSV will land in, and `buildCustomerProfiles` is the only thing
 * that turns it into the `Customer` records the UI renders. Swapping fixtures
 * for real data changes the source, never the algorithms.
 */

import { asOf } from "@/lib/data/asOf";
import type { Customer, CustomerClass } from "@/lib/data/types";

/** The fields a sales/invoice export provides. Everything else is computed. */
export type CustomerSource = Omit<
  Customer,
  | "segment" | "health" | "churnRisk" | "rfm" | "ltv" | "riskAdjustedValue"
  | "growth" | "walletShare" | "priceSensitivity"
>;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Months since the account first bought, from the "Mon YYYY" source field. */
function monthsSinceFirstPurchase(firstPurchase: string): number {
  const parsed = Date.parse(`1 ${firstPurchase} UTC`);
  if (Number.isNaN(parsed)) return 999;
  // Fixed reference date — never `Date.now()`, which would break SSR/client parity.
  const reference = Date.parse(`${asOf.date} UTC`);
  if (Number.isNaN(reference)) return 999;
  return Math.max(0, Math.round((reference - parsed) / (1000 * 60 * 60 * 24 * 30.44)));
}


/* ------------------------------------------------------------------ */
/* Growth and wallet share                                             */
/* ------------------------------------------------------------------ */

/** Period-on-period revenue change. */
export function growthRate(ytd: number, lastYear: number): number {
  if (lastYear <= 0) return ytd > 0 ? 100 : 0;
  return ((ytd - lastYear) / lastYear) * 100;
}

/** Share of the account's estimated total buying capacity that LUSTRE holds. */
export function walletShare(ytd: number, estimatedCapacity: number): number {
  if (estimatedCapacity <= 0) return 0;
  return clamp((ytd / estimatedCapacity) * 100, 0, 100);
}

/* ------------------------------------------------------------------ */
/* RFM segmentation                                                    */
/* ------------------------------------------------------------------ */

export type RfmScore = { r: number; f: number; m: number; label: string };

/**
 * Quintile scoring. Customers are ranked on each axis and cut into fifths, so
 * scores stay meaningful whatever the size of the book — 12 rows or 12,000.
 * Rank 0 is the best performer on that axis and scores 5.
 */
function quintileScores<T>(items: T[], value: (t: T) => number, bestIsLowest: boolean): number[] {
  const n = items.length;
  const order = items
    .map((item, i) => ({ i, v: value(item) }))
    .sort((a, b) => (bestIsLowest ? a.v - b.v : b.v - a.v));

  const scores = new Array<number>(n).fill(3);
  order.forEach((entry, rank) => {
    scores[entry.i] = clamp(5 - Math.floor((rank / n) * 5), 1, 5);
  });
  return scores;
}

/**
 * The standard RFM matrix labels. These are the same names the existing
 * segmentation grid uses, so the UI vocabulary does not change.
 */
export function rfmLabel(r: number, f: number): string {
  if (r >= 4 && f >= 4) return "Champions";
  if (r >= 4 && f >= 3) return "Loyal";
  if (r >= 4) return "Promising";
  if (r === 3 && f >= 4) return "Steady";
  if (r === 3) return "Cooling";
  if (r === 2 && f >= 4) return "Cannot lose";
  if (r === 2) return "At risk";
  if (f >= 4) return "Cannot lose";
  if (f >= 2) return "Hibernating";
  return "Lost";
}

/** Scores the whole book at once — quintiles are only meaningful population-wide. */
export function scoreRfm(sources: CustomerSource[]): RfmScore[] {
  const r = quintileScores(sources, (c) => c.daysSince, true);
  const f = quintileScores(sources, (c) => c.transactions, false);
  const m = quintileScores(sources, (c) => c.ytd, false);
  return sources.map((_, i) => ({
    r: r[i],
    f: f[i],
    m: m[i],
    label: rfmLabel(r[i], f[i]),
  }));
}

/* ------------------------------------------------------------------ */
/* Churn risk                                                          */
/* ------------------------------------------------------------------ */

/**
 * Churn probability, 0–99. Four weighted signals:
 *
 *   overdue    45pts  how far past the account's own reorder window it is
 *   decline    30pts  revenue fall against the comparable period
 *   frequency  15pts  RFM frequency quintile
 *   payment    10pts  payment reliability
 *
 * Judging lateness against each account's *own* cycle is the important part —
 * 54 days is alarming for a fortnightly buyer and unremarkable for a quarterly
 * one, and a flat "days since last order" threshold cannot tell them apart.
 */
export function churnRisk(
  source: Pick<CustomerSource, "daysSince" | "cycleDays" | "paymentScore">,
  growth: number,
  frequencyScore: number,
): number {
  const cycleUpper = source.cycleDays[1] || 30;
  const overdue = clamp(source.daysSince / cycleUpper - 1, 0, 1.5) / 1.5;
  const decline = clamp(-growth / 60, 0, 1);
  const infrequency = (5 - frequencyScore) / 4;
  const payment = clamp((100 - source.paymentScore) / 100, 0, 1);

  const score = overdue * 45 + decline * 30 + infrequency * 15 + payment * 10;
  return clamp(Math.round(score), 0, 99);
}

/**
 * The churn score broken into its contributing factors.
 *
 * A number on its own is not actionable — "74% churn risk" tells a sales
 * director nothing about what to do. The breakdown says whether the account is
 * late, shrinking, buying less often or paying badly, which are four different
 * conversations.
 */
export type ChurnDriver = {
  label: string;
  /** Points contributed, out of `max`. */
  points: number;
  max: number;
  detail: string;
};

export function churnDrivers(
  source: Pick<CustomerSource, "daysSince" | "cycleDays" | "paymentScore" | "transactions">,
  growth: number,
  frequencyScore: number,
): ChurnDriver[] {
  const cycleUpper = source.cycleDays[1] || 30;
  const overdue = clamp(source.daysSince / cycleUpper - 1, 0, 1.5) / 1.5;
  const decline = clamp(-growth / 60, 0, 1);
  const infrequency = (5 - frequencyScore) / 4;
  const payment = clamp((100 - source.paymentScore) / 100, 0, 1);

  return [
    {
      label: "Late to reorder",
      points: Math.round(overdue * 45),
      max: 45,
      detail:
        source.daysSince > cycleUpper
          ? `Day ${source.daysSince}, when they normally buy every ${source.cycleDays[0]}–${cycleUpper} days`
          : `Day ${source.daysSince}, still within their usual ${source.cycleDays[0]}–${cycleUpper} days`,
    },
    {
      label: "Spending less",
      points: Math.round(decline * 30),
      max: 30,
      detail:
        growth < 0
          ? `Down ${Math.abs(growth).toFixed(0)}% on the 12 months before`
          : `Up ${growth.toFixed(0)}% on the 12 months before`,
    },
    {
      label: "Orders rarely",
      points: Math.round(infrequency * 15),
      max: 15,
      detail: `About ${source.transactions} orders a year: ${frequencyScore >= 5 ? "more often than most customers" : frequencyScore >= 3 ? "about as often as most" : "less often than most"}`,
    },
    {
      label: "Pays late",
      points: Math.round(payment * 10),
      max: 10,
      detail: "Payment history is not in the sales data yet, so this counts as average",
    },
  ];
}

/**
 * How much evidence sits behind this account's scores.
 *
 * Two accounts can both read "68% churn risk" while one has four years of
 * regular invoices behind it and the other has three orders. Saying so is the
 * difference between a model that can be trusted and one that merely asserts.
 */
export function evidenceStrength(
  source: Pick<CustomerSource, "transactions" | "cycleType" | "firstPurchase" | "lastYear">,
): { score: number; label: string; reasons: string[] } {
  const months = monthsSinceFirstPurchase(source.firstPurchase);
  const reasons: string[] = [];

  const volume = clamp(source.transactions / 12, 0, 1);
  if (source.transactions < 12) reasons.push(`${source.transactions} invoices on record`);

  const history = clamp(months / 24, 0, 1);
  if (months < 12) reasons.push(`${months} months of trading history`);

  const regularity =
    source.cycleType === "Irregular" ? 0.3 : source.cycleType === "Seasonal" ? 0.6 : 1;
  if (regularity < 1) reasons.push(`${source.cycleType.toLowerCase()} buying pattern`);

  const comparable = source.lastYear > 0 ? 1 : 0;
  if (!comparable) reasons.push("no prior-period comparison");

  const score = Math.round(
    (volume * 0.35 + history * 0.25 + regularity * 0.25 + comparable * 0.15) * 100,
  );
  return {
    score,
    label: score >= 75 ? "Strong" : score >= 50 ? "Moderate" : "Limited",
    reasons,
  };
}

/* ------------------------------------------------------------------ */
/* Reorder prediction                                                  */
/* ------------------------------------------------------------------ */

export type ReorderStatus = "Overdue" | "Due now" | "Approaching" | "Not due";

export type ReorderPrediction = {
  status: ReorderStatus;
  /** Days past the end of the expected window. Negative means still inside it. */
  overdueBy: number;
  /** Days until the midpoint of the next expected window. */
  daysToExpected: number;
  window: string;
  /** 0–100. How much the account's own history supports the prediction. */
  confidence: number;
};

/** Irregular buyers earn less confidence however long the history is. */
const cycleConfidence: Record<CustomerSource["cycleType"], number> = {
  "High frequency": 0.9,
  Regular: 0.85,
  Seasonal: 0.6,
  Irregular: 0.45,
};

export function predictReorder(
  source: Pick<CustomerSource, "daysSince" | "cycleDays" | "cycleType" | "transactions">,
): ReorderPrediction {
  const [start, end] = source.cycleDays;
  const mid = (start + end) / 2;
  const d = source.daysSince;

  const status: ReorderStatus =
    d > end ? "Overdue" : d >= start ? "Due now" : d >= start * 0.8 ? "Approaching" : "Not due";

  // Confidence rises with the number of completed cycles actually observed.
  // Twelve is about a year for a monthly buyer, so that is the point at which
  // the pattern is considered well evidenced; an erratic cycle still caps out
  // low however many orders there are.
  const evidence = clamp(source.transactions / 12, 0.35, 1);

  return {
    status,
    overdueBy: d - end,
    daysToExpected: Math.round(mid - d),
    window: `${start}–${end} days`,
    confidence: Math.round(cycleConfidence[source.cycleType] * evidence * 100),
  };
}

/* ------------------------------------------------------------------ */
/* Discount standing                                                   */
/* ------------------------------------------------------------------ */

/**
 * Where an account's average discount sits within the book, 0 (the lightest
 * discount given to anyone) to 100 (the heaviest).
 *
 * A discount only means anything next to the discounts comparable accounts
 * receive, and an absolute threshold cannot survive a change of product. Cut
 * goods trade a few percent off list; LUSTRE's own export is lab-grown and sits
 * at 98-100% off the natural Rapaport list, because that spread is the market,
 * not a concession anyone negotiated. Against fixed cut-offs that book scores
 * every account "High" price sensitivity and clamps every realisation score to
 * zero — two inputs that then carry no signal at all. A rank within the book
 * says the same thing about a cut-goods book and stays readable on this one.
 *
 * Ties share the midpoint of the range they span, so the many accounts sitting
 * on an identical discount all score identically.
 */
export function percentileRanks(values: number[]): number[] {
  const n = values.length;
  if (n === 0) return [];
  if (n === 1) return [50];

  const order = values.map((v, i) => ({ i, v })).sort((a, b) => a.v - b.v);

  const ranks = new Array<number>(n).fill(50);
  for (let i = 0; i < n; ) {
    let j = i;
    while (j + 1 < n && order[j + 1].v === order[i].v) j += 1;
    // Midpoint of the tied block, as a percentage of the whole book.
    const rank = ((i + j) / 2 / (n - 1)) * 100;
    for (let k = i; k <= j; k += 1) ranks[order[k].i] = rank;
    i = j + 1;
  }
  return ranks;
}

export function discountRanks(sources: Pick<CustomerSource, "avgDiscount">[]): number[] {
  return percentileRanks(sources.map((s) => s.avgDiscount));
}

/** The same standing for one account against a book already scored. */
export function discountRankIn(
  book: Pick<CustomerSource, "avgDiscount">[],
  account: Pick<CustomerSource, "avgDiscount">,
): number {
  const index = book.indexOf(account as (typeof book)[number]);
  const ranks = discountRanks(index >= 0 ? book : [...book, account]);
  return ranks[index >= 0 ? index : ranks.length - 1];
}

/* ------------------------------------------------------------------ */
/* Health score                                                        */
/* ------------------------------------------------------------------ */

/**
 * Composite account health, 0–100. Deliberately broader than revenue: an
 * account can be large and still unhealthy if it is slipping, paying late or
 * only holding on through discount.
 */
export function healthScore(
  source: Pick<CustomerSource, "paymentScore">,
  rfm: RfmScore,
  growth: number,
  discountRank: number,
): number {
  const recency = (rfm.r / 5) * 100;
  const frequency = (rfm.f / 5) * 100;
  const monetary = (rfm.m / 5) * 100;
  const trend = clamp(((growth + 50) / 100) * 100, 0, 100);
  const payment = clamp(source.paymentScore, 0, 100);
  // Discounting less than the rest of the book is better realisation.
  const realisation = clamp(100 - discountRank, 0, 100);

  const score =
    recency * 0.2 +
    frequency * 0.15 +
    monetary * 0.15 +
    trend * 0.2 +
    payment * 0.15 +
    realisation * 0.15;

  return clamp(Math.round(score), 0, 100);
}

/** The six axes behind the score, for the radar chart on the detail page. */
export function healthComposition(
  source: Pick<CustomerSource, "paymentScore">,
  rfm: RfmScore,
  growth: number,
  discountRank: number,
) {
  return [
    { axis: "Bought recently", value: Math.round((rfm.r / 5) * 100) },
    { axis: "Buys often", value: Math.round((rfm.f / 5) * 100) },
    { axis: "Spends well", value: Math.round((rfm.m / 5) * 100) },
    { axis: "Growth", value: Math.round(clamp(((growth + 50) / 100) * 100, 0, 100)) },
    { axis: "Pays on time", value: Math.round(clamp(source.paymentScore, 0, 100)) },
    { axis: "Price held", value: Math.round(clamp(100 - discountRank, 0, 100)) },
  ];
}

/* ------------------------------------------------------------------ */
/* Lifetime value                                                      */
/* ------------------------------------------------------------------ */

/**
 * A finite discounted horizon rather than the open-ended contractual formula.
 * The perpetuity form explodes as retention approaches 1 and collapses to
 * near-zero for a struggling account, neither of which describes a diamond
 * trading relationship. Three years at 12% keeps every account inside a
 * defensible multiple of its established annual level.
 */
const CLV_HORIZON_YEARS = 3;
const CLV_DISCOUNT_RATE = 0.12;

/** Annualised run rate from the fiscal-year-to-date figure. */
export function annualRunRate(ytd: number): number {
  return ytd * (asOf.daysInYear / asOf.daysElapsed);
}

/**
 * Discounted expected value over a three-year horizon.
 *
 * The base is the account's *established* annual level — the higher of its
 * current run rate and what it bought last year — because an account that has
 * temporarily collapsed still carries the relationship that produced the
 * larger number. Valuing Horizon Gems on this year's run rate alone would
 * price a historic $2.3M/yr buyer at a few hundred thousand.
 */
export function lifetimeValue(ytd: number, lastYear: number, churn: number): number {
  const baseAnnual = Math.max(annualRunRate(ytd), lastYear);
  const retention = clamp(1 - churn / 100, 0.05, 0.99);
  const r = retention / (1 + CLV_DISCOUNT_RATE);
  const factor =
    r === 1
      ? CLV_HORIZON_YEARS
      : (r * (1 - Math.pow(r, CLV_HORIZON_YEARS))) / (1 - r);
  return Math.round(baseAnnual * factor);
}

/** LTV weighted once more by survival probability. */
export function riskAdjustedValue(ltv: number, churn: number): number {
  return Math.round(ltv * clamp(1 - churn / 100, 0, 1));
}

/* ------------------------------------------------------------------ */
/* Classification                                                      */
/* ------------------------------------------------------------------ */


/**
 * Ordered rules — the first match wins, so "hasn't bought in a year" outranks
 * "looks healthy on paper".
 */
export function classifySegment(
  source: Pick<CustomerSource, "daysSince" | "firstPurchase" | "lastYear" | "ytd" | "cycleDays">,
  health: number,
  growth: number,
  share: number,
  monetaryScore: number,
): CustomerClass {
  const cycleUpper = source.cycleDays[1] || 30;
  if (source.daysSince > Math.max(270, 4 * cycleUpper)) return "Lost";
  if (source.daysSince > Math.max(90, 2 * cycleUpper)) return "Dormant";
  // "Recovered" is deliberately absent. Evidencing it needs the gap *between*
  // orders — an account that lapsed and came back — and that requires
  // order-level history rather than the account-level aggregates available
  // here. Claiming it from a growth rate alone would label accounts that never
  // lapsed at all.
  if (growth < -20) return "Declining";
  if (monthsSinceFirstPurchase(source.firstPurchase) <= 12) return "New";
  if (monetaryScore === 5 && health >= 85) return "VIP";
  if (growth > 20 && health >= 60) return "Growing";
  if (share < 20 && health >= 55) return "High Potential";
  if (health >= 70) return "Healthy";
  return "Stable";
}

/**
 * Price sensitivity from where the account's discount stands in the book — the
 * top third are the accounts actually being bought, the bottom third pay close
 * to the book's best realisation. Bumped a band for the smallest-ticket third,
 * who behave as price takers even when their headline discount looks moderate.
 *
 * Both inputs are ranks within the book for the same reason. A fixed cut-off
 * in dollars does not survive a change of book any better than a fixed cut-off
 * in discount points: against the $20,000 this once used, an account book
 * whose median order is $8,000 has almost every account bumped, and the bump
 * stops separating anything.
 */
export function classifyPriceSensitivity(
  discountRank: number,
  avgTxnRank: number,
): Customer["priceSensitivity"] {
  const bands: Customer["priceSensitivity"][] = ["Low", "Medium", "High"];
  let band = discountRank >= 66.7 ? 2 : discountRank >= 33.3 ? 1 : 0;
  if (avgTxnRank < 33.3) band = Math.min(2, band + 1);
  return bands[band];
}

/* ------------------------------------------------------------------ */
/* Profile assembly                                                    */
/* ------------------------------------------------------------------ */

/**
 * Turns raw source records into full customer profiles. This is the single
 * entry point the data layer calls, and the single place to point at real
 * data later.
 */
export function buildCustomerProfiles(sources: CustomerSource[]): Customer[] {
  const rfmScores = scoreRfm(sources);
  const ranks = discountRanks(sources);
  const txnRanks = percentileRanks(sources.map((c) => c.avgTxn));

  return sources.map((source, i) => {
    const rfm = rfmScores[i];
    const discountRank = ranks[i];
    const growth = growthRate(source.ytd, source.lastYear);
    const share = walletShare(source.ytd, source.estimatedCapacity);
    const churn = churnRisk(source, growth, rfm.f);
    const health = healthScore(source, rfm, growth, discountRank);
    const ltv = lifetimeValue(source.ytd, source.lastYear, churn);

    return {
      ...source,
      growth: Math.round(growth * 10) / 10,
      walletShare: Math.round(share),
      rfm: { r: rfm.r, f: rfm.f, m: rfm.m },
      churnRisk: churn,
      health,
      ltv,
      riskAdjustedValue: riskAdjustedValue(ltv, churn),
      segment: classifySegment(source, health, growth, share, rfm.m),
      priceSensitivity: classifyPriceSensitivity(discountRank, txnRanks[i]),
    };
  });
}
