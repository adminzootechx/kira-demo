import { NextResponse } from "next/server";
import { ensureFresh } from "@/lib/tradeapi/autoSync";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Vercel Cron target. Forces the same top-up that runs on server start and on
 * login (lib/tradeapi/autoSync.ts): fetch what the API has after the book's
 * as-of date and fold it into the existing totals. Requires CRON_SECRET.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Not authorized. (LUSTRE-AUTH-2)" }, { status: 403 });
  }

  const result = await ensureFresh({ force: true });
  return NextResponse.json(result, { status: result.status === "failed" ? 502 : 200 });
}
