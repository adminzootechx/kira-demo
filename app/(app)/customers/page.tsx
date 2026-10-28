"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Database, Layers, ShieldAlert, Lightbulb, Timer, Users } from "lucide-react";
import { useCustomerAnalytics } from "@/lib/data/store";
import { OpportunityScatter } from "@/components/charts";
import { Tabs } from "@/components/ui/Tabs";
import { CallBadge } from "@/components/customers/CallBadge";
import CustomerTable from "@/components/customers/CustomerTable";
import { isAtRisk } from "@/lib/analytics/portfolio";
import {
  Badge, Card, CardBody, CardHeader, DataNote, Insight, KpiCard,
  Meter, PageHeader, Table, Td, Th,
} from "@/components/ui/primitives";
import { usd, toneClasses } from "@/lib/format";

export default function CustomersPage() {
  const {
    customers, kpis: customerKpis, narrative: customerNarrative,
    classDistribution: customerClassDistribution, rfmGrid, concentration,
    reorderDue,
  } = useCustomerAnalytics();
  const tab = useSearchParams().get("tab") ?? undefined;

  const champions = rfmGrid.find((g) => g.r === 5 && g.f === 5);
  const maxCell = Math.max(0.1, ...rfmGrid.map((g) => g.value));

  /** Top accounts by revenue — plotting the whole book is an unreadable cloud. */
  const scatter = [...customers]
    .sort((a, b) => b.ytd - a.ytd)
    .slice(0, 80)
    .map((c) => ({ x: Math.round(c.growth), y: c.churnRisk, z: c.ytd, name: c.name }));

  return (
    <>
      <PageHeader
        title="Customers"
        subtitle="A live picture of every account: how healthy it is, when it is likely to order again, whether we risk losing it, and how much more it could buy."
        actions={
          <Link href="/data" className="btn btn-secondary">
            <Database size={14} />
            Data sources
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <KpiCard
          label="Active customers"
          value={customerKpis.active.toLocaleString()}
          href="/customers?tab=Everyone"
          sub={`Bought in the last 180 days · ${customerKpis.total.toLocaleString()} in total`}
        />
        <KpiCard
          label="At risk of leaving"
          value={customerKpis.atRisk.toLocaleString()}
          href="/customers?tab=At+risk"
          tone="negative"
          sub={`${usd(customerKpis.atRiskAnnualValue)} they spend a year`}
        />
        <KpiCard
          label="Due to reorder now"
          value={customerKpis.reordersDue.toLocaleString()}
          href="/priorities?show=due"
          tone="accent"
          sub="In their usual buying window, or entering it this week"
        />
      </div>

      <Card>
        <CardHeader
          icon={<Lightbulb size={16} />}
          title="What stands out right now"
                  help="Written from your own customer list every time this page loads: the accounts that have dropped the most against their own history, and the ones growing fastest."
          subtitle="Worked out from how recently and how often each customer buys, how much they spend, and whether that is rising or falling"
        />
        <CardBody className="grid gap-3 md:grid-cols-2">
          <Insight tone="negative">
            {customerNarrative.declining.count} accounts — including{" "}
            {customerNarrative.declining.names} — have declined more than 60% against their own
            usual buying, {usd(customerNarrative.declining.lostValue)} of buying between them.
            {customerNarrative.declining.singlePortfolio
              ? ` All of the largest sit in ${customerNarrative.declining.owner}'s portfolio.`
              : ""}
          </Insight>
          <Insight tone="positive">
            {customerNarrative.growing.count} accounts are growing above 30%:{" "}
            {customerNarrative.growing.names}. Order size and frequency are both rising, adding{" "}
            {usd(customerNarrative.growing.addedValue)} against the comparable period.
          </Insight>
        </CardBody>
      </Card>

      <Tabs key={tab} tabs={["Everyone", "Groups", "Reorders", "At risk", "Biggest"]} initial={tab}>
        {(active) => (
          <div className="mt-6 space-y-6">
            {active === "Everyone" && (
              <Card>
                <CardHeader
                  icon={<Users size={16} />}
                  title="Every customer"
                  help="One row per account. Health is a 0–100 score of how well the relationship is going. Risk of losing them is how likely they are to stop buying. Click any row for the full story."
                  subtitle="Filter by group or market, sort by any column, and open a customer for the full picture."
                />
                <CustomerTable customers={customers} />
              </Card>
            )}

            {active === "Groups" && (
              <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader
                    icon={<Layers size={16} />}
                    title="How customers are grouped"
                  help="Every account is sorted into a group automatically from how it actually buys — growing, steady, slipping, gone quiet — so nobody has to tag them by hand."
                    subtitle="Grouped by simple rules, checked with LUSTRE before going live"
                  />
                  <CardBody className="space-y-3">
                    {customerClassDistribution.map((s) => (
                      <div key={s.label}>
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="flex items-center gap-2 text-[13px] font-medium text-navy">
                            <span className={`size-2 rounded-full ${toneClasses[s.tone].dot}`} />
                            {s.label}
                          </span>
                          <span className="text-[12.5px] text-muted-foreground">
                            {s.count} accounts · ${s.value}M
                          </span>
                        </div>
                        <div className="mt-1.5">
                          <Meter value={s.count} max={Math.max(1, ...customerClassDistribution.map((x) => x.count))} tone={s.tone} height="h-1.5" />
                        </div>
                      </div>
                    ))}
                  </CardBody>
                </Card>

                <Card>
                  <CardHeader
                    title="How customers group by buying habits"
                  help="A grid of how recently someone bought against how often. Top-right are your best repeat buyers; bottom-left have drifted away."
                    subtitle="How recently they bought against how often, sized by how much they spend"
                  />
                  <CardBody>
                    <div className="grid grid-cols-5 gap-1.5">
                      {[5, 4, 3, 2, 1].map((r) =>
                        [1, 2, 3, 4, 5].map((f) => {
                          const cell = rfmGrid.find((g) => g.r === r && g.f === f);
                          const intensity = cell ? Math.min(1, cell.value / maxCell) : 0;
                          return (
                            <div
                              key={`${r}-${f}`}
                              title={cell ? `${cell.label} · ${cell.customers} customers · $${cell.value}M` : "No customers"}
                              className="flex aspect-square flex-col items-center justify-center rounded border border-border/60 text-[10.5px]"
                              style={{
                                background: cell
                                  ? `rgba(47, 90, 158, ${0.1 + intensity * 0.75})`
                                  : "#F4F7FC",
                                color: intensity > 0.55 ? "#fff" : "#0F1729",
                              }}
                            >
                              {cell && (
                                <>
                                  <span className="font-semibold">{cell.customers}</span>
                                  <span className="opacity-80">${cell.value}M</span>
                                </>
                              )}
                            </div>
                          );
                        }),
                      )}
                    </div>
                    <div className="mt-3 flex justify-between text-[11px] text-muted-foreground">
                      <span>← Frequency low</span>
                      <span>Recency high ↑ · low ↓</span>
                      <span>Frequency high →</span>
                    </div>
                    {champions && (
                      <DataNote>
                        Champions (bought recently and often) hold ${champions.value}M across{" "}
                        {champions.customers.toLocaleString()} accounts. Customers who bought often but not
                        recently are where recovery effort pays most.
                      </DataNote>
                    )}
                  </CardBody>
                </Card>
              </div>
            )}

            {active === "Reorders" && (
              <Card>
                <CardHeader
                  icon={<Timer size={16} />}
                  title="When each customer is due to order again"
                  help="Each customer is measured against their own normal gap between orders, not an average. Someone who usually buys fortnightly is late at three weeks; a quarterly buyer is not."
                  subtitle="Measured against each customer’s own normal gap between orders, not an average"
                />
                <Table>
                  <thead>
                    <tr>
                      <Th>Customer</Th>
                      <Th>How they buy</Th>
                      <Th align="right">Due to order</Th>
                      <Th align="right">Current day</Th>
                      <Th align="right">Status</Th>
                      <Th align="right">Average order</Th>
                      <Th>Owner</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {reorderDue.map((c) => {
                      return (
                        <tr key={c.id} className="transition-colors hover:bg-secondary/40">
                          <Td className="font-semibold text-navy">
                            <span className="mr-2">{c.flag}</span>
                            {c.name}
                          </Td>
                          <Td className="text-muted-foreground">{c.cycleType}</Td>
                          <Td align="right">{c.window}</Td>
                          <Td align="right">Day {c.daysSince}</Td>
                          <Td align="right">
                            {c.kind ? <CallBadge kind={c.kind} daysPast={c.overdue} /> : <Badge tone="info">Coming up</Badge>}
                          </Td>
                          <Td align="right">{usd(c.avgTxn, { compact: false })}</Td>
                          <Td className="text-muted-foreground">{c.owner}</Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </Card>
            )}

            {active === "At risk" && (
              <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
                <Card>
                  <CardHeader
                    title="Growth against risk of losing them"
                    subtitle="Bubble size is revenue so far this year. Top-left is the recovery quadrant; bottom-right is where to invest."
                  />
                  <CardBody>
                    <OpportunityScatter data={scatter} />
                  </CardBody>
                </Card>
                <Card>
                  <CardHeader
                    icon={<ShieldAlert size={16} />}
                    title={`At risk of leaving (${customerKpis.atRisk.toLocaleString()})`}
                    subtitle="Still buying but slipping sharply, biggest first after allowing for how likely we are to lose them"
                  />
                  <CardBody className="space-y-3.5">
                    {[...customers]
                      .filter(isAtRisk)
                      .sort((a, b) => b.churnRisk * b.lastYear - a.churnRisk * a.lastYear)
                      .map((c) => (
                        <div key={c.id} className="border-b border-border pb-3 last:border-0 last:pb-0">
                          <div className="flex items-baseline justify-between gap-3">
                            <span className="text-[13px] font-semibold text-navy">
                              <span className="mr-1.5">{c.flag}</span>
                              {c.name}
                            </span>
                            <span className="text-[12.5px] font-semibold text-negative">{c.churnRisk}%</span>
                          </div>
                          <div className="mt-1.5">
                            <Meter value={c.churnRisk} tone={c.churnRisk >= 60 ? "negative" : "warn"} height="h-1" />
                          </div>
                          <p className="mt-1.5 text-[11.5px] text-muted-foreground">
                            {usd(c.lastYear)} historical · day {c.daysSince} of a {c.cycleDays[0]}–{c.cycleDays[1]} day cycle · {c.owner}
                          </p>
                        </div>
                      ))}
                  </CardBody>
                </Card>
              </div>
            )}

            {active === "Biggest" && (
              <div className="grid gap-6 lg:grid-cols-3">
                <Card>
                  <CardHeader title="How much rides on our biggest customers" subtitle="Share of revenue held by the largest accounts" />
                  <CardBody className="space-y-4">
                    {[
                      { label: "Largest customer", v: concentration.top1 },
                      { label: "Top 5 customers", v: concentration.top5 },
                      { label: "Top 10 customers", v: concentration.top10 },
                      { label: "Top 20 customers", v: concentration.top20 },
                    ].map((x) => (
                      <div key={x.label}>
                        <div className="flex items-baseline justify-between">
                          <span className="text-[13px] text-navy-soft">{x.label}</span>
                          <span className="text-[13.5px] font-semibold text-navy">{x.v}%</span>
                        </div>
                        <div className="mt-1.5">
                          <Meter value={x.v} max={60} tone={x.v > 50 ? "warn" : "accent"} height="h-1.5" />
                        </div>
                      </div>
                    ))}
                  </CardBody>
                </Card>

                <Card>
                  <CardHeader title="How much rides on each broker" subtitle="Revenue routed through each broker network" />
                  <CardBody className="space-y-3.5">
                    {concentration.byBroker.map((b) => (
                      <div key={b.name}>
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-[13px] font-medium text-navy">{b.name}</span>
                          <Badge tone={b.risk === "High" ? "negative" : b.risk === "Medium" ? "warn" : "positive"}>
                            {b.risk}
                          </Badge>
                        </div>
                        <div className="mt-1.5">
                          <Meter value={b.share} max={15} tone={b.risk === "High" ? "negative" : "accent"} height="h-1" />
                        </div>
                        <p className="mt-1 text-[11.5px] text-muted-foreground">
                          {b.share}% of revenue · {b.customers} customers
                        </p>
                      </div>
                    ))}
                  </CardBody>
                </Card>

                <Card>
                  <CardHeader title="How much rides on each country" subtitle="How much of our sales each market accounts for" />
                  <CardBody className="space-y-3.5">
                    {concentration.byCountry.map((c) => (
                      <div key={c.name}>
                        <div className="flex items-baseline justify-between">
                          <span className="text-[13px] text-navy-soft">{c.name}</span>
                          <span className="text-[13px] font-semibold text-navy">{c.share}%</span>
                        </div>
                        <div className="mt-1.5">
                          <Meter value={c.share} max={30} tone="info" height="h-1" />
                        </div>
                      </div>
                    ))}
                    <DataNote>
                      Concentration risk is calculated across customers, groups, brokers, countries
                      and salesperson portfolios.
                    </DataNote>
                  </CardBody>
                </Card>
              </div>
            )}
          </div>
        )}
      </Tabs>
    </>
  );
}
