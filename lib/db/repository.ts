import "server-only";

import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb, type Db } from "./client";
import { clientKey } from "@/lib/clientKey";
import {
  bookState, callLog, clientAssignments, customerOrders, notificationState, ownerMonthly, rollups, targets, customerRows, customerScores, imports, tradeapiSyncState, lotRows, snapshots, type CustomerRow,
} from "./schema";
import { buildCustomerProfiles, evidenceStrength, type CustomerSource } from "@/lib/analytics/customer";
import { aggregateCustomers } from "@/lib/tradeapi/aggregateCustomers";
import { analyseBook } from "@/lib/analytics/portfolio";
import { asOf } from "@/lib/data/asOf";
import type { Customer } from "@/lib/data/types";

/**
 * All database access lives here.
 *
 * Two rules hold the design together. Imported rows are facts and are never
 * overwritten by a score; and scores are always produced by the same
 * `buildCustomerProfiles` the UI uses, so a stored number can never diverge
 * from a computed one.
 */

/** Bump when a formula changes, so old snapshots are never silently compared. */
export const MODEL_VERSION = "2026.09-1";

/* ------------------------------------------------------------------ */
/* Mapping between the DB row and the analytics record                 */
/* ------------------------------------------------------------------ */

/**
 * Days since the last order, counted to the date the sales data runs to rather
 * than to the day it was imported. When the data falls behind, measuring to
 * today would make every regular buyer look overdue.
 */
function daysSinceAt(lastPurchase: string | null, asOf: string | null, fallback: number): number {
  if (!lastPurchase || !asOf) return fallback;
  const last = Date.parse(`${lastPurchase} UTC`);
  const end = Date.parse(asOf);
  if (Number.isNaN(last) || Number.isNaN(end)) return fallback;
  return Math.max(0, Math.round((end - last) / 86_400_000));
}

function toSource(row: CustomerRow, dataAsOf: string | null = null): CustomerSource {
  return {
    id: row.customerKey,
    name: row.name,
    country: row.country,
    flag: row.flag ?? "🏳️",
    ytd: row.ytd,
    lastYear: row.lastYear,
    carats: row.carats,
    stones: row.stones,
    transactions: row.transactions,
    firstPurchase: row.firstPurchase ?? "Jan 2024",
    lastPurchase: row.lastPurchase ?? asOf.date,
    daysSince: daysSinceAt(row.lastPurchase, dataAsOf, row.daysSince),
    cycleDays: [row.cycleLower, row.cycleUpper],
    cycleType: (row.cycleType as CustomerSource["cycleType"]) ?? "Regular",
    avgTxn: row.avgTxn,
    owner: row.owner ?? "Unassigned",
    broker: row.broker,
    terms: row.terms ?? "30 days",
    paymentScore: row.paymentScore,
    avgDiscount: row.avgDiscount,
    estimatedCapacity: row.estimatedCapacity,
    preferences: row.preferences ?? {
      shape: "Unspecified", carat: "Unspecified", colour: "—", clarity: "—", lab: "—",
    },
    crossSell: row.crossSell ?? [],
    action: row.action ?? "",
  };
}

function toRow(importId: number, source: CustomerSource) {
  return {
    importId,
    customerKey: source.id,
    name: source.name,
    country: source.country,
    flag: source.flag,
    ytd: source.ytd,
    lastYear: source.lastYear,
    carats: source.carats,
    stones: source.stones,
    transactions: source.transactions,
    avgTxn: source.avgTxn,
    firstPurchase: source.firstPurchase,
    lastPurchase: source.lastPurchase,
    daysSince: source.daysSince,
    cycleLower: source.cycleDays[0],
    cycleUpper: source.cycleDays[1],
    cycleType: source.cycleType,
    owner: source.owner,
    broker: source.broker,
    terms: source.terms,
    paymentScore: source.paymentScore,
    avgDiscount: source.avgDiscount,
    estimatedCapacity: source.estimatedCapacity,
    preferences: source.preferences,
    crossSell: source.crossSell,
    action: source.action,
  };
}

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

/* ------------------------------------------------------------------ */
/* Writing                                                             */
/* ------------------------------------------------------------------ */

export type SaveImportInput = {
  fileName: string;
  source?: "csv" | "sample";
  records: CustomerSource[];
  columnMapping?: Record<string, number>;
  assumedFields?: string[];
  issues?: { row: number; field: string; message: string }[];
  skippedCount?: number;
};

