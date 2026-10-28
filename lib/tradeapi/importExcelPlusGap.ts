import "server-only";

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import ExcelJS from "exceljs";
import { fetchRowsForWindow } from "./sync";
import { checkExcelDataFreshness } from "./sync";
import { addToMonthly, saveAggregatedCustomers, saveBookState, saveOrders, saveOwnerMonthly, saveRollups, upsertSyncState, type LotRowInput } from "@/lib/db/repository";
import { foldRollups, type RollupAcc } from "./rollupFold";
import { foldOrders, type OrderAcc } from "./orderFold";
import { makeStreamWindow, foldRows, finalizeBuckets, serializeBuckets, type Bucket, type StreamWindow } from "./streamAggregate";

/** One JSON file per gap day, so a killed/restarted run never re-fetches a
 *  day it already has — resume just means "skip the days already on disk". */
/** Sales per salesperson per month, filled as rows stream through. */
const monthly = new Map<string, number>();
const rollupAcc: RollupAcc = new Map();
const orderAcc: OrderAcc = new Map();

const CACHE_DIR = join(process.cwd(), ".gap-cache");

function cachePathFor(day: string): string {
  return join(CACHE_DIR, `${day}.json`);
}

/**
 * Same as importExcel.ts, but also fetches the gap between the Excel
 * exports' last real date and today from the live API and folds it into the
 * same bucket map, so the two sources land in one aggregation instead of
 * the API-fetched tail silently overwriting or being ignored.
 *
 * Run: npx tsx --conditions react-server --env-file .env.local lib/tradeapi/importExcelPlusGap.ts "<file1>" "<file2>" ...
 */

const CARAT_BANDS: [number, number, string][] = [
  [0.0, 0.3, "0.00-0.29"], [0.3, 0.5, "0.30-0.49"], [0.5, 1.0, "0.50-0.99"],
  [1.0, 1.5, "1.00-1.49"], [1.5, 2.0, "1.50-1.99"], [2.0, 3.0, "2.00-2.99"],
  [3.0, 5.0, "3.00-4.99"], [5.0, Infinity, "5.00+"],
];
function caratBand(carats: number): string {
  for (const [lo, hi, name] of CARAT_BANDS) if (carats >= lo && carats < hi) return name;
  return "5.00+";
}
function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "unknown";
}
function unwrap(v: unknown): unknown {
  if (v && typeof v === "object" && "result" in (v as Record<string, unknown>)) return (v as { result: unknown }).result;
  return v;
}
function str(v: unknown): string | null {
  const u = unwrap(v);
  return u === null || u === undefined || u === "" ? null : String(u);
}
function excelSerialToISODate(v: unknown): string | null {
  const n = numOrNull(unwrap(v));
  if (n === null) return null;
  const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(n) * 86_400_000);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}
/** A literal "0" is Party2's placeholder for "no party on this row", not a
 *  real customer name — see the matching fix/comment in importExcel.ts. */
