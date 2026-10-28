/**
 * Generates the demo dataset in data/: fictional customers, salespeople and
 * brokers with synthetic sales from Aug 2024 to the as-of date in
 * lib/data/asOf.ts (22 Aug 2026).
 *
 * All three come from the same simulated sale lines, so the customer book, the
 * rollups and the order history agree with each other:
 *   - demo-customers.csv   — the customer grain, read by lib/data/snapshot.ts
 *   - demo-dimensions.json — the getDimensions() shape (lib/db/dimensions.ts),
 *                            computed here the way its SQL would
 *   - demo-orders.json     — each customer's order history, with stone lines
 *
 * Seeded, so re-running gives identical output. Run: node scripts/generate-demo-data.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

let seed = 20260822;
const rand = () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const weighted = (pairs) => {
  const total = pairs.reduce((s, [, w]) => s + w, 0);
  let r = rand() * total;
  for (const [v, w] of pairs) if ((r -= w) <= 0) return v;
  return pairs[pairs.length - 1][0];
};
const between = (a, b) => a + rand() * (b - a);
const round2 = (n) => Math.round(n * 100) / 100;

const DAY = 86_400_000;
const START = Date.UTC(2024, 7, 1);
const AS_OF = Date.UTC(2026, 7, 22);
const iso = (ms) => new Date(ms).toISOString().slice(0, 10);

/* ---------------------------------------------------------------- */
/* Cast — every name here is invented                               */
/* ---------------------------------------------------------------- */

const REPS = [
  "Priya Mehta", "Rohan Kapoor", "Ananya Iyer", "Vikram Desai", "Neha Joshi", "Karan Bhatia",
  "Isha Reddy", "Aditya Nair", "Meera Pillai", "Sameer Kulkarni", "Tara Menon", "Dev Arora",
];
const BROKERS = ["Brightline Brokers", "Facet Partners", "Northstar Agency", "Prism Trade Links", "Atlas Gem Agents", "Clearview Intermediaries"];
const PREFIX = [
  "Aurora", "Bluestone", "Crestline", "Silverleaf", "Northgate", "Evermore", "Starling", "Halcyon", "Brightwater", "Cobalt",
  "Meridian", "Opaline", "Radiant", "Solstice", "Westbrook", "Ironwood", "Lumina", "Oakridge", "Pinnacle", "Quartzline",
  "Rosewood", "Sapphire Bay", "Tidewell", "Vantage", "Willowmere", "Zenith", "Amberly", "Bellcourt", "Celestine", "Driftwood",
  "Emberly", "Foxglove", "Glenhaven", "Harbourline", "Ivory Coast", "Juniper", "Kingsbury", "Larkspur", "Moonstone", "Nobleton",
];
const MIDDLE = ["Diamonds", "Jewels", "Gems", "Jewellery", "Fine Jewelry", "Diamond Traders", "Gem House", "Brilliants", "Stones", "Creations"];
const SUFFIX = {
  "United States": ["LLC", "Inc", "Co"], India: ["Pvt Ltd", "LLP"], "Hong Kong": ["Ltd", "Co Ltd"], Belgium: ["BVBA", "NV"],
  "United Arab Emirates": ["FZE", "LLC"], Israel: ["Ltd"], "United Kingdom": ["Ltd"], Canada: ["Inc"], Australia: ["Pty Ltd"],
  Thailand: ["Co Ltd"], China: ["Co Ltd"], Japan: ["KK"],
};
const COUNTRIES = [
  ["United States", 34], ["India", 26], ["Hong Kong", 9], ["Belgium", 6], ["United Arab Emirates", 6], ["Israel", 4],
  ["United Kingdom", 4], ["Canada", 4], ["Australia", 3], ["Thailand", 2], ["China", 1], ["Japan", 1],
];
const LOCATIONS = [["Mumbai", 45], ["New York", 25], ["Hong Kong", 12], ["Antwerp", 10], ["Dubai", 8]];
const TERMS = [["Advance", 30], ["5 days", 22], ["Cash On Delivery", 20], ["7 days", 18], ["30 days", 5], ["60 days", 3], ["90 days", 2]];
const SHAPES = [["RB", 30], ["OV", 16], ["EM", 10], ["PE", 9], ["RAD", 9], ["MQ", 8], ["CU", 6], ["HT", 5], ["PR", 4], ["ASH", 3]];
const BANDS = [
  ["0.50-0.99", 6, 0.5, 0.99, 70], ["1.00-1.49", 22, 1.0, 1.49, 60], ["1.50-1.99", 10, 1.5, 1.99, 62],
  ["2.00-2.99", 26, 2.0, 2.99, 58], ["3.00-4.99", 28, 3.0, 4.99, 54], ["5.00+", 8, 5.0, 7.5, 50],
]; // [label, weight, min ct, max ct, base $/ct]
const COLOURS = [["E", 40], ["F", 22], ["D", 18], ["G", 12], ["H", 8]];
const CLARITIES = [["VS1", 42], ["VVS2", 34], ["VS2", 12], ["VVS1", 8], ["SI1", 4]];
const LABS = [["IGI", 92], ["GIA", 4], ["GSI", 2], ["NON", 2]];
const SHAPE_PREMIUM = { RB: 1.15, OV: 1.05, EM: 1.0, PE: 0.98, RAD: 0.97, MQ: 0.95, CU: 0.96, HT: 0.94, PR: 0.92, ASH: 0.93 };