/**
 * Stores an import, scores it, and records the snapshot — as one transaction,
 * so a failure part-way through can never leave a half-imported book that the
 * app would then treat as authoritative.
 */
export async function saveImport(input: SaveImportInput): Promise<{ importId: number; snapshotId: number }> {
  return getDb().transaction(async (tx) => {
    // Only one book is live at a time.
    await tx.update(imports).set({ isActive: false }).where(eq(imports.isActive, true));

    const [created] = await tx
      .insert(imports)
      .values({
        fileName: input.fileName,
        source: input.source ?? "csv",
        rowCount: input.records.length,
        skippedCount: input.skippedCount ?? 0,
        columnMapping: input.columnMapping ?? {},
        assumedFields: input.assumedFields ?? [],
        issues: (input.issues ?? []).slice(0, 500),
        isActive: true,
      })
      .returning({ id: imports.id });

    // Chunked so a large book does not exceed the parameter limit per statement.
    const rows = input.records.map((r) => toRow(created.id, r));
    for (let i = 0; i < rows.length; i += 500) {
      await tx.insert(customerRows).values(rows.slice(i, i + 500));
    }

    const snapshotId = await writeSnapshot(tx, created.id, input.records);
    return { importId: created.id, snapshotId };
  });
}

export type LotRowInput = {
  customerKey: string;
  customerName: string;
  shape: string | null;
  carats: number;
  caratBand: string | null;
  colour: string | null;
  clarity: string | null;
  cut: string | null;
  polish: string | null;
  symmetry: string | null;
  fluorescence: string | null;
  lab: string | null;
  rap: number;
  discPercent: number | null;
  price: number;
  amount: number;
  soldRate: number;
  listPrice: number;
  finalDiscPercent: number;
  costAmount: number;
  costPrice: number;
  location: string | null;
  country: string | null;
  owner: string | null;
  broker: string | null;
  terms: string | null;
  tranDate: string | null;
  saleDate: string | null;
  daysInStock: number | null;
  orderNo: string | null;
};

/**
 * Writes a page of stone-level rows pulled from the Trade Data API as one
 * import: `lot_rows` (the raw facts) plus `customer_rows` and a snapshot
 * (the same rollup + scoring pipeline a CSV import goes through, fed by
 * `aggregateCustomers`). Becomes the active book, same rule as `saveImport`
 * — exactly one import is live at a time.
 */
export async function saveApiSync(input: {
  fileName: string;
  rows: LotRowInput[];
  /** False for the full historical backfill — 2.47M raw rows is more than a
   *  free-tier database should hold, and nothing in the app queries lot_rows
   *  directly (every page reads customer_rows/snapshots), so skipping the
   *  raw write there is a real storage saving, not a feature loss. Defaults
   *  true to preserve the existing 30-day sync's behavior. */
  persistLotRows?: boolean;
}): Promise<{ importId: number; snapshotId: number; customerCount: number }> {
  const records = aggregateCustomers(input.rows);

  return getDb().transaction(async (tx) => {
    await tx.update(imports).set({ isActive: false }).where(eq(imports.isActive, true));

    const [created] = await tx
      .insert(imports)
      .values({
        fileName: input.fileName,
        source: "api",
        rowCount: records.length,
        isActive: true,
      })
      .returning({ id: imports.id });

    if (input.persistLotRows ?? true) {
      const lotRowValues = input.rows.map((r) => ({ importId: created.id, ...r }));
      for (let i = 0; i < lotRowValues.length; i += 500) {
        await tx.insert(lotRows).values(lotRowValues.slice(i, i + 500));
      }
    }

    const customerRowValues = records.map((r) => toRow(created.id, r));
    for (let i = 0; i < customerRowValues.length; i += 500) {
      await tx.insert(customerRows).values(customerRowValues.slice(i, i + 500));
    }

    const snapshotId = await writeSnapshot(tx, created.id, records);
    return { importId: created.id, snapshotId, customerCount: records.length };
  });
}

/**
 * Same write as `saveApiSync`, but for a caller that has already aggregated
 * its own `CustomerSource[]` (the streaming historical backfill — it folds
 * rows into per-customer buckets as each month is fetched, rather than
 * holding millions of raw rows in memory for one big `aggregateCustomers`
 * call at the end). Never writes lot_rows, since a caller with pre-aggregated
 * records by definition isn't holding raw rows to write.
 */
