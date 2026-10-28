import "server-only";

import { fetchRowsForWindow } from "./sync";
import { saveAggregatedCustomers, upsertSyncState } from "@/lib/db/repository";
import { makeStreamWindow, foldRows, finalizeBuckets, type Bucket } from "./streamAggregate";

/**
 * One-time full historical backfill — fetches every row the Trade Data API
 * has (2015-01-01 through today) and aggregates it into customer_rows + one
 * snapshot. Raw lot_rows are deliberately never persisted (2.47M rows is
 * more than a free-tier database should hold, and nothing in the app queries
 * lot-level data).
 *
 * Fetched one calendar month at a time — probed directly, the API takes
 * 150s+ to answer a single page across an 11-year range, but answers a
 * 30-day window in under a second.
 *
 * Streams each month's rows into a running per-customer bucket
 * (lib/tradeapi/streamAggregate.ts) immediately after fetching, then
 * discards them — see that file's comment for why (this held every row for
 * the whole ~90+ minute run in an earlier version and got killed twice by
 * Claude Code's own low-memory safeguard).
 *
 * Superseded for practical purposes by lib/tradeapi/importExcel.ts once the
 * direct Excel exports turned out to cover the same real sales history at a
 * fraction of the time and with no API rate limit — kept for whenever a
 * fresh API-only backfill is actually needed again.
 *
 * Run: npx tsx --conditions react-server --env-file .env.local lib/tradeapi/backfill.ts
 */

function monthWindows(fromDate: string, toDate: string): { from: string; to: string }[] {
  const windows: { from: string; to: string }[] = [];
  const end = new Date(toDate);
  let cursor = new Date(fromDate);

  while (cursor <= end) {
    const monthStart = new Date(cursor);
    const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0); // last day of month
    windows.push({
      from: monthStart.toISOString().slice(0, 10),
      to: (monthEnd > end ? end : monthEnd).toISOString().slice(0, 10),
    });
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }
  return windows;
}

async function main() {
  const fromDate = "2015-01-01";
  const toDate = new Date().toISOString().slice(0, 10);
  const windows = monthWindows(fromDate, toDate);
  const window = makeStreamWindow(toDate);

  console.log(`[backfill] starting: ${fromDate}..${toDate} across ${windows.length} monthly windows, streaming aggregation`);
  const start = Date.now();

  const buckets = new Map<string, Bucket>();
  const failedWindows: string[] = [];
  let totalRows = 0;
  let totalPages = 0;

  for (let i = 0; i < windows.length; i++) {
    const { from, to } = windows[i];
    const windowStart = Date.now();
    try {
      const { rows, totalAvailable, pagesFetched } = await fetchRowsForWindow(from, to, 1_000_000, (pages, rowsSoFar, total) => {
        if (pages % 20 === 0) console.log(`[backfill]   ...window ${i + 1}/${windows.length}: page ${pages}, ${rowsSoFar}/${total} rows so far`);
      });
      foldRows(buckets, rows, window);
      totalRows += rows.length;
      totalPages += pagesFetched;
      // `rows` goes out of scope here — nothing keeps a reference past this
      // point, so it's free for GC before the next month's fetch begins.
      const elapsedMin = ((Date.now() - start) / 60_000).toFixed(1);
      console.log(
        `[backfill] window ${i + 1}/${windows.length} (${from}..${to}): ${rows.length}/${totalAvailable} rows folded, ` +
          `${((Date.now() - windowStart) / 1000).toFixed(1)}s — running total ${totalRows} rows, ${buckets.size} customers, ${elapsedMin} min elapsed`,
      );
    } catch (e) {
      failedWindows.push(`${from}..${to}`);
      console.error(`[backfill] window ${i + 1}/${windows.length} (${from}..${to}) FAILED, skipping:`, e instanceof Error ? e.message : e);
    }
  }

  if (failedWindows.length) {
    console.log(`[backfill] ${failedWindows.length} window(s) failed and were skipped: ${failedWindows.join(", ")}`);
  }
  console.log(`[backfill] all windows fetched: ${totalRows} rows across ${totalPages} pages, ${buckets.size} customers. Finalizing…`);

  const records = finalizeBuckets(buckets);
  const { importId, customerCount } = await saveAggregatedCustomers({
    fileName: `tradeapi-api ${fromDate}..${toDate}`,
    records,
  });
  await upsertSyncState({ fromDate, toDate, totalCount: totalRows, synced: true, importId });

  const minutes = ((Date.now() - start) / 60_000).toFixed(1);
  console.log(`[backfill] done in ${minutes} min: importId=${importId}, customers=${customerCount}, rows=${totalRows}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("[backfill] failed:", e);
    process.exit(1);
  });
