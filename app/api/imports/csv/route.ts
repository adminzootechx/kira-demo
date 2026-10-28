import { NextResponse } from "next/server";
import { isDatabaseAvailable } from "@/lib/db/client";
import { saveImport } from "@/lib/db/repository";
import { autoMapColumns, buildRecords, parseCsv, unmappedFields } from "@/lib/data/csv";
import { logError } from "@/lib/errorCodes";

export const dynamic = "force-dynamic";
/** A full customer book is a few thousand rows; the default budget is short. */
export const maxDuration = 300;

/**
 * Imports a customer-grain CSV that is already prepared, parsing it on the
 * server.
 *
 * The `/data` page parses in the browser so a person can review and remap the
 * columns before anything is written, and that is the right flow for a file
 * someone is looking at. It is the wrong flow for a prepared export: LUSTRE's
 * own lot-wise workbooks are 3.3 GB of XML, and the rollup that comes out of
 * `data-samples/sale_data_ingest.py` is written by a script that already knows
 * its own column names. This is the non-interactive door for that case, and it
 * runs the same parse, the same mapping and the same `saveImport` as the page.
 *
 * Send the CSV as the request body with `Content-Type: text/csv`.
 */
export async function POST(request: Request) {
  if (!(await isDatabaseAvailable())) {
    return NextResponse.json({ error: "Database unavailable. (LUSTRE-DATA-1)" }, { status: 503 });
  }

  const text = await request.text();
  if (!text.trim()) {
    return NextResponse.json({ error: "Body was empty. (LUSTRE-IMPORT-1)" }, { status: 400 });
  }

  const rows = parseCsv(text);
  if (rows.length < 2) {
    return NextResponse.json({ error: "CSV has no data rows. (LUSTRE-IMPORT-1)" }, { status: 400 });
  }

  const mapping = autoMapColumns(rows[0]);
  if (mapping.name === undefined || mapping.ytd === undefined) {
    return NextResponse.json(
      { error: "Could not find a customer name and a revenue column. (LUSTRE-IMPORT-1)", headers: rows[0] },
      { status: 422 },
    );
  }

  const built = buildRecords(rows, mapping);
  if (!built.records.length) {
    return NextResponse.json({ error: "No row produced a usable record. (LUSTRE-IMPORT-1)" }, { status: 422 });
  }

  const fileName = new URL(request.url).searchParams.get("fileName") ?? "import.csv";
  try {
    const result = await saveImport({
      fileName,
      records: built.records,
      columnMapping: mapping,
      assumedFields: unmappedFields(mapping).map((f) => f.label),
      issues: built.issues,
      skippedCount: built.skipped,
    });
    return NextResponse.json(
      {
        ...result,
        ok: true,
        customers: built.records.length,
        skipped: built.skipped,
        mapped: Object.keys(mapping),
        assumed: unmappedFields(mapping).map((f) => f.label),
      },
      { status: 201 },
    );
  } catch (error) {
    logError("LUSTRE-IMPORT-1", "api/imports/csv", error);
    return NextResponse.json({ error: "Could not store the import. (LUSTRE-IMPORT-1)" }, { status: 500 });
  }
}
