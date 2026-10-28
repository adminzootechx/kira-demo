"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ShieldCheck } from "lucide-react";
import { useCustomerAnalytics } from "@/lib/data/store";
import { useRole } from "@/components/shell/RoleContext";
import { ImportBanner } from "@/components/ui/ImportBanner";
import { EmptyState } from "@/components/ui/feedback";
import { Badge, Card, CardHeader, DataNote, KpiCard, PageHeader, Table, Td, Th } from "@/components/ui/primitives";
import { usd } from "@/lib/format";

type Check = {
  id: string;
  customerId: string;
  customer: string;
  owner: string;
  kind: "Past their usual time" | "Sharp decline";
  detail: string;
  /** Gone quiet: what they bought in the last 12 months. Sharp decline: how far below the 12 months before. */
  exposure: number;
};

/** A decline only counts once there was a real base to fall from. */
const MIN_BASE = 5_000;
const DECLINE_THRESHOLD = 0.4;

export default function ExceptionsPage() {
  const { isImported, isLoading, customers, reorderDue } = useCustomerAnalytics();
  const { isSystem } = useRole();

  // Two checks, both computed from the real book — nothing stored, nothing
  // sample. Inventory, margin and credit checks need data LUSTRE's export does
  // not carry (stock on hand, the unconfirmed cost field, receivables), so they
  // are not shown rather than invented.
  const checks = useMemo<Check[]>(() => {
    const quiet: Check[] = reorderDue
      .filter((c) => c.kind === "Past their usual time")
      .map((c) => ({
        id: `quiet-${c.id}`,
        customerId: c.id,
        customer: c.name,
        owner: c.owner,
        kind: "Past their usual time",
        detail: `${c.daysSince} days since their last order; they usually order every ${c.window}.`,
        exposure: c.ytd,
      }));
    const quietIds = new Set(quiet.map((q) => q.customerId));
    const declined: Check[] = customers
      .filter((c) => !c.pausedUntil && !quietIds.has(c.id) && c.lastYear >= MIN_BASE && c.ytd <= c.lastYear * (1 - DECLINE_THRESHOLD))
      .map((c) => ({
        id: `decline-${c.id}`,
        customerId: c.id,
        customer: c.name,
        owner: c.owner,
        kind: "Sharp decline",
        detail: `Down ${Math.round((1 - c.ytd / c.lastYear) * 100)}%: ${usd(c.ytd)} in the last 12 months against ${usd(c.lastYear)} in the 12 before.`,
        exposure: c.lastYear - c.ytd,
      }));
    return [...quiet, ...declined].sort((a, b) => b.exposure - a.exposure);
  }, [customers, reorderDue]);

  const quietCount = checks.filter((c) => c.kind === "Past their usual time").length;
  const exposure = checks.reduce((s, c) => s + c.exposure, 0);

  return (
    <>
      <PageHeader
        title="Things to check"
        subtitle="Accounts that look wrong or need a decision — each links straight to the customer behind it."
        actions={
          checks.length > 0 ? <Badge tone="negative">{checks.length} to look at</Badge> : undefined
        }
      />

      <ImportBanner isImported={isImported} isLoading={isLoading} />

      {!isLoading && !isImported && (
        <Card>
          <EmptyState
            title="No sales data loaded yet"
            description="Checks are worked out from your own sales records and appear here once they are imported."
          />
        </Card>
      )}

      {isImported && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <KpiCard label="Things to check" value={String(checks.length)} sub="Accounts flagged right now" />
            <KpiCard label="Past their usual time" value={String(quietCount)} sub="Past their usual reorder window" />
            <KpiCard
              label="Sales at stake"
              value={usd(exposure)}
              tone="negative"
              sub="Their last 12 months, or how far they fell"
            />
          </div>

          <Card>
            <CardHeader title="Accounts to look at" subtitle="Largest first" />
            {checks.length === 0 ? (
              <EmptyState
                icon={<ShieldCheck size={22} strokeWidth={1.8} />}
                title="Nothing looks wrong"
                description="No account is past its reorder window or sharply down on last year."
              />
            ) : (
              <Table dense>
                <thead>
                  <tr>
                    <Th>Customer</Th>
                    <Th>Why</Th>
                    <Th>What happened</Th>
                    {isSystem && <Th>Owner</Th>}
                    <Th align="right">At stake</Th>
                  </tr>
                </thead>
                <tbody>
                  {checks.map((c) => (
                    <tr key={c.id} className="transition-colors hover:bg-secondary/40">
                      <Td className="font-semibold text-navy">
                        <Link href={`/customers/${c.customerId}`} className="hover:text-accent-dark">
                          {c.customer}
                        </Link>
                      </Td>
                      <Td>
                        <Badge tone={c.kind === "Past their usual time" ? "warn" : "negative"}>{c.kind}</Badge>
                      </Td>
                      <Td className="text-muted-foreground">{c.detail}</Td>
                      {isSystem && <Td className="text-muted-foreground">{c.owner}</Td>}
                      <Td align="right" className="font-semibold text-navy">{usd(c.exposure)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
            <DataNote>
              Only checks that can be worked out from sales history are shown. Customers who stopped
              buying long ago are not listed here; they appear as lapsed on My day. Stock, margin and
              payment checks need data that is not in LUSTRE&apos;s sales export.
            </DataNote>
          </Card>
        </>
      )}
    </>
  );
}
