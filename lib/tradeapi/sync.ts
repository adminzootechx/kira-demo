import "server-only";

import { fetchSalesData, type FetchSalesDataParams, type StoneDetail } from "./client";
import { getSyncState, saveApiSync, upsertSyncState, type LotRowInput } from "@/lib/db/repository";
import { logError } from "@/lib/errorCodes";

const PAGE_SIZE = 300; // reverted: 1000 didn't speed things up, per-page latency scaled with page size

// Same bucket edges as data-samples/sale_data_ingest.py's BANDS, so a lot
// synced from the API and one ingested from a workbook land in the same band.
const CARAT_BANDS: [number, number, string][] = [
  [0.0, 0.3, "0.00-0.29"], [0.3, 0.5, "0.30-0.49"], [0.5, 1.0, "0.50-0.99"],
  [1.0, 1.5, "1.00-1.49"], [1.5, 2.0, "1.50-1.99"], [2.0, 3.0, "2.00-2.99"],
  [3.0, 5.0, "3.00-4.99"], [5.0, Infinity, "5.00+"],
];

function caratBand(carats: number): string {
  for (const [lo, hi, name] of CARAT_BANDS) {
    if (carats >= lo && carats < hi) return name;
  }
  return "5.00+";
}

function num(v: string | null | undefined): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function numOrNull(v: string | null | undefined): number | null {
  if (v === null || v === undefined || v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** API dates arrive as "M/D/YYYY h:mm:ss AM" — normalised to YYYY-MM-DD. */
function isoDate(v: string | null | undefined): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function slug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "unknown"
  );
}

export function mapRow(row: StoneDetail): LotRowInput {
  const customerName = row.Party2 || row.CompanyName || "Unknown";
  const carats = num(row.Cts);
  const tranDate = isoDate(row.TranDate);
  const saleDate = isoDate(row.SaleDate);
  const daysInStock =
    tranDate && saleDate
      ? Math.max(0, Math.round((new Date(saleDate).getTime() - new Date(tranDate).getTime()) / 86_400_000))
      : null;

  return {
    customerKey: slug(customerName),
    customerName,
    shape: row.Shp || null,
    carats,
    caratBand: caratBand(carats),
    colour: row.Col || null,
    clarity: row.Clr || null,
    cut: row.Cut || null,
    polish: row.Pol || null,
    symmetry: row.Sym || null,
    fluorescence: row.Flr || null,
    lab: row.Lab || null,
    rap: num(row.Rap),
    discPercent: numOrNull(row.DiscPercent),
    price: num(row.Price),
    amount: num(row.Amt),
    soldRate: num(row.SoldRate),
    // ponytail: API has no explicit ListPrice/FinalDiscPercent field (unlike
    // the workbook export) — Sprice is the closest analogue on hand. Revisit
    // once LUSTRE confirms the field mapping for these two.
    listPrice: num(row.Sprice),
    finalDiscPercent: numOrNull(row.DiscPercent) ?? 0,
    costAmount: 0,
    costPrice: num(row.CPrice),
    location: row.Loc || null,
    country: row.Country || null,
    owner: row.SalePerson || null,
    broker: row.Broker || null,
    terms: row.Terms || null,
    tranDate,
    saleDate,
    daysInStock,
    orderNo: row.WebOrderNo || row.InvNo || null,
  };
}

export type SyncResult = {
  importId: number;
  rowsWritten: number;
  customerCount: number;
  totalAvailable: number;
  pagesFetched: number;
};

export type SyncParams = {
  fromDate: string;
  toDate: string;
  /** ponytail: caps a demo/manual sync so it returns in a reasonable time.
   *  Raise this (and pass persistLotRows: false) for a full historical
   *  backfill, run as a standalone script rather than a single request. */
  maxRows?: number;
  /** False skips writing the raw rows to lot_rows — see saveApiSync's own
   *  comment for why that's the right call for a multi-million-row backfill. */
  persistLotRows?: boolean;
};

/** One retry-with-backoff wrapper around a single page fetch — a run of
 *  thousands of sequential calls to an external API over an hour-plus has
 *  real odds of one transient blip, and retrying that one page is far
 *  cheaper than losing the whole run to it. */
async function fetchPageWithRetry(params: FetchSalesDataParams, attempts = 6) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fetchSalesData(params);
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((r) => setTimeout(r, Math.min(5000 * attempt, 30_000)));
    }
  }
  logError("LUSTRE-SYNC-2", `fetchPageWithRetry exhausted ${attempts} attempts`, lastError);
  throw lastError;
}

