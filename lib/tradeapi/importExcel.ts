import "server-only";

import ExcelJS from "exceljs";
import { saveAggregatedCustomers, upsertSyncState, type LotRowInput } from "@/lib/db/repository";
import { makeStreamWindow, foldRows, finalizeBuckets, type Bucket, type StreamWindow } from "./streamAggregate";
import { checkExcelDataFreshness } from "./sync";

/**
 * Direct import from LUSTRE's own "Sale Data" Excel exports — same raw fields
 * as the Trade Data API (StoneNo, Shp, Cts, TranDate, SaleDate, Party2, ...),
 * already sitting on disk. Confirmed with the user this is the full real
 * sales history as far as they know; the API's own reported total (2.47M)
 * is roughly double the two files' combined row count (1.24M), most likely
 * because the API returns every stone record regardless of status, not only
 * completed sales — these files are already sales-only.
 *
 * Reads with ExcelJS's streaming WorkbookReader, not the more common
 * XLSX/SheetJS whole-file parser: each file's single worksheet is a ~1.4GB
 * uncompressed XML blob (confirmed by inspecting the .xlsx zip directly),
 * and SheetJS's DOM-style parser either fails outright or returns an empty
 * sheet at that size. ExcelJS's stream reader processes one row at a time
 * without ever holding the whole sheet in memory.
 *
 * Run: npx tsx --conditions react-server --env-file .env.local lib/tradeapi/importExcel.ts "<file1>" "<file2>" ...
 */

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
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "unknown"
  );
}

/** Some cells in these exports are stored as formulas (e.g. `="4.09"`, to
 *  force a number to render as text) — ExcelJS gives those back as
 *  `{formula, result}` instead of a plain value. */
function unwrap(v: unknown): unknown {
  if (v && typeof v === "object" && "result" in (v as Record<string, unknown>)) {
    return (v as { result: unknown }).result;
  }
  return v;
}

function str(v: unknown): string | null {
  const u = unwrap(v);
  if (u === null || u === undefined || u === "") return null;
  return String(u);
}

/** Excel's date epoch is 1899-12-30 (its famous off-by-two leap-year bug),
 *  stored as a serial day count with a fractional time-of-day component.
 *  These files store dates as raw numbers rather than formatted date cells,
 *  so ExcelJS hands them back as plain numbers, not Date objects. */