/* ---------------------------------------------------------------- */
/* Customers and their sales                                        */
/* ---------------------------------------------------------------- */

const names = new Set();
const customers = [];
for (let i = 0; customers.length < 640; i += 1) {
  const country = weighted(COUNTRIES);
  const name = `${pick(PREFIX)} ${pick(MIDDLE)} ${pick(SUFFIX[country])}`;
  if (names.has(name)) continue;
  names.add(name);
  // A few big accounts, a long tail of small ones.
  const size = Math.exp(between(-1.2, 2.6)) * 9000;
  customers.push({
    name, country, size,
    owner: pick(REPS),
    broker: rand() < 0.22 ? pick(BROKERS) : "",
    terms: weighted(TERMS),
    favShape: weighted(SHAPES), favBand: weighted(BANDS.map((b) => [b, b[1]])),
    favColour: weighted(COLOURS), favClarity: weighted(CLARITIES),
    // Start anywhere in the window; ~18% go quiet before the as-of date.
    // Most accounts predate the window; the rest are won during it.
    start: rand() < 0.75 ? START + Math.floor(rand() * 20) * DAY : START + Math.floor(rand() * (AS_OF - START - 30 * DAY)),
    end: rand() < 0.18 ? AS_OF - Math.floor(between(60, 300)) * DAY : AS_OF,
    every: Math.max(4, Math.round(between(6, 70))), // mean days between orders
  });
}

const lines = [];
let orderSeq = 0;
for (const c of customers) {
  // Seasonality and gentle growth, applied to order value.
  for (let t = c.start; t <= c.end; t += Math.max(1, Math.round(c.every * between(0.5, 1.5))) * DAY) {
    const orderId = `SO-${(orderSeq += 1)}`;
    const month = new Date(t).getUTCMonth();
    const lift = (1 + 0.18 * Math.sin(((month - 2) / 12) * 2 * Math.PI)) * (1 + 0.25 * ((t - START) / (AS_OF - START)));
    const parts = 1 + Math.floor(rand() * 3);
    for (let p = 0; p < parts; p += 1) {
      const band = rand() < 0.65 ? c.favBand : weighted(BANDS.map((b) => [b, b[1]]));
      const shape = rand() < 0.6 ? c.favShape : weighted(SHAPES);
      const stones = Math.max(1, Math.round((c.size / 9000) * between(2, 14) * lift / parts));
      const carats = round2(stones * between(band[2], band[3]));
      const rate = band[4] * SHAPE_PREMIUM[shape] * between(0.85, 1.18) * (1 - 0.06 * ((t - START) / (AS_OF - START)));
      lines.push({
        date: iso(t), ms: t, orderId, customer: c,
        location: weighted(LOCATIONS), shape, band: band[0],
        colour: rand() < 0.7 ? c.favColour : weighted(COLOURS),
        clarity: rand() < 0.7 ? c.favClarity : weighted(CLARITIES),
        lab: weighted(LABS),
        stones, carats, revenue: round2(carats * rate),
        discount: round2(Math.min(99.95, between(97.2, 99.6) + (rand() < 0.04 ? -2 : 0))),
        days: Math.round(Math.pow(rand(), 1.6) * 420),
      });
    }
  }
}

/* ---------------------------------------------------------------- */
/* Customer grain                                                   */
/* ---------------------------------------------------------------- */

// "Revenue" is the last twelve months, "Last Year" the twelve before — the windows getDimensions() compares.
const YTD_FROM = AS_OF - 364 * DAY;
const LY_FROM = AS_OF - 729 * DAY, LY_TO = AS_OF - 365 * DAY;
const dominant = (rows, key) => {
  const m = new Map();
  for (const r of rows) m.set(r[key], (m.get(r[key]) ?? 0) + r.revenue);
  return [...m].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
};
const csvCell = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));