export async function saveAggregatedCustomers(input: {
  fileName: string;
  records: CustomerSource[];
  /** Real latest transaction date this data covers through (YYYY-MM-DD) —
   *  shown on the dashboard so "up to which date" is honest, not the run
   *  time or a hardcoded placeholder. */
  dataAsOf?: string;
}): Promise<{ importId: number; snapshotId: number; customerCount: number }> {
  const records = input.records;

  return getDb().transaction(async (tx) => {
    await tx.update(imports).set({ isActive: false }).where(eq(imports.isActive, true));

    const [created] = await tx
      .insert(imports)
      .values({
        fileName: input.fileName,
        source: "api",
        rowCount: records.length,
        isActive: true,
        dataAsOf: input.dataAsOf ?? null,
      })
      .returning({ id: imports.id });

    const customerRowValues = records.map((r) => toRow(created.id, r));
    for (let i = 0; i < customerRowValues.length; i += 500) {
      await tx.insert(customerRows).values(customerRowValues.slice(i, i + 500));
    }

    const snapshotId = await writeSnapshot(tx, created.id, records);
    return { importId: created.id, snapshotId, customerCount: records.length };
  });
}

/**
 * The freshness check for a tracked API date window: compares the last
 * known `TotalCount` against a fresh one. No polling here — callers decide
 * when to check; this only tells them whether it changed.
 */
export async function getSyncState(fromDate: string, toDate: string) {
  const [row] = await getDb()
    .select()
    .from(tradeapiSyncState)
    .where(and(eq(tradeapiSyncState.fromDate, fromDate), eq(tradeapiSyncState.toDate, toDate)));
  return row ?? null;
}

export async function upsertSyncState(input: {
  fromDate: string;
  toDate: string;
  totalCount: number;
  synced: boolean;
  importId?: number;
}) {
  const db = getDb();
  const existing = await getSyncState(input.fromDate, input.toDate);
  if (existing) {
    await db
      .update(tradeapiSyncState)
      .set({
        lastTotalCount: input.totalCount,
        lastCheckedAt: new Date(),
        ...(input.synced ? { lastSyncedAt: new Date(), lastImportId: input.importId } : {}),
      })
      .where(eq(tradeapiSyncState.id, existing.id));
  } else {
    await db.insert(tradeapiSyncState).values({
      fromDate: input.fromDate,
      toDate: input.toDate,
      lastTotalCount: input.totalCount,
      ...(input.synced ? { lastSyncedAt: new Date(), lastImportId: input.importId } : {}),
    });
  }
}

/**
 * Scores a set of records and stores the result as a snapshot of `importId`.
 * Shared by import and re-score so there is exactly one place that decides
 * what a snapshot contains.
 */
async function writeSnapshot(
  tx: Pick<Db, "insert">,
  importId: number,
  records: CustomerSource[],
): Promise<number> {
  const scored = buildCustomerProfiles(records);
  const analysis = analyseBook(scored);

  const [snapshot] = await tx
    .insert(snapshots)
    .values({
      importId,
      modelVersion: MODEL_VERSION,
      asOfDate: asOf.date,
      customerCount: scored.length,
      activeCount: analysis.kpis.active,
      atRiskCount: analysis.kpis.atRisk,
      atRiskValue: analysis.kpis.atRiskAnnualValue,
      reordersDue: analysis.kpis.reordersDue,
      expansionAccounts: analysis.kpis.expansionAccounts,
      expansionValue: analysis.kpis.expansionValue,
      totalRevenue: analysis.kpis.totalRevenue,
      medianHealth: median(scored.map((c) => c.health)),
      medianChurn: median(scored.map((c) => c.churnRisk)),
      segmentation: analysis.classDistribution,
      concentration: analysis.concentration,
    })
    .returning({ id: snapshots.id });

  const scoreRows = scored.map((c, i) => ({
    snapshotId: snapshot.id,
    customerKey: c.id,
    segment: c.segment,
    health: c.health,
    churnRisk: c.churnRisk,
    rfmR: c.rfm.r,
    rfmF: c.rfm.f,
    rfmM: c.rfm.m,
    ltv: c.ltv,
    riskAdjustedValue: c.riskAdjustedValue,
    growth: c.growth,
    walletShare: c.walletShare,
    priceSensitivity: c.priceSensitivity,
    evidenceScore: evidenceStrength(records[i]).score,
  }));
  for (let i = 0; i < scoreRows.length; i += 500) {
    await tx.insert(customerScores).values(scoreRows.slice(i, i + 500));
  }

  return snapshot.id;
}

