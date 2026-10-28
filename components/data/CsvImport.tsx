"use client";

import { useRef, useState } from "react";
import { AlertTriangle, Check, FileUp, Table2, Upload } from "lucide-react";
import {
  autoMapColumns, buildRecords, customerFields, parseCsv, unmappedFields,
  type ImportResult,
} from "@/lib/data/csv";
import { refreshBook, useCustomerBook } from "@/lib/data/store";
import { Badge, Card, CardBody, CardHeader, DataNote, Table, Td, Th } from "@/components/ui/primitives";

type Staged = {
  fileName: string;
  headers: string[];
  rows: string[][];
  mapping: Record<string, number>;
  result: ImportResult;
};

const MAX_BYTES = 8 * 1024 * 1024;

export default function CsvImport({ onChanged }: { onChanged?: () => void }) {
  const { meta, database, isLoading } = useCustomerBook();
  const [busy, setBusy] = useState(false);
  const [staged, setStaged] = useState<Staged | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const ingest = async (file: File) => {
    setError(null);
    setSaved(false);

    if (file.size > MAX_BYTES) {
      setError(`${file.name} is ${(file.size / 1_048_576).toFixed(1)}MB, above the ${MAX_BYTES / 1_048_576}MB upload limit. Split the export, or raise the limit if the server can take it.`);
      return;
    }

    const text = await file.text();
    const rows = parseCsv(text);
    if (rows.length < 2) {
      setError("That file has no data rows below the header.");
      return;
    }

    const headers = rows[0].map((h) => h.trim());
    const mapping = autoMapColumns(headers);
    if (mapping.name === undefined || mapping.ytd === undefined) {
      setError(
        "Could not find a customer name and a revenue column. Map them below, or rename the headers in the export.",
      );
    }
    setStaged({ fileName: file.name, headers, rows, mapping, result: buildRecords(rows, mapping) });
  };

  const remap = (fieldKey: string, headerIndex: number | undefined) => {
    if (!staged) return;
    const mapping = { ...staged.mapping };
    if (headerIndex === undefined) delete mapping[fieldKey];
    else mapping[fieldKey] = headerIndex;
    setStaged({ ...staged, mapping, result: buildRecords(staged.rows, mapping) });
    setError(null);
  };

  const apply = async () => {
    if (!staged) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/imports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fileName: staged.fileName,
          records: staged.result.records,
          columnMapping: staged.mapping,
          assumedFields: unmappedFields(staged.mapping).map((f) => f.label),
          issues: staged.result.issues,
          skippedCount: staged.result.skipped,
        }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "The server rejected the import.");
        return;
      }
      setStaged(null);
      setSaved(true);
      refreshBook();
      onChanged?.();
    } catch {
      setError("Could not reach the server. Check that the app and database are running.");
    } finally {
      setBusy(false);
    }
  };

  const canApply = Boolean(staged && staged.result.records.length > 0);

  return (
    <div className="space-y-6">
      {/* Current source ------------------------------------------- */}
      <Card>
        <CardHeader
          icon={<Table2 size={16} />}
          title="Active data source"
          help="Every figure on the Customers pages comes from whichever import is switched on. Your original rows are kept exactly as you sent them and the scores are worked out fresh each time, so improving a calculation updates the numbers without you re-sending the file."
          subtitle={
            meta
              ? `${meta.rowCount.toLocaleString()} customers from ${meta.fileName}`
              : isLoading
                ? "Checking the database…"
                : "Representative Phase-1 sample data (nothing stored yet)"
          }
          action={
            <Badge
              tone={
                database === "connected"
                  ? "positive"
                  : database === "snapshot"
                    ? "accent"
                    : database === "unknown"
                      ? "neutral"
                      : "warn"
              }
            >
              {database === "connected"
                ? "Database connected"
                : database === "snapshot"
                  ? "Read-only snapshot"
                  : database === "unknown"
                    ? "Checking…"
                    : "Database unavailable"}
            </Badge>
          }
        />
        {meta && (
          <CardBody className="space-y-3">
            <p className="text-[13px] text-navy-muted">
              Imported {new Date(meta.importedAt).toLocaleString("en-GB")} · model{" "}
              {meta.modelVersion} · rows stored in Postgres and re-scored on every read.
            </p>
            {meta.assumedFields.length > 0 && (
              <p className="text-[12.5px] leading-relaxed text-muted-foreground">
                <span className="font-semibold text-warn">Assumed defaults for:</span>{" "}
                {meta.assumedFields.join(", ")}. Supplying these columns will sharpen the scores.
              </p>
            )}
          </CardBody>
        )}
      </Card>

      {/* Picker ---------------------------------------------------- */}
      <Card>
        <CardHeader
          title="Import a CSV export"
          help="Column names are matched automatically against common ERP headers. Anything unmatched can be mapped by hand below before you apply the import."
          subtitle="Customer name and a revenue column are required. Everything else improves accuracy but is optional."
        />
        <CardBody className="space-y-5">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const file = e.dataTransfer.files?.[0];
              if (file) void ingest(file);
            }}
            className={`flex flex-col items-center justify-center rounded-[9px] border border-dashed px-6 py-10 text-center transition-colors ${
              dragging ? "border-accent bg-accent-bg" : "border-border bg-secondary/30"
            }`}
          >
            <FileUp size={22} className="text-navy-muted" aria-hidden />
            <p className="mt-3 text-[14px] font-semibold text-navy">
              Drop a .csv file here, or choose one
            </p>
            <p className="mt-1.5 max-w-md text-[12.5px] leading-relaxed text-muted-foreground">
              Reviewed in the browser first, then stored in the platform database.
            </p>
            <button type="button" onClick={() => inputRef.current?.click()} className="btn btn-primary mt-4">
              <Upload size={14} />
              Choose file
            </button>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void ingest(file);
                e.target.value = "";
              }}
            />
          </div>

          {error && (
            <p className="flex items-start gap-2.5 rounded-[8px] border border-negative/20 bg-negative-bg p-3.5 text-[13px] leading-relaxed text-negative">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
              {error}
            </p>
          )}

          {saved && (
            <p className="flex items-center gap-2.5 rounded-[8px] border border-positive/20 bg-positive-bg p-3.5 text-[13px] font-semibold text-positive">
              <Check size={16} strokeWidth={3} aria-hidden />
              Import applied. The Customers pages are now running on your data.
            </p>
          )}

          <DataNote>
            The file is parsed in your browser so you can review and remap columns before anything
            is written. Applying the import stores the raw rows in Postgres and records a scored
            snapshot alongside them — the rows are the source of truth, and every score is
            rebuilt from them rather than being frozen at import time.
          </DataNote>
        </CardBody>
      </Card>

      {/* Mapping + preview ---------------------------------------- */}
      {staged && (
        <Card>
          <CardHeader
            title="Review before applying"
            subtitle={`${staged.result.records.length.toLocaleString()} of ${staged.result.totalRows.toLocaleString()} rows in ${staged.fileName} produced a usable record`}
            action={
              <div className="flex items-center gap-2.5">
                <button type="button" onClick={() => setStaged(null)} className="btn btn-secondary">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void apply()}
                  disabled={!canApply || busy}
                  className="btn btn-primary disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {busy ? "Storing…" : "Apply import"}
                </button>
              </div>
            }
          />

          <CardBody className="space-y-6">
            {staged.result.skipped > 0 && (
              <p className="flex items-start gap-2.5 rounded-[8px] border border-warn/20 bg-warn-bg p-3.5 text-[13px] leading-relaxed text-warn">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
                {staged.result.skipped.toLocaleString()} rows were skipped for missing a name or a
                revenue value.
              </p>
            )}

            <div>
              <p className="mb-3 text-[13.5px] font-semibold text-navy">Column mapping</p>
              <div className="grid gap-x-8 gap-y-3 md:grid-cols-2">
                {customerFields.map((field) => {
                  const index = staged.mapping[field.key];
                  return (
                    <label key={field.key} className="flex items-center justify-between gap-4">
                      <span className="min-w-0">
                        <span className="block text-[13px] font-medium text-navy">
                          {field.label}
                          {field.required && <span className="ml-1 text-negative">*</span>}
                        </span>
                        {field.hint && (
                          <span className="block text-[11.5px] leading-snug text-muted-foreground">
                            {field.hint}
                          </span>
                        )}
                      </span>
                      <select
                        value={index ?? ""}
                        onChange={(e) =>
                          remap(field.key, e.target.value === "" ? undefined : Number(e.target.value))
                        }
                        className={`h-9 w-[168px] shrink-0 cursor-pointer rounded-[6px] border bg-card px-2.5 text-[13px] outline-none transition-colors focus:border-accent ${
                          index === undefined && field.required
                            ? "border-negative text-negative"
                            : "border-border text-navy"
                        }`}
                      >
                        <option value="">
                          {field.required ? "Not mapped — required" : "Not mapped"}
                        </option>
                        {staged.headers.map((h, i) => (
                          <option key={`${h}-${i}`} value={i}>
                            {h || `Column ${i + 1}`}
                          </option>
                        ))}
                      </select>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* First rows, as they will be scored */}
            <div>
              <p className="mb-3 text-[13.5px] font-semibold text-navy">
                First {Math.min(5, staged.result.records.length)} records
              </p>
              <div className="surface-quiet overflow-hidden">
                <Table minWidth={760}>
                  <thead>
                    <tr>
                      <Th>Customer</Th>
                      <Th>Market</Th>
                      <Th align="right">Sales</Th>
                      <Th align="right">Prior</Th>
                      <Th align="right">Invoices</Th>
                      <Th align="right">Last purchase</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {staged.result.records.slice(0, 5).map((r) => (
                      <tr key={r.id}>
                        <Td className="font-semibold text-navy">{r.name}</Td>
                        <Td>{r.country}</Td>
                        <Td align="right">{r.ytd.toLocaleString("en-US")}</Td>
                        <Td align="right">{r.lastYear.toLocaleString("en-US")}</Td>
                        <Td align="right">{r.transactions}</Td>
                        <Td align="right">{r.lastPurchase}</Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </div>

            {staged.result.issues.length > 0 && (
              <div>
                <p className="mb-2 text-[13.5px] font-semibold text-navy">
                  {staged.result.issues.length} issues
                </p>
                <ul className="max-h-44 space-y-1.5 overflow-y-auto rounded-[8px] border border-border bg-secondary/30 p-3.5">
                  {staged.result.issues.slice(0, 60).map((issue, i) => (
                    <li key={i} className="text-[12.5px] leading-relaxed text-navy-muted">
                      <span className="font-semibold text-navy">Row {issue.row}</span> · {issue.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