const byCustomer = new Map();
for (const l of lines) (byCustomer.get(l.customer) ?? byCustomer.set(l.customer, []).get(l.customer)).push(l);

const book = [];
for (const [c, rows] of byCustomer) {
  const ytdRows = rows.filter((r) => r.ms >= YTD_FROM);
  const lyRows = rows.filter((r) => r.ms >= LY_FROM && r.ms <= LY_TO);
  const yearRows = rows.filter((r) => r.ms > AS_OF - 365 * DAY);
  const yearOrders = new Set(yearRows.map((r) => r.orderId)).size;
  const sum = (rs, k) => rs.reduce((s, r) => s + r[k], 0);
  const ytd = round2(sum(ytdRows, "revenue"));
  book.push({
    c, ytd, lastYear: round2(sum(lyRows, "revenue")),
    row: [
      c.name, ytd, round2(sum(lyRows, "revenue")), c.country, c.owner, c.broker,
      rows[0].date, rows[rows.length - 1].date, yearOrders,
      yearOrders ? round2(sum(yearRows, "revenue") / yearOrders) : 0,
      round2(sum(ytdRows, "carats")), sum(ytdRows, "stones"),
      round2(sum(rows, "discount") / rows.length), c.terms,
      dominant(rows, "shape"), dominant(rows, "band"), dominant(rows, "colour"), dominant(rows, "clarity"), dominant(rows, "lab"),
    ],
  });
}
book.sort((a, b) => b.ytd - a.ytd);

const header = "Customer Name,Revenue,Last Year,Country,Account Manager,Broker,First Purchase,Last Purchase,Invoices,Average Order Value,Carats,Stones,Average Discount,Payment Terms,Shape,Carat Band,Colour,Clarity,Lab";
const csv = [header, ...book.map((b) => b.row.map(csvCell).join(","))].join("\n") + "\n";

/* ---------------------------------------------------------------- */
/* Rollups — mirrors getDimensions() in lib/db/dimensions.ts         */
/* ---------------------------------------------------------------- */

const grow = (c, p) => (p > 0 ? ((c - p) / p) * 100 : c > 0 ? 100 : 0);
const asOf = iso(AS_OF), earliest = lines.reduce((m, l) => (l.date < m ? l.date : m), asOf);
const mirrorStart = iso(Date.parse(earliest) + 365 * DAY);
const currentFrom = mirrorStart > asOf ? earliest : [iso(Date.parse(asOf) - 364 * DAY), mirrorStart].sort().pop();
const hasPrior = mirrorStart <= asOf;
const priorFrom = iso(Date.parse(currentFrom) - 365 * DAY);
const priorTo = iso(Date.parse(asOf) - 365 * DAY);
const currentDays = Math.round((Date.parse(asOf) - Date.parse(currentFrom)) / DAY) + 1;
const curM = [currentFrom.slice(0, 7), asOf.slice(0, 7)];
const shiftYear = (m) => `${Number(m.slice(0, 4)) - 1}${m.slice(4)}`;
const priM = [shiftYear(curM[0]), shiftYear(curM[1])];

const inCur = (l) => l.date >= currentFrom && l.date <= asOf;
const inPrior = (l) => l.date >= priorFrom && l.date <= priorTo;
const inCurM = (l) => l.date.slice(0, 7) >= curM[0] && l.date.slice(0, 7) <= curM[1];
const inPriM = (l) => l.date.slice(0, 7) >= priM[0] && l.date.slice(0, 7) <= priM[1];

/** Additive sums for a set of lines; discount and stock age are stone-weighted means. */
const agg = (rows) => {
  const a = { revenue: 0, carats: 0, stones: 0, orders: new Set(), disc: 0, days: 0 };
  for (const r of rows) {
    a.revenue += r.revenue; a.carats += r.carats; a.stones += r.stones; a.orders.add(r.orderId);
    a.disc += r.discount * r.stones; a.days += r.days * r.stones;
  }
  return {
    revenue: round2(a.revenue), carats: round2(a.carats), stones: a.stones, orders: a.orders.size,
    avgDisc: a.stones ? a.disc / a.stones : 0, avgDays: a.stones ? a.days / a.stones : 0,
  };
};
const groupBy = (rows, key) => {
  const m = new Map();
  for (const r of rows) {
    const k = typeof key === "function" ? key(r) : r[key];
    if (k) (m.get(k) ?? m.set(k, []).get(k)).push(r);
  }
  return m;
};