/**
 * Re-scores an existing import without re-importing it. This is what makes
 * scores disposable: change a formula, rebuild, compare snapshots.
 */
export async function rescoreImport(importId: number): Promise<number> {
  const rows = await getDb().select().from(customerRows).where(eq(customerRows.importId, importId));
  if (!rows.length) throw new Error(`Import ${importId} has no rows`);

  // A re-score adds a snapshot to the existing import. It must never clone the
  // import or its rows — the raw data is the one thing that does not change.
  return getDb().transaction((tx) => writeSnapshot(tx, importId, rows.map((r) => toSource(r))));
}

/* ------------------------------------------------------------------ */
/* Reading                                                             */
/* ------------------------------------------------------------------ */

export type ActiveBook = {
  customers: Customer[];
  meta: {
    importId: number;
    fileName: string;
    source: string;
    importedAt: string;
    rowCount: number;
    assumedFields: string[];
    modelVersion: string;
    dataAsOf: string | null;
  };
};

/** The live book, scored on read so it always reflects the current models. */
export async function getActiveBook(scope?: { ownerName: string }): Promise<ActiveBook | null> {
  const [active] = await getDb().select().from(imports).where(eq(imports.isActive, true)).limit(1);
  if (!active) return null;

  // Owner names in the raw export have whitespace-only duplicates for the
  // same real person (e.g. "Jane Doe" vs "Jane  Doe") — compared on
  // collapsed whitespace, not raw equality. An admin's assignment, when there
  // is one, replaces the owner named in the sales data.
  const norm = (v: string | null) => (v ?? "").trim().replace(/s+/g, " ");
  const overrides = await getAssignments();
  const all = await getDb().select().from(customerRows).where(eq(customerRows.importId, active.id));
  const rows = all
    .map((r) => ({ ...r, owner: overrides.get(clientKey(r.name)) ?? r.owner }))
    .filter((r) => !scope || norm(r.owner) === norm(scope.ownerName));
  // An empty *scoped* result is a real answer (this rep has no rows in the
  // active import) and must never fall through to the unscoped sample data a
  // caller uses when there is truly no active import — that would leak every
  // customer to an account that's supposed to see only its own book.
  if (!rows.length && !scope) return null;

  return {
    customers: buildCustomerProfiles(rows.map((r) => toSource(r, active.dataAsOf ?? null))),
    meta: {
      importId: active.id,
      fileName: active.fileName,
      source: active.source,
      importedAt: active.importedAt.toISOString(),
      rowCount: active.rowCount,
      assumedFields: active.assumedFields ?? [],
      modelVersion: MODEL_VERSION,
      dataAsOf: active.dataAsOf ?? null,
    },
  };
}

export async function listImports() {
  return getDb()
    .select({
      id: imports.id,
      fileName: imports.fileName,
      source: imports.source,
      importedAt: imports.importedAt,
      rowCount: imports.rowCount,
      skippedCount: imports.skippedCount,
      isActive: imports.isActive,
      assumedFields: imports.assumedFields,
    })
    .from(imports)
    .orderBy(desc(imports.importedAt));
}

export async function activateImport(importId: number): Promise<void> {
  await getDb().transaction(async (tx) => {
    await tx.update(imports).set({ isActive: false }).where(eq(imports.isActive, true));
    await tx.update(imports).set({ isActive: true }).where(eq(imports.id, importId));
  });
}

export async function deleteImport(importId: number): Promise<void> {
  // Rows, snapshots and scores cascade from the import.
  await getDb().delete(imports).where(eq(imports.id, importId));
}

/**
 * Snapshot history, newest first. This is what turns period-over-period
 * movement into arithmetic instead of an assumption.
 */
