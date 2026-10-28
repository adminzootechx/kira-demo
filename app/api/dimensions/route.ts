import { NextResponse } from "next/server";
import { isDatabaseAvailable } from "@/lib/db/client";
import { getDimensions } from "@/lib/db/dimensions";
import { snapshotDimensions } from "@/lib/data/snapshot";

/** Rollups change whenever the active import changes. */
export const dynamic = "force-dynamic";

/** Specification, price, salesperson, location and monthly rollups from the live database. */
export async function GET() {
  if (await isDatabaseAvailable()) {
    try {
      const dimensions = await getDimensions();
      if (dimensions) return NextResponse.json({ dimensions, database: "connected" });
    } catch (error) {
      console.error("[api/dimensions]", error);
    }
  }
  const dimensions = snapshotDimensions();
  return NextResponse.json({ dimensions, database: dimensions ? "snapshot" : "unavailable" });
}
