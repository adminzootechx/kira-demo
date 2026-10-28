import { NextResponse } from "next/server";
import { checkFreshness, syncLotRows } from "@/lib/tradeapi/sync";
import { rateLimitStatus } from "@/lib/tradeapi/rateLimiter";
import { isDatabaseAvailable } from "@/lib/db/client";
import { logError } from "@/lib/errorCodes";

export const dynamic = "force-dynamic";

/**
 * Cheap freshness check: one small request compares the API's current
 * TotalCount against what was last seen for this window. Only syncs (the
 * expensive multi-page pull) when it actually changed — this is meant to be
 * called occasionally, not on a timer or on every page load.
 *
 * Body: { fromDate, toDate, autoSync?, maxRows? } (YYYY-MM-DD).
 */
export async function POST(request: Request) {
  if (!(await isDatabaseAvailable())) {
    return NextResponse.json({ error: "Database unavailable. (LUSTRE-DATA-1)" }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
  const { fromDate, toDate, autoSync, maxRows } = body as {
    fromDate?: string;
    toDate?: string;
    autoSync?: boolean;
    maxRows?: number;
  };
  if (!fromDate || !toDate) {
    return NextResponse.json({ error: "fromDate and toDate are required (YYYY-MM-DD)." }, { status: 400 });
  }

  try {
    const freshness = await checkFreshness(fromDate, toDate);
    if (!freshness.changed || !autoSync) {
      return NextResponse.json({ freshness, synced: false, rateLimit: rateLimitStatus() });
    }

    const sync = await syncLotRows({ fromDate, toDate, maxRows });
    return NextResponse.json({ freshness, synced: true, sync, rateLimit: rateLimitStatus() });
  } catch (error) {
    logError("LUSTRE-SYNC-2", "api/tradeapi/check", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Check failed.", rateLimit: rateLimitStatus() },
      { status: 502 },
    );
  }
}
