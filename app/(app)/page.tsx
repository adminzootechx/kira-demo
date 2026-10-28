"use client";

import Link from "next/link";
import { CalendarClock, ListChecks, CircleAlert, Database, TrendingDown } from "lucide-react";
import { growthRate } from "@/lib/analytics/customer";
import { useCustomerAnalytics } from "@/lib/data/store";
import { useRole } from "@/components/shell/RoleContext";
import BusinessOverview from "@/components/home/BusinessOverview";
import { ImportBanner } from "@/components/ui/ImportBanner";
import { EmptyState } from "@/components/ui/feedback";
import DeskCard from "@/components/shell/DeskCard";
import { CallBadge } from "@/components/customers/CallBadge";
import {
  Card, CardHeader, IconTile, KpiCard, LinkChip, PageHeader, RailCard, Table, Td, Th,
} from "@/components/ui/primitives";
import { usd, type Tone } from "@/lib/format";

/** Rows shown in each Home list — enough to act on, the rest live on My day / Customers. */
const LIST_SIZE = 6;

export default function HomePage() {
  const book = useCustomerAnalytics();
  const { isSystem } = useRole();
  const { isImported, isLoading, customers, kpis, reorderDue } = book;

  const dataAsOfLabel = book.meta?.dataAsOf
    ? new Date(book.meta.dataAsOf).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : null;

  const lastYearTotal = customers.reduce((s, c) => s + c.lastYear, 0);
  const growth = growthRate(kpis.totalRevenue, lastYearTotal);

  // Still-active customers whose buying is falling, biggest drop in money
  // first: that is the decision worth making today. Long-lapsed accounts are a
  // separate win-back job and would otherwise crowd this list.
  const drifting = [...customers]
    .filter((c) => !c.pausedUntil && c.churnRisk >= 50 && c.daysSince <= 180 && c.lastYear > c.ytd)
    .sort((a, b) => b.lastYear - b.ytd - (a.lastYear - a.ytd))
    .slice(0, LIST_SIZE);
  const riskiest = drifting[0];
  // Reorder calls only: lapsed customers are a win-back list, not a reorder one.
  const reorders = reorderDue.filter((c) => c.kind === "Due now" || c.kind === "Past their usual time").slice(0, LIST_SIZE);

  return (
    <>
      <PageHeader
        breadcrumb={["Sales", "Home"]}
        title="Home"
        subtitle="Where your accounts stand today, and who needs a call."
        meta={
          dataAsOfLabel ? (
            <span className="inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
              <CalendarClock size={13} />
              Data as of {dataAsOfLabel}
            </span>
          ) : undefined
        }
        actions={
          <Link href="/priorities" className="btn btn-primary">
            <ListChecks size={15} />
            Open My day
          </Link>
        }
      />

      <ImportBanner isImported={isImported} isLoading={isLoading} />

      {!isLoading && !isImported && (
        <Card>
          <EmptyState
            icon={<Database size={22} strokeWidth={1.8} />}
            title="No sales data loaded yet"
            description="Home fills in from your own sales records. Once they are imported, your accounts, reorders and risks appear here."
          />
        </Card>
      )}

      {isImported && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_336px]">
          <div className="min-w-0 space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard
                label="Sales, last 12 months"
                value={usd(kpis.totalRevenue)}
                delta={growth}
                sub={`vs ${usd(lastYearTotal)} in the 12 months before`}
              />
              <KpiCard
                label="Active customers"
                value={kpis.active.toLocaleString()}
                href="/customers"
                sub={`Bought in the last 180 days · ${kpis.total.toLocaleString()} in total`}
              />
              <KpiCard
                label="At risk of leaving"
                value={kpis.atRisk.toLocaleString()}
                href="/priorities?show=risk"
                tone="negative"
                sub={`${usd(kpis.atRiskAnnualValue)} a year between them`}
              />
              <KpiCard
                label="Due to reorder now"
                value={kpis.reordersDue.toLocaleString()}
                href="/priorities?show=due"
                sub="In their usual buying window, or entering it this week"
              />
            </div>

            <Card>
              <CardHeader
                title="Reorder calls"
                subtitle="Due now or past their usual time, biggest usual order first"
                action={<LinkChip href="/priorities">Open My day</LinkChip>}
              />
              {reorders.length === 0 ? (
                <EmptyState compact title="Nobody is due right now" description="No account has reached its usual reorder window." />
              ) : (
                <Table dense>
                  <thead>
                    <tr>
                      <Th>Customer</Th>
                      {isSystem && <Th>Owner</Th>}
                      <Th align="right">Days since order</Th>
                      <Th align="right">Usual cycle</Th>
                      <Th>Status</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {reorders.map((c) => (
                      <tr key={c.id} className="transition-colors hover:bg-secondary/40">
                        <Td className="font-semibold text-navy">
                          <Link href={`/customers/${c.id}`} className="hover:text-accent-dark">{c.name}</Link>
                        </Td>
                        {isSystem && <Td className="text-muted-foreground">{c.owner}</Td>}
                        <Td align="right">{c.daysSince}</Td>
                        <Td align="right" className="text-muted-foreground">{c.window}</Td>
                        <Td>
                          {c.kind && <CallBadge kind={c.kind} daysPast={c.overdue} />}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card>

            <Card>
              <CardHeader
                icon={<TrendingDown size={16} />}
                title="May be drifting away"
                subtitle="Customers who still buy but are spending less, biggest drop first"
                action={<LinkChip href="/customers">All customers</LinkChip>}
              />
              {drifting.length === 0 ? (
                <EmptyState compact title="No accounts flagged" description="No account is showing a high risk of leaving." />
              ) : (
                <Table dense>
                  <thead>
                    <tr>
                      <Th>Customer</Th>
                      {isSystem && <Th>Owner</Th>}
                      <Th align="right">Days since order</Th>
                      <Th align="right">12 months before</Th>
                      <Th align="right">Last 12 months</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {drifting.map((c) => (
                      <tr key={c.id} className="transition-colors hover:bg-secondary/40">
                        <Td className="font-semibold text-navy">
                          <Link href={`/customers/${c.id}`} className="hover:text-accent-dark">{c.name}</Link>
                        </Td>
                        {isSystem && <Td className="text-muted-foreground">{c.owner}</Td>}
                        <Td align="right">{c.daysSince}</Td>
                        <Td align="right" className="text-muted-foreground">{usd(c.lastYear)}</Td>
                        <Td align="right">{usd(c.ytd)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card>
          </div>

          <aside aria-label="At a glance" className="space-y-5">
            {riskiest && (
              <RailCard
                eyebrow="Needs a decision now"
                icon={<CircleAlert size={12} strokeWidth={2.4} />}
              >
                <div className="flex gap-3">
                  <IconTile tone={(riskiest.churnRisk >= 50 ? "negative" : "warn") as Tone}>
                    <TrendingDown size={16} />
                  </IconTile>
                  <div className="min-w-0">
                    <h3 className="text-[14px] font-semibold leading-snug text-navy">
                      {riskiest.name} may be drifting away
                    </h3>
                    <p className="mt-1.5 text-[12.5px] leading-relaxed text-navy-muted">
                      Last order {riskiest.daysSince} days ago. They bought {usd(riskiest.lastYear)} in the
                      12 months before; {usd(riskiest.ytd)} in the last 12.
                    </p>
                  </div>
                </div>
                <div
                  className={`mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border-soft pt-3.5 ${
                    isSystem ? "justify-between" : "justify-end"
                  }`}
                >
                  {isSystem && (
                    <span className="text-[12px] text-muted-foreground">
                      Owner <span className="font-semibold text-navy">{riskiest.owner}</span>
                    </span>
                  )}
                  <LinkChip href={`/customers/${riskiest.id}`}>View customer</LinkChip>
                </div>
              </RailCard>
            )}

            <DeskCard />
          </aside>
        </div>
      )}

      {isImported && isSystem && <BusinessOverview />}
    </>
  );
}