function excelSerialToISODate(v: unknown): string | null {
  const n = numOrNull(unwrap(v));
  if (n === null) return null;
  const ms = Date.UTC(1899, 11, 30) + Math.floor(n) * 86_400_000;
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

/** A literal "0" is Party2's placeholder for "no party on this row", not a
 *  real customer name — `str("0")` is truthy so `||` alone doesn't fall
 *  through to CompanyName. Found via a direct Excel-vs-Neon revenue check:
 *  it was lumping ~13k of one salesperson's rows under a fake customer "0". */
function realName(v: string | null): string | null {
  return v && v !== "0" ? v : null;
}

function mapExcelRow(values: unknown[], idx: Record<string, number>): LotRowInput | null {
  const get = (name: string) => values[idx[name]];
  const customerName = realName(str(get("Party2"))) || realName(str(get("CompanyName"))) || "Unknown";
  const carats = num(unwrap(get("Cts")));
  const tranDate = excelSerialToISODate(get("TranDate"));
  const saleDate = excelSerialToISODate(get("SaleDate"));
  if (!saleDate) return null; // mirrors mapRow/aggregateCustomers: no usable sale date, row dropped
  const daysInStock =
    tranDate && saleDate
      ? Math.max(0, Math.round((Date.parse(saleDate) - Date.parse(tranDate)) / 86_400_000))
      : null;

  return {
    customerKey: slug(customerName),
    customerName,
    shape: str(get("Shp")),
    carats,
    caratBand: caratBand(carats),
    colour: str(get("Col")),
    clarity: str(get("Clr")),
    cut: str(get("Cut")),
    polish: str(get("Pol")),
    symmetry: str(get("Sym")),
    fluorescence: str(get("Flr")),
    lab: str(get("Lab")),
    rap: num(unwrap(get("Rap"))),
    discPercent: numOrNull(unwrap(get("DiscPercent"))),
    price: num(unwrap(get("Price"))),
    amount: num(unwrap(get("Amt"))),
    soldRate: num(unwrap(get("SoldRate"))),
    listPrice: num(unwrap(get("ListPrice")) || unwrap(get("Sprice"))),
    finalDiscPercent: numOrNull(unwrap(get("FinalDiscPercent"))) ?? numOrNull(unwrap(get("DiscPercent"))) ?? 0,
    costAmount: 0,
    costPrice: num(unwrap(get("CPrice"))),
    location: str(get("Loc")),
    country: str(get("Country")),
    owner: str(get("SalePerson")),
    broker: str(get("Broker")),
    terms: str(get("Terms")),
    tranDate,
    saleDate,
    daysInStock,
    orderNo: str(get("WebOrderNo")) || str(get("InvNo")),
  };
}

async function importFile(filePath: string, buckets: Map<string, Bucket>, window: StreamWindow): Promise<{ rows: number; dropped: number; maxSaleDate: string | null }> {
  const reader = new ExcelJS.stream.xlsx.WorkbookReader(filePath, {
    entries: "emit",
    sharedStrings: "cache",
    styles: "ignore",
    worksheets: "emit",
  });

  let headerIdx: Record<string, number> | null = null;
  let rowCount = 0;
  let dropped = 0;
  let maxSaleDate: string | null = null;
  let batch: LotRowInput[] = [];
  const BATCH_SIZE = 5000;

  for await (const worksheetReader of reader) {
    console.log(`[import] ${filePath}: reading sheet`);
    for await (const row of worksheetReader) {
      const values = row.values as unknown[];
      if (!headerIdx) {
        headerIdx = {};
        for (let i = 1; i < values.length; i++) {
          const name = values[i];
          if (typeof name === "string") headerIdx[name] = i;
        }
        continue;
      }
      rowCount++;
      const mapped = mapExcelRow(values, headerIdx);
      if (mapped) {
        batch.push(mapped);
        if (mapped.saleDate && (!maxSaleDate || mapped.saleDate > maxSaleDate)) maxSaleDate = mapped.saleDate;
      } else {
        dropped++;
      }
      if (batch.length >= BATCH_SIZE) {
        foldRows(buckets, batch, window);
        batch = [];
      }
      if (rowCount % 100_000 === 0) {
        console.log(`[import] ${filePath}: ${rowCount} rows read, ${buckets.size} customers so far`);
      }
    }
  }
  if (batch.length) foldRows(buckets, batch, window);

  return { rows: rowCount, dropped, maxSaleDate };
}

async function main() {
  const files = process.argv.slice(2);
  if (!files.length) {
    console.error("Usage: importExcel.ts <file1.xlsx> [file2.xlsx ...]");
    process.exit(1);
  }

  const toDate = new Date().toISOString().slice(0, 10);
  const window = makeStreamWindow(toDate);
  const buckets = new Map<string, Bucket>();
  const start = Date.now();
  let totalRows = 0;
  let totalDropped = 0;
  let maxSaleDate: string | null = null;

  for (const file of files) {
    console.log(`[import] starting ${file}`);
    const result = await importFile(file, buckets, window);
    totalRows += result.rows;
    totalDropped += result.dropped;
    if (result.maxSaleDate && (!maxSaleDate || result.maxSaleDate > maxSaleDate)) maxSaleDate = result.maxSaleDate;
    console.log(`[import] finished ${file}: ${result.rows} rows (${result.dropped} dropped, no sale date), ${buckets.size} customers so far`);
  }

  console.log(`[import] all files read: ${totalRows} rows (${totalDropped} dropped), ${buckets.size} customers. Finalizing…`);

  const records = finalizeBuckets(buckets);
  const { importId, customerCount } = await saveAggregatedCustomers({
    fileName: `excel-import ${files.map((f) => f.split(/[\\/]/).pop()).join(" + ")}`,
    records,
    dataAsOf: maxSaleDate ?? undefined,
  });
  // toDate here is the Excel data's own last real sale date, not "today" —
  // that's what a freshness check needs to compare against the live API.
  await upsertSyncState({ fromDate: "excel-import", toDate: maxSaleDate ?? toDate, totalCount: totalRows, synced: true, importId });

  const minutes = ((Date.now() - start) / 60_000).toFixed(1);
  console.log(`[import] done in ${minutes} min: importId=${importId}, customers=${customerCount}, rows=${totalRows}, dataAsOf=${maxSaleDate}`);

  if (maxSaleDate) {
    const freshness = await checkExcelDataFreshness(maxSaleDate);
    if (freshness.upToDate) {
      console.log(`[import] freshness check: up to date through ${freshness.checkedThrough} — API has no rows after ${maxSaleDate}`);
    } else {
      console.log(
        `[import] freshness check: STALE — the API reports ${freshness.newRowsAvailable} row(s) after ${maxSaleDate} ` +
          `(through ${freshness.checkedThrough}) that this Excel export does not contain. A newer export is needed.`,
      );
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("[import] failed:", e);
    process.exit(1);
  });
