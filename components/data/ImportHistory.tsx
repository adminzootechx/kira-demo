"use client";

import { useState } from "react";
import { Database, RefreshCw, Trash2 } from "lucide-react";
import { refreshImports, useImportAdmin } from "@/lib/data/adminStore";
import { refreshBook } from "@/lib/data/store";
import { Badge, Card, CardBody, CardHeader, Table, Td, Th } from "@/components/ui/primitives";

/**
 * Everything the database is holding, and the controls to manage it.
 *
 * Keeping past imports rather than overwriting them is what makes the trend
 * panel possible — and it means a bad import can be rolled back by activating
 * the previous one instead of re-uploading a file.
 */
export default function ImportHistory() {
  const { imports, stats, trend, database } = useImportAdmin();
  const [busy, setBusy] = useState<number | null>(null);

  const act = async (id: number, method: "PATCH" | "DELETE", action?: string) => {
    setBusy(id);
    try {
      await fetch(`/api/imports/${id}`, {
        method,
        headers: action ? { "content-type": "application/json" } : undefined,
        body: action ? JSON.stringify({ action }) : undefined,
      });
      refreshImports();
      refreshBook();
    } finally {
      setBusy(null);
    }
  };

  if (database !== "connected") {
    return (
      <Card>
        <CardBody className="space-y-3 py-10 text-center">
          <Database size={22} className="mx-auto text-navy-muted" aria-hidden />
          <p className="text-[14px] font-semibold text-navy">Database not reachable</p>
          <p className="mx-auto max-w-md text-[13px] leading-relaxed text-muted-foreground">
            Check <span className="font-mono text-navy">DATABASE_URL</span> in{" "}
            <span className="font-mono text-navy">.env.local</span>, then apply migrations with{" "}
            <span className="font-mono text-navy">pnpm db:migrate</span>. The platform runs on
            sample data until then.
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {stats && (
        <Card>
          <CardHeader
            icon={<Database size={16} />}
            title="What the database is holding"
            help="Raw imported rows are the source of truth. Scores are derived and disposable — 'Re-score' rebuilds them from the stored rows using the current models, which is how a formula change is rolled out without asking LUSTRE for the file again."
            subtitle="Imported rows are facts; scores are rebuilt from them on demand"
          />
          <div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Imports", value: stats.importCount },
              { label: "Customer rows", value: stats.customerRowCount },
              { label: "Snapshots", value: stats.snapshotCount },
              { label: "Stored scores", value: stats.scoreCount },
            ].map((s) => (
              <div key={s.label} className="bg-card p-6">
                <p className="eyebrow leading-relaxed">{s.label}</p>
                <p className="kpi-value mt-4 text-[29.5px] leading-none">
                  {s.value.toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {trend && trend.length > 0 && (
        <Card>
          <CardHeader
            title="Movement since the previous snapshot"
            help="Computed by comparing the two most recent snapshots of the same model version. Snapshots taken under different model versions are never compared, because a formula change would otherwise read as a change in the business."
            subtitle="Genuine period-on-period change, shown once you have loaded data twice"
          />
          <Table minWidth={620}>
            <thead>
              <tr>
                <Th>Metric</Th>
                <Th align="right">Previous</Th>
                <Th align="right">Current</Th>
                <Th align="right">Change</Th>
              </tr>
            </thead>
            <tbody>
              {trend.map((t) => (
                <tr key={t.metric}>
                  <Td className="font-medium text-navy">{t.metric}</Td>
                  <Td align="right">{Math.round(t.previous).toLocaleString()}</Td>
                  <Td align="right" className="font-semibold text-navy">
                    {Math.round(t.current).toLocaleString()}
                  </Td>
                  <Td align="right">
                    <span
                      className={
                        Math.abs(t.deltaPct) < 0.05
                          ? "text-muted-foreground"
                          : t.deltaPct > 0
                            ? "text-positive"
                            : "text-negative"
                      }
                    >
                      {t.deltaPct > 0 ? "+" : ""}
                      {t.deltaPct.toFixed(1)}%
                    </span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      <Card>
        <CardHeader
          title="Import history"
          help="Every import is kept. Activating an older one rolls the whole platform back to that book instantly — useful if an export turns out to be wrong after it has been loaded."
          subtitle={`${imports.length} stored ${imports.length === 1 ? "import" : "imports"}`}
        />
        <Table minWidth={780}>
          <thead>
            <tr>
              <Th>File</Th>
              <Th>Imported</Th>
              <Th align="right">Rows</Th>
              <Th align="right">Skipped</Th>
              <Th align="right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {imports.map((row) => (
              <tr key={row.id} className={row.isActive ? "bg-accent-bg/40" : ""}>
                <Td>
                  <span className="font-semibold text-navy">{row.fileName}</span>
                  {row.isActive && (
                    <span className="ml-2 align-middle">
                      <Badge tone="positive">Active</Badge>
                    </span>
                  )}
                  {row.source === "sample" && (
                    <span className="ml-2 align-middle">
                      <Badge tone="neutral">Sample</Badge>
                    </span>
                  )}
                </Td>
                <Td className="text-muted-foreground">
                  {new Date(row.importedAt).toLocaleString("en-GB")}
                </Td>
                <Td align="right">{row.rowCount.toLocaleString()}</Td>
                <Td align="right" className={row.skippedCount ? "text-warn" : ""}>
                  {row.skippedCount.toLocaleString()}
                </Td>
                <Td align="right">
                  <div className="flex items-center justify-end gap-2">
                    {!row.isActive && (
                      <button
                        type="button"
                        disabled={busy === row.id}
                        onClick={() => void act(row.id, "PATCH")}
                        className="text-[12.5px] font-semibold text-accent-dark transition-colors hover:text-navy disabled:opacity-40"
                      >
                        Activate
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={busy === row.id}
                      onClick={() => void act(row.id, "PATCH", "rescore")}
                      title="Rebuild every score from the stored rows using the current models"
                      className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-navy-muted transition-colors hover:text-navy disabled:opacity-40"
                    >
                      <RefreshCw size={12} />
                      Re-score
                    </button>
                    <button
                      type="button"
                      disabled={busy === row.id}
                      onClick={() => void act(row.id, "DELETE")}
                      aria-label={`Delete import ${row.fileName}`}
                      className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-negative transition-colors hover:text-navy disabled:opacity-40"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </Td>
              </tr>
            ))}
            {imports.length === 0 && (
              <tr>
                <Td colSpan={5} className="py-10 text-center text-muted-foreground">
                  Nothing imported yet. The platform is running on sample data.
                </Td>
              </tr>
            )}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
