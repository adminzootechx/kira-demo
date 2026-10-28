import { NextResponse } from "next/server";
import { isDatabaseAvailable } from "@/lib/db/client";
import { syncLotRows } from "@/lib/tradeapi/sync";
import { rateLimitStatus } from "@/lib/tradeapi/rateLimiter";
import { logError } from "@/lib/errorCodes";

export const dynamic = "force-dynamic";
/** Pagination + rate limiting mean a large window can take a while. */
export const maxDuration = 300;

/**
 * Pulls sales data from the Trade Data API for a date range and writes it
 * into `lot_rows`. Body: { fromDate, toDate, maxRows? } (YYYY-MM-DD).
 */
export async function POST(request: Request) {
  if (!(await isDatabaseAvailable())) {
    return NextResponse.json({ error: "Database unavailable. (LUSTRE-DATA-1)" }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
  const { fromDate, toDate, maxRows } = body as { fromDate?: string; toDate?: string; maxRows?: number };
  if (!fromDate || !toDate) {
    return NextResponse.json({ error: "fromDate and toDate are required (YYYY-MM-DD)." }, { status: 400 });
  }

  try {
    const result = await syncLotRows({ fromDate, toDate, maxRows });
    return NextResponse.json({ ...result, rateLimit: rateLimitStatus() });
  } catch (error) {
    logError("LUSTRE-SYNC-2", "api/tradeapi/sync", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sync failed.", rateLimit: rateLimitStatus() },
      { status: 502 },
    );
  }
}
