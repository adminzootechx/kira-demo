import { NextResponse } from "next/server";
import { isDatabaseAvailable } from "@/lib/db/client";
import { getPortfolioTrend, listSnapshots } from "@/lib/db/repository";

export const dynamic = "force-dynamic";

/** Snapshot history and the movement between the two most recent runs. */
export async function GET() {
  if (!(await isDatabaseAvailable())) {
    return NextResponse.json({ snapshots: [], trend: null, database: "unavailable" });
  }
  const [snapshots, trend] = await Promise.all([listSnapshots(), getPortfolioTrend()]);
  return NextResponse.json({ snapshots, trend, database: "connected" });
}
