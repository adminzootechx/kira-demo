import "server-only";

import { eq } from "drizzle-orm";
import { getDb, isDatabaseAvailable } from "@/lib/db/client";
import { imports } from "@/lib/db/schema";
import {
  addToMonthly, claimBookState, deleteImport, releaseBookStateClaim, saveAggregatedCustomers, saveBookState, saveOrders, saveOwnerMonthly, saveRollups,
} from "@/lib/db/repository";
import { logError } from "@/lib/errorCodes";
import { signInWithPasskey } from "./client";
import { fetchRowsForWindow } from "./sync";
import { foldRollups, type RollupAcc } from "./rollupFold";
import { foldOrders, type OrderAcc } from "./orderFold";
import {
  deserializeBuckets, finalizeBuckets, foldRows, makeStreamWindow, serializeBuckets,
} from "./streamAggregate";

/** How long a freshness check stays valid before the next login/startup re-checks. */
const CHECK_EVERY_HOURS = 6;
/** The API returns nothing for 1-2 day ranges even when data exists, so the
 *  smallest window that reliably returns real data is a week. */
const WINDOW_DAYS = 7;
const DAY = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export type AutoSyncResult =
  | { status: "unavailable" | "no-baseline" | "recent" | "up-to-date" }
  | { status: "updated"; from: string; through: string; rows: number }
  | { status: "failed"; error: string };

let inFlight: Promise<AutoSyncResult> | null = null;

/**
 * Checks the date the book is current through and fetches whatever the API
 * has after it. Called on server start, on every login, and by the daily
 * cron (`force`). The DB claim in `claimBookState` keeps it to one check per
 * CHECK_EVERY_HOURS across all instances, so calling it often is cheap.
 *
 * Needs a baseline: the full Excel import saves one (`importExcelPlusGap.ts`).
 * Without it there is nothing to top up, so this does nothing.
 *
 * ponytail: the 365-day windows are fixed at the baseline's date and only new
 * rows are added, so ytd drifts up by roughly the sales that aged out since.
 * Re-run the Excel import to reset it, or store per-day revenue to slide it.
 */
export function ensureFresh(opts: { force?: boolean; passkey?: string } = {}): Promise<AutoSyncResult> {
  inFlight ??= run(opts.force ?? false, opts.passkey).finally(() => { inFlight = null; });
  return inFlight;
}

async function run(force: boolean, passkey?: string): Promise<AutoSyncResult> {
  if (!(await isDatabaseAvailable())) return { status: "unavailable" };
  const claimed = await claimBookState(CHECK_EVERY_HOURS, force).catch(() => null);
  if (!claimed) return { status: "recent" };

  try {
    if (passkey) await signInWithPasskey(passkey);
    const today = iso(Date.now());
    let from = iso(Date.parse(claimed.as_of) + DAY);
    if (from > today) return { status: "up-to-date" };

    const buckets = deserializeBuckets(JSON.stringify(claimed.state));
    let through = claimed.as_of;
    let rows = 0;
    const fetched: Awaited<ReturnType<typeof fetchRowsForWindow>>["rows"] = [];
    while (from <= today) {
      const to = iso(Math.min(Date.parse(from) + (WINDOW_DAYS - 1) * DAY, Date.parse(today)));
      const res = await fetchRowsForWindow(from, to, 1_000_000);
      fetched.push(...res.rows);
      from = iso(Date.parse(to) + DAY);
    }
    for (const r of fetched) if (r.saleDate && r.saleDate > through) through = r.saleDate;
    rows = fetched.length;
    if (!rows || through === claimed.as_of) return { status: "up-to-date" };

    foldRows(buckets, fetched, makeStreamWindow(through));
    const { importId } = await saveAggregatedCustomers({
      fileName: `auto-sync through ${through}`,
      records: finalizeBuckets(buckets),
      dataAsOf: through,
    });
    const monthly = new Map<string, number>();
    addToMonthly(monthly, fetched);
    await saveOwnerMonthly(monthly, false);
    const rollupAcc: RollupAcc = new Map();
    foldRollups(rollupAcc, fetched);
    await saveRollups(rollupAcc, false);
    const orderAcc: OrderAcc = new Map();
    foldOrders(orderAcc, fetched);
    await saveOrders(orderAcc, false);
    await saveBookState({ asOf: through, stateJson: serializeBuckets(buckets), importId });
    // Only superseded auto-syncs are pruned; the Excel baseline import stays.
    if (claimed.import_id) {
      const [prev] = await getDb().select({ name: imports.fileName }).from(imports).where(eq(imports.id, claimed.import_id));
      if (prev?.name.startsWith("auto-sync")) await deleteImport(claimed.import_id).catch(() => {});
    }
    return { status: "updated", from: iso(Date.parse(claimed.as_of) + DAY), through, rows };
  } catch (error) {
    logError("LUSTRE-SYNC-2", "autoSync.ensureFresh", error);
    await releaseBookStateClaim(CHECK_EVERY_HOURS).catch(() => {});
    return { status: "failed", error: error instanceof Error ? error.message : "Sync failed." };
  }
}