export async function listSnapshots(limit = 24) {
  return getDb()
    .select({
      id: snapshots.id,
      importId: snapshots.importId,
      createdAt: snapshots.createdAt,
      modelVersion: snapshots.modelVersion,
      customerCount: snapshots.customerCount,
      activeCount: snapshots.activeCount,
      atRiskCount: snapshots.atRiskCount,
      atRiskValue: snapshots.atRiskValue,
      reordersDue: snapshots.reordersDue,
      expansionValue: snapshots.expansionValue,
      totalRevenue: snapshots.totalRevenue,
      medianHealth: snapshots.medianHealth,
      medianChurn: snapshots.medianChurn,
    })
    .from(snapshots)
    .orderBy(desc(snapshots.createdAt))
    .limit(limit);
}

export type PortfolioTrend = {
  metric: string;
  current: number;
  previous: number;
  deltaPct: number;
};

/**
 * Change between the two most recent snapshots of the same model version.
 * Comparing across model versions would report a formula change as a business
 * change, which is worse than showing nothing.
 */
export async function getPortfolioTrend(): Promise<PortfolioTrend[] | null> {
  const [active] = await getDb().select().from(imports).where(eq(imports.isActive, true)).limit(1);
  if (!active) return null;

  // Only ever compare snapshots of the *same* import. Two different books have
  // different customers, so "active customers 2 to 418" would be a change of
  // dataset reported as a change in the business.
  const recent = await getDb()
    .select()
    .from(snapshots)
    .where(and(eq(snapshots.importId, active.id), eq(snapshots.modelVersion, MODEL_VERSION)))
    .orderBy(desc(snapshots.createdAt))
    .limit(2);

  if (recent.length < 2) return null;
  const [current, previous] = recent;

  const metrics: [string, number, number][] = [
    ["Active customers", current.activeCount, previous.activeCount],
    ["At elevated churn risk", current.atRiskCount, previous.atRiskCount],
    ["Reorders due", current.reordersDue, previous.reordersDue],
    ["Estimated expansion", current.expansionValue, previous.expansionValue],
    ["Total revenue", current.totalRevenue, previous.totalRevenue],
    ["Median health", current.medianHealth, previous.medianHealth],
  ];

  return metrics.map(([metric, curr, prev]) => ({
    metric,
    current: curr,
    previous: prev,
    deltaPct: prev === 0 ? 0 : ((curr - prev) / prev) * 100,
  }));
}

/** Row counts per table, for the Data Sources page. */
export async function getStorageStats() {
  const [row] = await getDb()
    .select({
      importCount: sql<number>`(select count(*)::int from ${imports})`,
      customerRowCount: sql<number>`(select count(*)::int from ${customerRows})`,
      snapshotCount: sql<number>`(select count(*)::int from ${snapshots})`,
      scoreCount: sql<number>`(select count(*)::int from ${customerScores})`,
    })
    .from(imports)
    .limit(1);

  return (
    row ?? { importCount: 0, customerRowCount: 0, snapshotCount: 0, scoreCount: 0 }
  );
}

/** Stores the running totals behind the active book (see `bookState`). */
export async function saveBookState(input: { asOf: string; stateJson: string; importId: number }) {
  const values = { asOf: input.asOf, state: JSON.parse(input.stateJson), importId: input.importId, updatedAt: new Date() };
  await getDb().insert(bookState).values({ id: 1, ...values, lastCheckedAt: new Date() })
    .onConflictDoUpdate({ target: bookState.id, set: { ...values, lastCheckedAt: new Date() } });
}

/**
 * Atomically claims the right to check freshness: returns the stored state
 * only if it was last checked more than `minHours` ago (or `force`), and
 * stamps it as checked in the same statement — so concurrent logins or
 * server instances cannot all start a sync at once.
 */
export async function claimBookState(minHours: number, force: boolean) {
  const rows = await getDb().execute(sql`
    UPDATE book_state SET last_checked_at = now()
    WHERE id = 1 AND (${force} OR last_checked_at < now() - make_interval(hours => ${minHours}))
    RETURNING as_of, state, import_id`);
  return (rows.rows[0] as { as_of: string; state: unknown; import_id: number | null } | undefined) ?? null;
}

/** After a failed sync, lets the next check retry in ~15 minutes, not hours. */
export async function releaseBookStateClaim(minHours: number) {
  await getDb().execute(sql`
    UPDATE book_state SET last_checked_at = now() - make_interval(hours => ${minHours}) + interval '15 minutes'
    WHERE id = 1`);
}

