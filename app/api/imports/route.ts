import { NextResponse } from "next/server";
import { isDatabaseAvailable } from "@/lib/db/client";
import { getStorageStats, listImports, saveImport } from "@/lib/db/repository";
import type { CustomerSource } from "@/lib/analytics/customer";
import { logError } from "@/lib/errorCodes";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isDatabaseAvailable())) {
    return NextResponse.json({ imports: [], stats: null, database: "unavailable" });
  }
  const [imports, stats] = await Promise.all([listImports(), getStorageStats()]);
  return NextResponse.json({ imports, stats, database: "connected" });
}

/**
 * Stores a parsed import. The CSV is parsed in the browser so the user can
 * review and remap columns before anything is written; this endpoint receives
 * the reviewed records.
 */
export async function POST(request: Request) {
  if (!(await isDatabaseAvailable())) {
    return NextResponse.json(
      { error: "Database unavailable. Check DATABASE_URL in .env.local. (LUSTRE-DATA-1)" },
      { status: 503 },
    );
  }

  let payload: {
    fileName?: string;
    records?: CustomerSource[];
    columnMapping?: Record<string, number>;
    assumedFields?: string[];
    issues?: { row: number; field: string; message: string }[];
    skippedCount?: number;
  };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Body was not valid JSON." }, { status: 400 });
  }

  if (!Array.isArray(payload.records) || payload.records.length === 0) {
    return NextResponse.json({ error: "No records to import." }, { status: 400 });
  }
  if (payload.records.length > 50_000) {
    return NextResponse.json(
      { error: "Imports are capped at 50,000 customers per file." },
      { status: 413 },
    );
  }

  try {
    const result = await saveImport({
      fileName: payload.fileName ?? "upload.csv",
      records: payload.records,
      columnMapping: payload.columnMapping,
      assumedFields: payload.assumedFields,
      issues: payload.issues,
      skippedCount: payload.skippedCount,
    });
    return NextResponse.json({ ...result, ok: true }, { status: 201 });
  } catch (error) {
    logError("LUSTRE-IMPORT-1", "api/imports POST", error);
    return NextResponse.json({ error: "Could not store the import. (LUSTRE-IMPORT-1)" }, { status: 500 });
  }
}