const cur = lines.filter(inCur), prior = lines.filter(inPrior);
const curMonth = lines.filter(inCurM), priMonth = lines.filter(inPriM);
const o = agg(cur);
const priorRevenue = hasPrior ? agg(prior).revenue : 0;

// Customer counts come from the book, exactly as getDimensions() does.
let custNow = 0, custBefore = 0;
const countryCust = new Map(), ownerCust = new Map();
for (const b of book) {
  if (b.ytd > 0) { custNow += 1; countryCust.set(b.c.country, (countryCust.get(b.c.country) ?? 0) + 1); }
  if (b.lastYear > 0) custBefore += 1;
  const w = ownerCust.get(b.c.owner) ?? { now: 0, before: 0 };
  if (b.ytd > 0) w.now += 1;
  if (b.lastYear > 0) w.before += 1;
  ownerCust.set(b.c.owner, w);
}

const specKey = (l) => `${l.shape}|${l.band}|${l.colour}|${l.clarity}`;
const DISCOUNT_BANDS = [
  ["Under 97%", 97], ["97 to 98.5%", 98.5], ["98.5 to 99%", 99], ["99 to 99.5%", 99.5],
  ["99.5 to 99.9%", 99.9], ["99.9 to 100%", 100.0001], ["Over 100% (data error)", Infinity],
];
const discBand = (d) => DISCOUNT_BANDS.find(([, max]) => d < max)[0];
const ageBand = (d) => (d <= 30 ? "0-30" : d <= 90 ? "31-90" : d <= 180 ? "91-180" : d <= 365 ? "181-365" : "365+");

const allMonths = [...new Set(lines.map((l) => l.date.slice(0, 7)))].sort().reverse();
const rn = new Map(allMonths.slice(0, 7).map((m, i) => [m, i + 1]));