/** Rolls rows up to the `owner|YYYY-MM` keys that `owner_monthly` stores. */
export function addToMonthly(acc: Map<string, number>, rows: LotRowInput[]) {
  for (const r of rows) {
    if (!r.saleDate) continue;
    const key = `${r.owner ?? "Unassigned"}|${r.saleDate.slice(0, 7)}`;
    acc.set(key, (acc.get(key) ?? 0) + r.amount);
  }
}

/** `replace` rebuilds the table (full import); otherwise amounts are added on (auto-sync). */
export async function saveOwnerMonthly(acc: Map<string, number>, replace: boolean) {
  const values = [...acc].map(([k, revenue]) => {
    const i = k.lastIndexOf("|");
    return { owner: k.slice(0, i), month: k.slice(i + 1), revenue: Math.round(revenue * 100) / 100 };
  });
  await getDb().transaction(async (tx) => {
    if (replace) await tx.delete(ownerMonthly);
    for (let i = 0; i < values.length; i += 500) {
      await tx.insert(ownerMonthly).values(values.slice(i, i + 500)).onConflictDoUpdate({
        target: [ownerMonthly.owner, ownerMonthly.month],
        set: { revenue: replace ? sql`excluded.revenue` : sql`${ownerMonthly.revenue} + excluded.revenue` },
      });
    }
  });
}

export async function listOwnerMonthly(year: number) {
  return getDb().select().from(ownerMonthly).where(sql`${ownerMonthly.month} like ${`${year}-%`}`);
}

export async function listTargets(year: number) {
  return getDb().select().from(targets).where(eq(targets.year, year));
}

/** An amount of 0 or less clears the target. */
export async function setTarget(year: number, owner: string, amount: number) {
  if (amount <= 0) {
    await getDb().delete(targets).where(and(eq(targets.year, year), eq(targets.owner, owner)));
    return;
  }
  await getDb().insert(targets).values({ year, owner, amount })
    .onConflictDoUpdate({ target: [targets.year, targets.owner], set: { amount, updatedAt: new Date() } });
}

/** client key -> assigned salesperson. */
export async function getAssignments(): Promise<Map<string, string>> {
  const rows = await getDb().select().from(clientAssignments);
  return new Map(rows.map((r) => [r.clientKey, r.owner]));
}

/** owner null clears the assignment, so the client goes back to whoever the sales data names. */
export async function assignClients(keys: string[], owner: string | null) {
  await getDb().transaction(async (tx) => {
    for (let i = 0; i < keys.length; i += 500) {
      const chunk = keys.slice(i, i + 500);
      if (owner === null) {
        await tx.delete(clientAssignments).where(inArray(clientAssignments.clientKey, chunk));
      } else {
        await tx.insert(clientAssignments).values(chunk.map((clientKey) => ({ clientKey, owner })))
          .onConflictDoUpdate({ target: clientAssignments.clientKey, set: { owner, updatedAt: new Date() } });
      }
    }
  });
}

/** `replace` rebuilds the rollups (full import); otherwise sums are added on (auto-sync). */
export async function saveRollups(acc: Map<string, import("@/lib/tradeapi/rollupFold").Cell>, replace: boolean) {
  const { splitKey } = await import("@/lib/tradeapi/rollupFold");
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const values = [...acc].map(([key, c]) => ({
    ...splitKey(key),
    revenue: r2(c.revenue), carats: r2(c.carats), stones: c.stones, orders: c.orders.size,
    discSum: r2(c.discSum), discN: c.discN, stockSum: r2(c.stockSum), stockN: c.stockN,
    rapVal: r2(c.rapVal), rapAmt: r2(c.rapAmt), listVal: r2(c.listVal), listAmt: r2(c.listAmt),
  }));
  const add = (col: keyof typeof rollups.$inferInsert) =>
    replace ? sql.raw(`excluded."${snake(col)}"`) : sql.raw(`rollups."${snake(col)}" + excluded."${snake(col)}"`);
  await getDb().transaction(async (tx) => {
    if (replace) await tx.delete(rollups);
    for (let i = 0; i < values.length; i += 1000) {
      await tx.insert(rollups).values(values.slice(i, i + 1000)).onConflictDoUpdate({
        target: [rollups.period, rollups.dim, rollups.value],
        set: {
          revenue: add("revenue"), carats: add("carats"), stones: add("stones"), orders: add("orders"),
          discSum: add("discSum"), discN: add("discN"), stockSum: add("stockSum"), stockN: add("stockN"),
          rapVal: add("rapVal"), rapAmt: add("rapAmt"), listVal: add("listVal"), listAmt: add("listAmt"),
        },
      });
    }
  });
}