/**
 * Pages through GetPowerbisalesdata for one date window. Kept separate from
 * syncLotRows so a caller spanning years of history (see backfill.ts) can
 * call this once per short window instead of one huge range — the API takes
 * over 150s (observed, still climbing) to answer even a single page across
 * an 11-year span, but answers a 30-day window in well under a second.
 */
export async function fetchRowsForWindow(
  fromDate: string,
  toDate: string,
  maxRows: number,
  onProgress?: (pagesFetched: number, rowsSoFar: number, totalAvailable: number) => void,
): Promise<{ rows: LotRowInput[]; totalAvailable: number; pagesFetched: number }> {
  const rows: LotRowInput[] = [];
  let totalAvailable = 0;
  let pagesFetched = 0;
  let startRow = 1;

  for (;;) {
    const endRow = startRow + PAGE_SIZE - 1;
    const page = await fetchPageWithRetry({ startRow, endRow, fromDate, toDate });
    pagesFetched += 1;
    totalAvailable = page.totalCount;
    rows.push(...page.rows.map(mapRow));
    onProgress?.(pagesFetched, rows.length, totalAvailable);

    if (page.rows.length < PAGE_SIZE) break; // last page
    if (rows.length >= maxRows) break;
    if (startRow + PAGE_SIZE > totalAvailable) break;
    startRow += PAGE_SIZE;
  }

  return { rows: rows.slice(0, maxRows), totalAvailable, pagesFetched };
}

/** Pages through GetPowerbisalesdata for a date range and writes lot_rows. */
export async function syncLotRows({ fromDate, toDate, maxRows = 3000, persistLotRows }: SyncParams): Promise<SyncResult> {
  const { rows, totalAvailable, pagesFetched } = await fetchRowsForWindow(
    fromDate,
    toDate,
    maxRows,
    (pagesFetched, rowsSoFar, total) => {
      if (pagesFetched % 20 === 0) {
        console.log(`[tradeapi sync] page ${pagesFetched} — ${rowsSoFar}/${total} rows fetched`);
      }
    },
  );

  const { importId, customerCount } = await saveApiSync({
    fileName: `tradeapi-api ${fromDate}..${toDate}`,
    rows: rows.slice(0, maxRows),
    persistLotRows,
  });

  await upsertSyncState({ fromDate, toDate, totalCount: totalAvailable, synced: true, importId });

  return {
    importId,
    rowsWritten: Math.min(rows.length, maxRows),
    customerCount,
    totalAvailable,
    pagesFetched,
  };
}

export type FreshnessResult = {
  changed: boolean;
  previousTotalCount: number | null;
  currentTotalCount: number;
};

/**
 * The cheap check: one request for `TotalCount` on a window, compared
 * against what was last seen for that same window. Does not sync — the
 * caller decides whether a change is worth acting on.
 */
export async function checkFreshness(fromDate: string, toDate: string): Promise<FreshnessResult> {
  const previous = await getSyncState(fromDate, toDate);
  const page = await fetchSalesData({ startRow: 1, endRow: 1, fromDate, toDate });

  await upsertSyncState({ fromDate, toDate, totalCount: page.totalCount, synced: false });

  return {
    changed: previous ? previous.lastTotalCount !== page.totalCount : true,
    previousTotalCount: previous?.lastTotalCount ?? null,
    currentTotalCount: page.totalCount,
  };
}

export type ExcelFreshnessResult = {
  upToDate: boolean;
  /** Row count the live API reports strictly after the Excel data's last date. */
  newRowsAvailable: number;
  excelAsOfDate: string;
  checkedThrough: string;
};

/**
 * Cheap check for whether an Excel-based import is behind the live API: one
 * request for `TotalCount` on the window strictly after the Excel data's
 * last real sale date, through today. A non-zero count means the API has
 * rows the Excel export doesn't — the Excel file needs a newer export before
 * the next import.
 */
export async function checkExcelDataFreshness(excelAsOfDate: string): Promise<ExcelFreshnessResult> {
  const today = new Date().toISOString().slice(0, 10);
  const nextDay = new Date(Date.parse(excelAsOfDate) + 86_400_000).toISOString().slice(0, 10);
  if (nextDay > today) {
    return { upToDate: true, newRowsAvailable: 0, excelAsOfDate, checkedThrough: today };
  }
  const page = await fetchPageWithRetry({ startRow: 1, endRow: 1, fromDate: nextDay, toDate: today });
  return { upToDate: page.totalCount === 0, newRowsAvailable: page.totalCount, excelAsOfDate, checkedThrough: today };
}
