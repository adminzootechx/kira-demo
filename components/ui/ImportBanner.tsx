"use client";

import { Database } from "lucide-react";
import { useCustomerBook } from "@/lib/data/store";

/**
 * Says that the figures below come from LUSTRE's own sales records and how far
 * they run. There is no sample book, so this renders only when real data is
 * loaded; with none, each page shows its own empty state. Data that has fallen
 * behind is flagged once for every page by StaleDataNotice under the header.
 */
export function ImportBanner({
  isImported, isLoading, note,
}: {
  isImported: boolean;
  isLoading?: boolean;
  note?: string;
}) {
  const { meta } = useCustomerBook();
  if (isLoading || !isImported) return null;

  const asOf = meta?.dataAsOf ?? null;
  const asOfLabel = asOf
    ? new Date(`${asOf}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
    : null;

  return (
    <div className="mb-4 flex items-start gap-2.5 rounded-[10px] border border-accent-border bg-accent-bg px-3.5 py-2.5 text-[12.5px] text-accent-dark">
      <Database size={14} className="mt-0.5 shrink-0" />
      <p className="leading-relaxed">
        <span className="font-semibold">{asOfLabel ? `From your sales data, up to ${asOfLabel}.` : "From your sales data."}</span>{" "}
        {note ?? ""}
      </p>
    </div>
  );
}