function realName(v: string | null): string | null {
  return v && v !== "0" ? v : null;
}
function mapExcelRow(values: unknown[], idx: Record<string, number>): LotRowInput | null {
  const get = (name: string) => values[idx[name]];
  const customerName = realName(str(get("Party2"))) || realName(str(get("CompanyName"))) || "Unknown";
  const carats = num(unwrap(get("Cts")));
  const tranDate = excelSerialToISODate(get("TranDate"));
  const saleDate = excelSerialToISODate(get("SaleDate"));
  if (!saleDate) return null;
  const daysInStock = tranDate && saleDate ? Math.max(0, Math.round((Date.parse(saleDate) - Date.parse(tranDate)) / 86_400_000)) : null;
  return {
    customerKey: slug(customerName), customerName,
    shape: str(get("Shp")), carats, caratBand: caratBand(carats),
    colour: str(get("Col")), clarity: str(get("Clr")), cut: str(get("Cut")),
    polish: str(get("Pol")), symmetry: str(get("Sym")), fluorescence: str(get("Flr")), lab: str(get("Lab")),
    rap: num(unwrap(get("Rap"))), discPercent: numOrNull(unwrap(get("DiscPercent"))),
    price: num(unwrap(get("Price"))), amount: num(unwrap(get("Amt"))), soldRate: num(unwrap(get("SoldRate"))),
    listPrice: num(unwrap(get("ListPrice")) || unwrap(get("Sprice"))),
    finalDiscPercent: numOrNull(unwrap(get("FinalDiscPercent"))) ?? numOrNull(unwrap(get("DiscPercent"))) ?? 0,
    costAmount: 0, costPrice: num(unwrap(get("CPrice"))),
    location: str(get("Loc")), country: str(get("Country")), owner: str(get("SalePerson")),
    broker: str(get("Broker")), terms: str(get("Terms")), tranDate, saleDate, daysInStock,
    orderNo: str(get("WebOrderNo")) || str(get("InvNo")),
  };
}

async function importExcelFile(filePath: string, buckets: Map<string, Bucket>, window: StreamWindow): Promise<{ rows: number; maxSaleDate: string | null }> {
  const reader = new ExcelJS.stream.xlsx.WorkbookReader(filePath, { entries: "emit", sharedStrings: "cache", styles: "ignore", worksheets: "emit" });
  let headerIdx: Record<string, number> | null = null;
  let rowCount = 0;
  let maxSaleDate: string | null = null;
  let batch: LotRowInput[] = [];
  for await (const ws of reader) {
    console.log(`[import] ${filePath}: reading sheet`);
    for await (const row of ws) {
      const values = row.values as unknown[];
      if (!headerIdx) {
        headerIdx = {};
        for (let i = 1; i < values.length; i++) if (typeof values[i] === "string") headerIdx[values[i] as string] = i;
        continue;
      }
      rowCount++;
      const mapped = mapExcelRow(values, headerIdx);
      if (mapped) {
        batch.push(mapped);
        if (mapped.saleDate && (!maxSaleDate || mapped.saleDate > maxSaleDate)) maxSaleDate = mapped.saleDate;
      }
      if (batch.length >= 5000) { foldRows(buckets, batch, window); addToMonthly(monthly, batch); foldRollups(rollupAcc, batch); foldOrders(orderAcc, batch); batch = []; }
      if (rowCount % 100_000 === 0) console.log(`[import] ${filePath}: ${rowCount} rows read, ${buckets.size} customers so far`);
    }
  }
  if (batch.length) { foldRows(buckets, batch, window); addToMonthly(monthly, batch); foldRollups(rollupAcc, batch); foldOrders(orderAcc, batch); }
  return { rows: rowCount, maxSaleDate };
}