const snake = (s: string) => s.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);

/** `replace` rebuilds the history (full import); otherwise adds to existing orders (auto-sync). */
export async function saveOrders(acc: Map<string, import("@/lib/tradeapi/orderFold").OrderCell>, replace: boolean) {
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const values = [...acc.values()].map((c) => ({ ...c, carats: r2(c.carats), amount: r2(c.amount), discSum: r2(c.discSum) }));
  await getDb().transaction(async (tx) => {
    if (replace) await tx.delete(customerOrders);
    for (let i = 0; i < values.length; i += 1000) {
      await tx.insert(customerOrders).values(values.slice(i, i + 1000)).onConflictDoUpdate({
        target: [customerOrders.customerKey, customerOrders.orderNo],
        set: replace
          ? { stones: sql`excluded.stones`, carats: sql`excluded.carats`, amount: sql`excluded.amount`, discSum: sql`excluded.disc_sum`, discN: sql`excluded.disc_n`, saleDate: sql`excluded.sale_date` }
          : {
              stones: sql`${customerOrders.stones} + excluded.stones`,
              carats: sql`${customerOrders.carats} + excluded.carats`,
              amount: sql`${customerOrders.amount} + excluded.amount`,
              discSum: sql`${customerOrders.discSum} + excluded.disc_sum`,
              discN: sql`${customerOrders.discN} + excluded.disc_n`,
              saleDate: sql`greatest(${customerOrders.saleDate}, excluded.sale_date)`,
            },
      });
    }
  });
}

export async function listCustomerOrders(key: string, limit = 500) {
  return getDb().select().from(customerOrders).where(eq(customerOrders.customerKey, key))
    .orderBy(desc(customerOrders.saleDate)).limit(limit);
}

/** This user's seen/read state for the given notification ids. */
export async function getNotificationState(userId: number) {
  const rows = await getDb()
    .select({ id: notificationState.notificationId, read: notificationState.read })
    .from(notificationState)
    .where(and(eq(notificationState.userId, userId), sql`${notificationState.updatedAt} > now() - interval '120 days'`));
  return rows;
}

/**
 * Marks notifications seen (read = false) or read (read = true). Seen never
 * downgrades a read one. Rows older than 120 days are dropped, since an alert
 * that old is no longer listed.
 */
export async function markNotifications(userId: number, ids: string[], read: boolean) {
  const clean = [...new Set(ids)].filter((id) => id && id.length <= 200).slice(0, 200);
  if (!clean.length) return;
  await getDb().transaction(async (tx) => {
    await tx.insert(notificationState)
      .values(clean.map((notificationId) => ({ userId, notificationId, read })))
      .onConflictDoUpdate({
        target: [notificationState.userId, notificationState.notificationId],
        set: { read: read ? sql`true` : sql`${notificationState.read}`, updatedAt: new Date() },
      });
    await tx.delete(notificationState).where(and(eq(notificationState.userId, userId), sql`${notificationState.updatedAt} < now() - interval '120 days'`));
  });
}

/** This user's My day actions from the last 7 days; older ones no longer hide anyone. */
export async function listCalls(userId: number) {
  return getDb()
    .select({ key: callLog.customerKey, outcome: callLog.outcome, at: callLog.at })
    .from(callLog)
    .where(and(eq(callLog.userId, userId), sql`${callLog.at} > now() - interval '7 days'`));
}

/** Records "called" or "skipped" for a customer, or clears it (undo) with null. */
export async function logCall(userId: number, customerKey: string, outcome: "called" | "skipped" | null) {
  if (outcome === null) {
    await getDb().delete(callLog).where(and(eq(callLog.userId, userId), eq(callLog.customerKey, customerKey)));
    return;
  }
  await getDb().insert(callLog).values({ userId, customerKey, outcome })
    .onConflictDoUpdate({ target: [callLog.userId, callLog.customerKey], set: { outcome, at: new Date() } });
}