const dimensions = {
  period: { currentFrom, currentTo: asOf, priorFrom, priorTo, currentDays, priorDays: currentDays, hasPrior },
  overview: {
    revenue: o.revenue, priorRevenue, growth: hasPrior ? grow(o.revenue, priorRevenue) : 0,
    carats: o.carats, stones: o.stones, customers: custNow, priorCustomers: custBefore, orders: o.orders,
    realisedRate: o.carats > 0 ? o.revenue / o.carats : 0,
    avgOrderValue: o.orders > 0 ? o.revenue / o.orders : 0,
    avgStoneValue: o.stones > 0 ? o.revenue / o.stones : 0,
    avgDiscount: o.avgDisc,
  },
  monthly: [...groupBy(lines, (l) => l.date.slice(0, 7))].sort(([a], [b]) => a.localeCompare(b)).map(([month, rows]) => {
    const a = agg(rows);
    return { month, revenue: a.revenue, carats: a.carats, stones: a.stones, orders: a.orders };
  }),
  countries: [...groupBy(cur, (l) => l.customer.country)].map(([name, rows]) => {
    const a = agg(rows), p = agg(prior.filter((l) => l.customer.country === name));
    return {
      name, revenue: a.revenue, customers: countryCust.get(name) ?? 0, carats: a.carats,
      growth: hasPrior ? grow(a.revenue, p.revenue) : 0, share: o.revenue > 0 ? (a.revenue / o.revenue) * 100 : 0,
    };
  }).sort((a, b) => b.revenue - a.revenue).slice(0, 20),
  locations: [...groupBy(cur, "location")].map(([name, rows]) => {
    const a = agg(rows);
    return { name, revenue: a.revenue, carats: a.carats, stones: a.stones, avgDaysInStock: Math.round(a.avgDays) };
  }).sort((a, b) => b.revenue - a.revenue),
  specs: [...groupBy(curMonth, specKey)].filter(([, rows]) => agg(rows).stones >= 30).map(([value, rows]) => {
    const [shape, carat, colour, clarity] = value.split("|");
    const a = agg(rows), p = agg(priMonth.filter((l) => specKey(l) === value)), all = agg(lines.filter((l) => specKey(l) === value));
    return {
      spec: `${shape} / ${carat} / ${colour} / ${clarity}`, shape, carat, colour, clarity,
      revenue: a.revenue, carats: a.carats, stones: a.stones,
      rate: a.carats > 0 ? a.revenue / a.carats : 0, usualRate: all.carats > 0 ? all.revenue / all.carats : 0,
      avgDiscount: a.avgDisc, daysToSell: Math.round(a.avgDays), growth: hasPrior ? grow(a.revenue, p.revenue) : 0,
    };
  }).sort((a, b) => b.revenue - a.revenue).slice(0, 40),
  owners: [...groupBy(cur, (l) => l.customer.owner)].map(([name, rows]) => {
    const a = agg(rows), p = agg(prior.filter((l) => l.customer.owner === name)), w = ownerCust.get(name) ?? { now: 0, before: 0 };
    return {
      name, revenue: a.revenue, carats: a.carats, stones: a.stones, customers: w.now, priorCustomers: w.before,
      orders: a.orders, avgDiscount: a.avgDisc, growth: hasPrior ? grow(a.revenue, p.revenue) : 0,
      retention: w.before > 0 ? Math.min(100, (w.now / w.before) * 100) : 0,
      avgOrderValue: a.orders > 0 ? a.revenue / a.orders : 0,
    };
  }).sort((a, b) => b.revenue - a.revenue),
  brokers: [...groupBy(cur, (l) => l.customer.broker)].map(([name, rows]) => {
    const a = agg(rows);
    return { name, revenue: a.revenue, stones: a.stones, avgDiscount: a.avgDisc };
  }).sort((a, b) => b.revenue - a.revenue).slice(0, 20),
  discountBands: DISCOUNT_BANDS.map(([band]) => {
    const a = agg(cur.filter((l) => discBand(l.discount) === band));
    return { band, stones: a.stones, revenue: a.revenue };
  }),
  ageing: ["0-30", "31-90", "91-180", "181-365", "365+"].map((band) => {
    const a = agg(cur.filter((l) => ageBand(l.days) === band));
    return { band, stones: a.stones, carats: a.carats, revenue: a.revenue };
  }),
  shapeDemand: [...groupBy(curMonth, (l) => `${l.shape}|${l.band}`)].map(([k, rows]) => {
    const [shape, carat] = k.split("|"), a = agg(rows);
    return { shape, carat, revenue: a.revenue, stones: a.stones };
  }),
  terms: [...groupBy(curMonth, (l) => l.customer.terms)].map(([name, rows]) => {
    const a = agg(rows);
    return { name, revenue: a.revenue, stones: a.stones, avgDiscount: a.avgDisc };
  }).sort((a, b) => b.revenue - a.revenue),
  priceMoves: [...groupBy(lines.filter((l) => rn.has(l.date.slice(0, 7))), (l) => `${l.shape}|${l.band}`)].map(([k, rows]) => {
    const [shape, carat] = k.split("|");
    const now = agg(rows.filter((l) => { const r = rn.get(l.date.slice(0, 7)); return r >= 2 && r <= 4; }));
    const before = agg(rows.filter((l) => { const r = rn.get(l.date.slice(0, 7)); return r >= 5 && r <= 7; }));
    if (now.carats <= 200 || before.carats <= 200) return null;
    const rate = now.revenue / now.carats, priorRate = before.revenue / before.carats;
    return { shape, carat, rate, priorRate, change: grow(rate, priorRate), carats: now.carats };
  }).filter(Boolean),
};

/* ---------------------------------------------------------------- */
/* Order history — keyed like lib/clientKey.ts, newest first         */
/* ---------------------------------------------------------------- */

const clientKey = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "unknown";
const orders = {};
for (const [c, rows] of byCustomer) {
  orders[clientKey(c.name)] = [...groupBy(rows, "orderId")].map(([orderNo, ls]) => {
    const a = agg(ls);
    return {
      orderNo, date: ls[0].date, stones: a.stones, carats: a.carats, amount: a.revenue,
      discount: round2(a.avgDisc), location: ls[0].location, terms: c.terms, owner: c.owner,
      // One entry per spec line; the stones route expands these into stones.
      lines: ls.map((l) => [l.shape, l.colour, l.clarity, l.lab, l.stones, l.carats, l.revenue, l.discount, l.days, l.location]),
    };
  }).reverse();
}

const dir = join(import.meta.dirname, "..", "data");
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, "demo-customers.csv"), csv);
writeFileSync(join(dir, "demo-dimensions.json"), JSON.stringify(dimensions));
writeFileSync(join(dir, "demo-orders.json"), JSON.stringify(orders));

// Sanity: the book and the rollups describe the same sales.
const bookYtd = book.reduce((s, b) => s + b.ytd, 0);
console.assert(Math.abs(bookYtd - o.revenue) < 1, `book YTD ${bookYtd} != rollup revenue ${o.revenue}`);
console.log(`${book.length} customers, ${lines.length} sale lines, current revenue $${Math.round(o.revenue).toLocaleString()} (${dimensions.overview.growth.toFixed(1)}% vs prior)`);
