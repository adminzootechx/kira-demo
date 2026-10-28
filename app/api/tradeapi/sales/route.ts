import { NextResponse } from "next/server";
import { fetchSalesData } from "@/lib/tradeapi/client";
import { rateLimitStatus } from "@/lib/tradeapi/rateLimiter";

export const dynamic = "force-dynamic";

/**
 * Live preview endpoint — pulls a small page from api.example.com so the
 * dashboard can show it's actually connected. Not the full sync pipeline
 * (no DB write yet); rate-limited the same as every other call to this API.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rows = Math.min(Number(searchParams.get("rows") ?? 10), 50);
  const today = new Date();
  const from = new Date(today);
  from.setDate(from.getDate() - 30);
  const toDate = today.toISOString().slice(0, 10);
  const fromDate = from.toISOString().slice(0, 10);

  try {
    const result = await fetchSalesData({ startRow: 1, endRow: rows, fromDate, toDate });
    return NextResponse.json({ ...result, rateLimit: rateLimitStatus(), fromDate, toDate });
  } catch (error) {
    console.error("[api/tradeapi/sales]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Request failed", rateLimit: rateLimitStatus() },
      { status: 502 },
    );
  }
}
