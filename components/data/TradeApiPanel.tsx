"use client";

import { useState } from "react";
import { Database, RadioTower, RefreshCw, Search } from "lucide-react";
import { Badge, Card, CardBody, CardHeader, Table, Td, Th } from "@/components/ui/primitives";

type SalesDataResponse = {
  code?: number;
  flag?: boolean;
  message?: string;
  totalCount?: number;
  rows?: Record<string, string>[];
  fromDate?: string;
  toDate?: string;
  rateLimit?: { limit: number; remaining: number; resetInMs: number };
  error?: string;
};

type SyncResponse = {
  importId?: number;
  rowsWritten?: number;
  customerCount?: number;
  totalAvailable?: number;
  pagesFetched?: number;
  rateLimit?: { limit: number; remaining: number; resetInMs: number };
  error?: string;
};

type CheckResponse = {
  freshness?: { changed: boolean; previousTotalCount: number | null; currentTotalCount: number };
  synced?: boolean;
  sync?: SyncResponse;
  rateLimit?: { limit: number; remaining: number; resetInMs: number };
  error?: string;
};

const COLUMNS = ["StoneNo", "Shp", "Cts", "Col", "Clr", "SoldRate", "SaleDate"] as const;

function last30Days() {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 30);
  return { fromDate: from.toISOString().slice(0, 10), toDate: to.toISOString().slice(0, 10) };
}

/** Live preview + sync-to-database controls for the Trade Data API connection. */
export default function TradeApiPanel() {
  const [data, setData] = useState<SalesDataResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [sync, setSync] = useState<SyncResponse | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [check, setCheck] = useState<CheckResponse | null>(null);
  const [checking, setChecking] = useState(false);

  const fetchSample = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/tradeapi/sales?rows=10", { cache: "no-store" });
      const body = (await res.json()) as SalesDataResponse;
      setData(body);
    } catch {
      setData({ error: "Request failed." });
    } finally {
      setLoading(false);
    }
  };

  const runSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/tradeapi/sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...last30Days(), maxRows: 3000 }),
      });
      const body = (await res.json()) as SyncResponse;
      setSync(body);
    } catch {
      setSync({ error: "Sync request failed." });
    } finally {
      setSyncing(false);
    }
  };

  const runCheck = async () => {
    setChecking(true);
    try {
      const res = await fetch("/api/tradeapi/check", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...last30Days(), autoSync: true, maxRows: 3000 }),
      });
      const body = (await res.json()) as CheckResponse;
      setCheck(body);
      if (body.sync) setSync(body.sync);
    } catch {
      setCheck({ error: "Freshness check failed." });
    } finally {
      setChecking(false);
    }
  };

  return (
    <Card>
      <CardHeader
        icon={<RadioTower size={16} />}
        title="Trade Data API — live connection"
        subtitle="The dashboard reads from the database only — this is the one place that talks to the API"
        action={
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={fetchSample}
              disabled={loading}
              className="btn-secondary inline-flex items-center gap-1.5 text-[13px]"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} aria-hidden />
              {loading ? "Fetching…" : "Preview live sample"}
            </button>
            <button
              type="button"
              onClick={runCheck}
              disabled={checking}
              className="btn-secondary inline-flex items-center gap-1.5 text-[13px]"
            >
              <Search size={13} className={checking ? "animate-spin" : ""} aria-hidden />
              {checking ? "Checking…" : "Check for updates"}
            </button>
            <button
              type="button"
              onClick={runSync}
              disabled={syncing}
              className="btn-primary inline-flex items-center gap-1.5 text-[13px]"
            >
              <Database size={13} className={syncing ? "animate-pulse" : ""} aria-hidden />
              {syncing ? "Syncing…" : "Force sync last 30 days"}
            </button>
          </div>
        }
      />
      <CardBody className="space-y-4">
        {check && (
          <div
            className={`rounded-[8px] border p-3.5 text-[13px] ${
              check.error ? "border-negative/30 bg-negative/5" : "border-info/30 bg-info/5"
            }`}
          >
            {check.error ? (
              <p className="font-medium text-negative">{check.error}</p>
            ) : (
              <p className="text-navy-muted">
                {check.freshness?.changed ? (
                  <>
                    <span className="font-semibold text-navy">Changed</span> — was{" "}
                    {check.freshness.previousTotalCount?.toLocaleString() ?? "unknown"}, now{" "}
                    {check.freshness.currentTotalCount.toLocaleString()} matching rows.{" "}
                    {check.synced ? "Synced automatically." : "Not synced — click Force sync to pull it."}
                  </>
                ) : (
                  <>
                    <span className="font-semibold text-navy">No change</span> —{" "}
                    {check.freshness?.currentTotalCount.toLocaleString()} matching rows, same as last check.
                    No sync needed.
                  </>
                )}
              </p>
            )}
          </div>
        )}

        {sync && (
          <div
            className={`rounded-[8px] border p-3.5 text-[13px] ${
              sync.error ? "border-negative/30 bg-negative/5" : "border-positive/30 bg-positive/5"
            }`}
          >
            {sync.error ? (
              <p className="font-medium text-negative">{sync.error}</p>
            ) : (
              <p className="text-navy-muted">
                Synced <span className="font-semibold text-navy">{sync.customerCount?.toLocaleString()}</span>{" "}
                customers ({sync.rowsWritten?.toLocaleString()} lot rows) into the database as import{" "}
                <span className="font-mono">#{sync.importId}</span> and made it the active book — the
                dashboard now reflects this data. ({sync.pagesFetched} API page
                {sync.pagesFetched === 1 ? "" : "s"} of {sync.totalAvailable?.toLocaleString()} available.)
              </p>
            )}
          </div>
        )}

        {!data && (
          <p className="text-[13px] text-muted-foreground">
            Not fetched yet. This calls the real Trade Data API — click above to pull the last 30
            days, 10 rows.
          </p>
        )}

        {data?.error && (
          <p className="text-[13px] font-medium text-negative">{data.error}</p>
        )}

        {data && !data.error && (
          <>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px]">
              <span className="text-navy-muted">
                <span className="font-semibold text-navy">{data.totalCount?.toLocaleString()}</span>{" "}
                matching rows for {data.fromDate} → {data.toDate}
              </span>
              <Badge tone={data.flag ? "positive" : "neutral"}>
                {data.flag ? "Connected" : String(data.message)}
              </Badge>
              {data.rateLimit && (
                <span className="text-muted-foreground">
                  Rate limit: {data.rateLimit.remaining}/{data.rateLimit.limit} calls left this
                  minute
                </span>
              )}
            </div>

            {data.rows && data.rows.length > 0 && (
              <div className="overflow-x-auto">
                <Table>
                  <thead>
                    <tr>
                      {COLUMNS.map((c) => (
                        <Th key={c}>{c}</Th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((row, i) => (
                      <tr key={i}>
                        {COLUMNS.map((c) => (
                          <Td key={c}>{row[c] ?? "—"}</Td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
          </>
        )}
      </CardBody>
    </Card>
  );
}