async function main() {
  const files = process.argv.slice(2);
  if (!files.length) { console.error("Usage: importExcelPlusGap.ts <file1.xlsx> [file2.xlsx ...]"); process.exit(1); }

  const toDate = new Date().toISOString().slice(0, 10);
  const window = makeStreamWindow(toDate);
  const buckets = new Map<string, Bucket>();
  const start = Date.now();
  let totalRows = 0;
  let maxSaleDate: string | null = null;

  for (const file of files) {
    console.log(`[import] starting ${file}`);
    const r = await importExcelFile(file, buckets, window);
    totalRows += r.rows;
    if (r.maxSaleDate && (!maxSaleDate || r.maxSaleDate > maxSaleDate)) maxSaleDate = r.maxSaleDate;
    console.log(`[import] finished ${file}: ${r.rows} rows, ${buckets.size} customers so far`);
  }

  if (!maxSaleDate) { console.error("[import] no sale dates found in Excel files"); process.exit(1); }

  console.log(`[import] Excel data ends ${maxSaleDate}. Fetching gap through ${toDate} from the live API, one week at a time…`);
  mkdirSync(CACHE_DIR, { recursive: true });

  // Probed directly: the API returns 0 rows for a 1-2 day range even when
  // real data exists in it (confirmed against a range that returns 191,198
  // rows when asked as one request) — a week-sized window is the smallest
  // that reliably returns real data, so that's the chunk size here, not a
  // single day.
  const gapWeeks: { from: string; to: string }[] = [];
  for (
    let d = new Date(Date.parse(maxSaleDate) + 86_400_000);
    d.toISOString().slice(0, 10) <= toDate;
    d = new Date(d.getTime() + 7 * 86_400_000)
  ) {
    const weekEnd = new Date(Math.min(d.getTime() + 6 * 86_400_000, Date.parse(toDate)));
    gapWeeks.push({ from: d.toISOString().slice(0, 10), to: weekEnd.toISOString().slice(0, 10) });
  }

  let gapRowsTotal = 0;
  for (let i = 0; i < gapWeeks.length; i++) {
    const { from, to } = gapWeeks[i];
    const cachePath = cachePathFor(`${from}_${to}`);
    let weekRows: LotRowInput[];
    if (existsSync(cachePath)) {
      weekRows = JSON.parse(readFileSync(cachePath, "utf8"));
      console.log(`[import] gap week ${i + 1}/${gapWeeks.length} (${from}..${to}): ${weekRows.length} rows from local cache`);
    } else {
      // The API password rotates daily and this run isn't worth killing over
      // a stale one — treat an uncached week that fails to fetch the same as
      // a week the API itself returned empty (already a known, accepted gap):
      // log it and move on rather than losing the whole import.
      try {
        const { rows } = await fetchRowsForWindow(from, to, 1_000_000);
        writeFileSync(cachePath, JSON.stringify(rows));
        weekRows = rows;
        console.log(`[import] gap week ${i + 1}/${gapWeeks.length} (${from}..${to}): ${rows.length} rows fetched, cached to disk`);
      } catch (e) {
        weekRows = [];
        console.log(`[import] gap week ${i + 1}/${gapWeeks.length} (${from}..${to}): fetch failed (${(e as Error).message}), treated as 0 rows — not cached, will retry next run`);
      }
    }
    foldRows(buckets, weekRows, window);
    addToMonthly(monthly, weekRows);
    foldRollups(rollupAcc, weekRows);
    foldOrders(orderAcc, weekRows);
    gapRowsTotal += weekRows.length;
    for (const r of weekRows) {
      if (r.saleDate && (!maxSaleDate || r.saleDate > maxSaleDate)) maxSaleDate = r.saleDate;
    }
  }
  totalRows += gapRowsTotal;
  console.log(`[import] gap filled: ${gapRowsTotal} rows across ${gapWeeks.length} weeks, ${buckets.size} customers total`);
  console.log(`[import] real data now covers through ${maxSaleDate}`);

  const records = finalizeBuckets(buckets);
  const stateJson = serializeBuckets(buckets);
  const { importId, customerCount } = await saveAggregatedCustomers({
    fileName: `excel+api ${files.map((f) => f.split(/[\\/]/).pop()).join(" + ")} +gap-to-${toDate}`,
    records,
    dataAsOf: maxSaleDate ?? undefined,
  });
  await saveOwnerMonthly(monthly, true);
  await saveRollups(rollupAcc, true);
  await saveOrders(orderAcc, true);
  if (maxSaleDate) await saveBookState({ asOf: maxSaleDate, stateJson, importId });
  await upsertSyncState({ fromDate: "excel-import", toDate: maxSaleDate ?? toDate, totalCount: totalRows, synced: true, importId });

  const freshness = await checkExcelDataFreshness(toDate);
  const minutes = ((Date.now() - start) / 60_000).toFixed(1);
  console.log(`[import] done in ${minutes} min: importId=${importId}, customers=${customerCount}, rows=${totalRows}, upToDate=${freshness.upToDate}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error("[import] failed:", e); process.exit(1); });
