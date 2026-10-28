"use client";

import { useEffect, useState } from "react";
import { Network, Trophy, UserCog, Users } from "lucide-react";
import { useDimensions } from "@/lib/data/dimensionStore";
import { type RepTier } from "@/lib/analytics/tiers";
import { liveReps, periodLabel } from "@/lib/data/live";
import { ImportBanner } from "@/components/ui/ImportBanner";
import { ScoreRadar, palette } from "@/components/charts";
import { Tabs } from "@/components/ui/Tabs";
import { TierBadge } from "@/components/ui/TierBadge";
import {
  Badge, Card, CardBody, CardHeader, DataNote, Delta, KpiCard,
  Meter, PageHeader, Table, Td, Th,
} from "@/components/ui/primitives";
import { usd } from "@/lib/format";
import { EmptyState } from "@/components/ui/feedback";


export default function TeamPage() {
  const { dimensions, isImported, isLoading } = useDimensions();
  const d = dimensions;

  // Real salesperson list — who actually sold to/handled each customer, with
  // real tiers. Fetched from /api/team/tiers rather than computed from
  // useCustomerAnalytics() here: that hook scopes to the signed-in user's own
  // book for a rep session, which would rank this page's "whole team" view
  // against a team of one for any rep this page is ever enabled for. The
  // elaborate scorecard below (retention, price realisation, target
  // achievement, broker analysis) stays on the sample data — that needs
  // interaction/target datasets LUSTRE hasn't sent, unrelated to whether a real
  // book is loaded.
  const [realTeamMembers, setRealTeamMembers] = useState<RepTier[]>([]);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/team/tiers", { cache: "no-store" })
      .then((r) => r.json())
      .then((body: { tiers: RepTier[] }) => {
        if (!cancelled) setRealTeamMembers(body.tiers);
      })
      .catch(() => {
        if (!cancelled) setRealTeamMembers([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // SOW 5.5 lists thirteen scorecard factors. Nine are computable from the
  // export; target achievement, activity, follow-up and response time need
  // datasets LUSTRE has not sent, and are rendered as "—" rather than guessed.
  const reps = d
    ? liveReps(d).map((r) => ({
        ...r, role: "Account Manager",
        revenue: r.revenue / 1e6, repeatShare: 0, priceRealisation: 100 - r.avgDiscount,
        concentration: 0, benchmarkTouches: 0, atRisk: 0,
        specialisation: "", strength: "", watch: "",
      }))
    : [];
  const top = reps[0];

  const brokers = d
    ? d.brokers.map((b) => ({
        name: b.name, country: "", flag: "", revenue: b.revenue / 1e6,
        share: (b.revenue / Math.max(d.overview.revenue, 1)) * 100,
        customers: 0, quality: 0,
        dependency: b.revenue / Math.max(d.overview.revenue, 1) > 0.05 ? "High" : b.revenue / Math.max(d.overview.revenue, 1) > 0.01 ? "Medium" : "Low",
        growth: 0, avgDiscount: b.avgDiscount,
        note: `${b.stones.toLocaleString()} stones sold in the period.`,
      }))
    : [];

  const teamKpis = d
    ? [
        { label: "Salespeople", value: String(d.owners.length), delta: 0, sub: "With sales in the period" },
        { label: "Sales booked", value: usd(d.overview.revenue), delta: d.overview.growth, sub: `${periodLabel(d)}, against the same dates last year` },
        { label: "Customers who bought", value: d.overview.customers.toLocaleString(), delta: 0, sub: `At least one order, ${periodLabel(d)}` },
        { label: "Brokered revenue", value: `${((d.brokers.reduce((a, b) => a + b.revenue, 0) / Math.max(d.overview.revenue, 1)) * 100).toFixed(1)}%`, delta: 0, sub: `Top ${d.brokers.length} brokers` },
      ]
    : [];

  return (
    <>
      <PageHeader
        title="Team"
        subtitle="How each salesperson and broker is doing — not just how much they sold, but whether they keep customers, win them back and hold prices."
      />

      <ImportBanner
        isImported={isImported}
        isLoading={isLoading}
        note={
          isImported
            ? "Sales, growth, customers kept and discounts come from every sale in your records. Targets are on the Targets page; call and visit history is not in the sales data, so it is not shown."
            : undefined
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {teamKpis.map((k) => (
          <KpiCard key={k.label} label={k.label} value={k.value} delta={k.delta || undefined} sub={k.sub} />
        ))}
      </div>

      {realTeamMembers.length > 0 && (
        <Card>
          <CardHeader
            icon={<Users size={16} />}
            title="Team members"
            subtitle="By client owner: sales from the customers each person handles now, including any reassigned to them. Targets counts the salesperson recorded on each sale instead."
          />
          <Table dense>
            <thead>
              <tr>
                <Th>Salesperson</Th>
                <Th>Tier</Th>
                <Th align="right">Customers</Th>
                <Th align="right">Sales, last 12 months</Th>
                <Th align="right">Sales last year</Th>
                <Th align="right">Growth</Th>
              </tr>
            </thead>
            <tbody>
              {realTeamMembers.map((m) => (
                <tr key={m.name} className="transition-colors hover:bg-secondary/40">
                  <Td className="font-semibold text-navy">{m.name}</Td>
                  <Td><TierBadge tier={m.tier} size="xs" /></Td>
                  <Td align="right">{m.customers}</Td>
                  <Td align="right">{usd(m.ytd)}</Td>
                  <Td align="right" className="text-muted-foreground">{usd(m.lastYear)}</Td>
                  <Td align="right">
                    <Delta value={m.growth} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      {!isLoading && !d && (
        <Card>
          <EmptyState title="No scorecard data yet" description="Salesperson and broker scorecards are worked out from your lot-level sales. They appear here once that data is available." />
        </Card>
      )}

      {d && (
      <Tabs tabs={["Scores", "Breakdown", "Brokers"]}>
        {(active) => (
          <div className="mt-6 space-y-6">
            {active === "Scores" && (
              <>
                <Card>
                  <CardHeader
                    icon={<Trophy size={16} />}
                    title="How each salesperson is doing"
                  help="More than just sales totals: whether they keep their customers, win back the ones who drift, and hold price instead of discounting."
                    subtitle="One score built from sales, growth, customers kept, customers won back, repeat business and how well prices held"
                  />
                  <Table dense>
                    <thead>
                      <tr>
                        <Th align="center">#</Th>
                        <Th>Account manager</Th>
                        <Th align="right">Score</Th>
                        <Th align="right">Sales</Th>
                        <Th align="right">vs target</Th>
                        <Th align="right">Growth</Th>
                        <Th align="right">Customers kept</Th>
                        <Th align="right">Price held</Th>
                        <Th align="right">How much rides on them</Th>
                        <Th align="right">Contacts</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {reps.map((r, i) => (
                        <tr key={r.id} className="transition-colors hover:bg-secondary/40">
                          <Td align="center" className="text-muted-foreground">{i + 1}</Td>
                          <Td>
                            <div className="flex items-center gap-2.5">
                              <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-secondary text-[11px] font-semibold text-navy">
                                {r.initials}
                              </span>
                              <div>
                                <span className="block font-semibold text-navy">{r.name}</span>
                                <span className="block text-[11.5px] text-muted-foreground">
                                  {r.flag} {r.region} · {r.accounts} accounts
                                </span>
                              </div>
                            </div>
                          </Td>
                          <Td align="right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-11">
                                <Meter
                                  value={r.score}
                                  tone={r.score >= 85 ? "positive" : r.score >= 70 ? "accent" : "negative"}
                                  height="h-1"
                                />
                              </div>
                              <span className="font-semibold text-navy">{r.score}</span>
                            </div>
                          </Td>
                          <Td align="right">${r.revenue.toFixed(1)}M</Td>
                          <Td align="right">
                            {r.achievement === null ? (
                              <span className="text-muted-foreground" title="No target data delivered">—</span>
                            ) : (
                              <span className={r.achievement >= 100 ? "text-positive" : r.achievement >= 90 ? "" : "font-semibold text-negative"}>
                                {r.achievement}%
                              </span>
                            )}
                          </Td>
                          <Td align="right"><Delta value={r.growth} /></Td>
                          <Td align="right">{Math.round(r.retention)}%</Td>
                          <Td align="right" className={r.priceRealisation < 93 ? "font-semibold text-negative" : ""}>
                            {r.priceRealisation.toFixed(1)}%
                          </Td>
                          <Td align="right" className={r.concentration > 50 ? "font-semibold text-warn" : ""}>
                            {r.concentration ? `${r.concentration}%` : <span className="text-muted-foreground">—</span>}
                          </Td>
                          <Td align="right">
                            {r.touches === null ? (
                              <span className="text-muted-foreground" title="Needs customer interaction data">—</span>
                            ) : (<>
                              <span className={r.touches < r.benchmarkTouches ? "font-semibold text-negative" : "text-positive"}>
                                {r.touches}
                              </span>
                              <span className="text-muted-foreground"> / {r.benchmarkTouches}</span>
                            </>)}
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                  <CardBody className="pt-4">
                    <DataNote>
                      Total sales alone does not explain salesperson quality. Activity and response
                      behaviour are included only where LUSTRE&rsquo;s systems supply interaction data.
                    </DataNote>
                  </CardBody>
                </Card>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {reps.map((r) => (
                    <div key={r.id} className="surface p-4">
                      <div className="flex items-center gap-2.5">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-secondary text-[11.5px] font-semibold text-navy">
                          {r.initials}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13.5px] font-semibold text-navy">{r.name}</p>
                          <p className="text-[11.5px] text-muted-foreground">{r.role}</p>
                        </div>
                        <span className="text-right">
                          <span
                            className={`display block text-[20px] font-semibold ${
                              r.score >= 85 ? "text-positive" : r.score >= 70 ? "text-navy" : "text-negative"
                            }`}
                          >
                            {r.score}
                          </span>
                          <span className="block text-[12px] font-semibold text-muted-foreground">
                            {r.score >= 85 ? "Strong" : r.score >= 70 ? "Steady" : "Behind"}
                          </span>
                        </span>
                      </div>
                      <p className="mt-3 text-[12px] leading-relaxed text-navy-soft">
                        <span className="font-semibold text-positive">Strength · </span>
                        {r.strength}
                      </p>
                      <p className="mt-2 text-[12px] leading-relaxed text-navy-soft">
                        <span className="font-semibold text-warn">Watch · </span>
                        {r.watch}
                      </p>
                      <div className="mt-3 border-t border-border pt-3">
                        <p className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
                          Specialisation
                        </p>
                        <p className="mt-1 text-[12.5px] font-medium text-navy">{r.specialisation}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {active === "Breakdown" && (
              <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
                <Card>
                  <CardHeader
                    icon={<UserCog size={16} />}
                    title={`${top.name} — score composition`}
                    subtitle="Best overall score on the team"
                  />
                  <CardBody>
                    <ScoreRadar
                      data={[
                        { axis: "Revenue", value: (top.revenue / 6.2) * 100 },
                        { axis: "Growth", value: Math.min(100, 50 + top.growth * 2) },
                        { axis: "Retention", value: top.retention },
                        { axis: "Recovery", value: (top.recovery ?? 0) * 20 },
                        { axis: "Repeat", value: top.repeatShare },
                        { axis: "Price held", value: top.priceRealisation },
                      ]}
                      color={palette.green}
                      height={280}
                    />
                  </CardBody>
                </Card>

                <Card>
                  <CardHeader
                    title="Strengths and weak spots"
                    subtitle="Where each account manager is strong and where coaching pays"
                  />
                  <CardBody className="space-y-5">
                    {(
                      [
                        { key: "retention", label: "Customer retention", suffix: "%", max: 100, invert: false },
                        { key: "repeatShare", label: "Repeat business share", suffix: "%", max: 100, invert: false },
                        { key: "priceRealisation", label: "Price held", suffix: "%", max: 100, invert: false },
                        { key: "concentration", label: "Portfolio concentration", suffix: "%", max: 70, invert: true },
                      ] as const
                    ).map((metric) => (
                      <div key={metric.key}>
                        <p className="mb-2 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                          {metric.label}
                        </p>
                        <div className="space-y-1.5">
                          {[...reps]
                            .sort((a, b) =>
                              metric.invert ? a[metric.key] - b[metric.key] : b[metric.key] - a[metric.key],
                            )
                            .map((r) => {
                              const v = r[metric.key];
                              const good = metric.invert ? v < 40 : v > 90;
                              const bad = metric.invert ? v > 50 : v < 80;
                              return (
                                <div key={r.id} className="flex items-center gap-2.5 text-[12px]">
                                  <span className="w-28 shrink-0 truncate text-navy-soft">{r.name}</span>
                                  <div className="flex-1">
                                    <Meter
                                      value={v}
                                      max={metric.max}
                                      tone={good ? "positive" : bad ? "negative" : "accent"}
                                      height="h-1"
                                    />
                                  </div>
                                  <span className="w-10 text-right font-semibold text-navy">
                                    {v}{metric.suffix}
                                  </span>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    ))}
                  </CardBody>
                </Card>
              </div>
            )}

            {active === "Brokers" && (
              <>
                <Card>
                  <CardHeader
                    icon={<Network size={16} />}
                    title="How each broker is doing"
                  help="How much business each broker brings, how good that business is, and how much discount they give away to get it."
                    subtitle="How much each broker brings in, how good that business is, and how much discount they give away"
                  />
                  <Table dense>
                    <thead>
                      <tr>
                        <Th>Broker</Th>
                        <Th align="right">Sales</Th>
                        <Th align="right">Share</Th>
                        <Th align="right">Customers</Th>
                        <Th align="right">How good</Th>
                        <Th align="right">Growth</Th>
                        <Th align="right">Average discount</Th>
                        <Th>How much rides on them</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {brokers.map((b) => (
                        <tr key={b.name} className="transition-colors hover:bg-secondary/40">
                          <Td>
                            <span className="font-semibold text-navy">
                              <span className="mr-2">{b.flag}</span>
                              {b.name}
                            </span>
                            <span className="mt-0.5 block text-[11.5px] text-muted-foreground">{b.note}</span>
                          </Td>
                          <Td align="right">${b.revenue}M</Td>
                          <Td align="right">{b.share}%</Td>
                          <Td align="right">{b.customers}</Td>
                          <Td align="right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-11">
                                <Meter value={b.quality} tone={b.quality >= 80 ? "positive" : b.quality >= 70 ? "accent" : "negative"} height="h-1" />
                              </div>
                              <span className="font-semibold text-navy">{b.quality}</span>
                            </div>
                          </Td>
                          <Td align="right"><Delta value={b.growth} /></Td>
                          <Td align="right" className={b.avgDiscount > 7 ? "font-semibold text-negative" : ""}>
                            {b.avgDiscount}%
                          </Td>
                          <Td>
                            <Badge tone={b.dependency === "High" ? "negative" : b.dependency === "Medium" ? "warn" : "positive"}>
                              {b.dependency}
                            </Badge>
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </Card>
              </>
            )}
          </div>
        )}
      </Tabs>
      )}
    </>
  );
}
