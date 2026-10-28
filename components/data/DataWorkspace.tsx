"use client";

import CsvImport from "./CsvImport";
import ImportHistory from "./ImportHistory";
import { SectionHeading } from "@/components/ui/primitives";
import { refreshImports } from "@/lib/data/adminStore";

/**
 * Ties the importer to the history panel: applying an import bumps a key so the
 * history and trend tables refetch without a page reload.
 */
export default function DataWorkspace() {
  return (
    <>
      <section className="space-y-6">
        <SectionHeading
          id="customer-import"
          title="What we know about your customers"
          help="This is the part you can load data into today. Drop a customer export here and every score on the Customers pages — how they group, who might stop buying, when they are due to order, what they are worth and how healthy they are — is worked out again from your rows."
          description="One row per customer. The required columns are marked; everything else makes the scoring sharper."
        />
        <CsvImport onChanged={refreshImports} />
      </section>

      <section className="space-y-6">
        <SectionHeading
          id="storage"
          title="Stored data"
          help="Imports, the raw rows behind them, and every scored snapshot. Snapshots are what make period-over-period movement real arithmetic rather than an assumption."
          description="What the platform database is holding, and the movement between snapshots."
        />
        <ImportHistory />
      </section>
    </>
  );
}
