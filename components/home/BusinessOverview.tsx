"use client";

import { useMemo } from "react";
import { Lightbulb } from "lucide-react";
import { Bars, palette } from "@/components/charts";
import { Card, CardBody, CardHeader, DataNote, Delta, Table, Td, Th } from "@/components/ui/primitives";
import { useDimensions } from "@/lib/data/dimensionStore";
import { useCustomerAnalytics } from "@/lib/data/store";
import { briefing, completeMonths, forecast, revenueBridge } from "@/lib/analytics/insights";
import { usd } from "@/lib/format";

const dayLabel = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

const label = (ym: string) =>
  new Date(`${ym}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" });

/** Company-wide view for management: how sales moved, where, and what comes next. */
export default function BusinessOverview() {
  const { dimensions: d } = useDimensions();
  const { customers, reorderDue } = useCustomerAnalytics();

  const view = useMemo(() => {
    if (!d) return null;
    const asOf = d.period.currentTo;
    const done = completeMonths(d.monthly, asOf);
    const last12 = done.slice(-12);
    const ahead = forecast(d.monthly, asOf, 6);
    const bridge = revenueBridge(customers);
    const overdue = reorderDue.filter((c) => c.kind === "Past their usual time");
    const story = briefing({
      overview: d.overview,
      hasPrior: d.period.hasPrior,
      periodLabel: `${dayLabel(d.period.currentFrom)} to ${dayLabel(d.period.currentTo)}`,
      countries: d.countries,
      specs: d.specs,
      customers,
      overdueReorders: {
        count: overdue.length,
        value: overdue.reduce((s, c) => s + c.avgTxn, 0),
      },
    });
    return { last12, ahead, bridge, story };
  }, [d, customers, reorderDue]);

  if (!d || !view) return null;

  return (
    <>
      <Card>
        <CardHeader icon={<Lightbulb size={16} />} title="What to know today" subtitle="Written from your own sales figures each time the page loads" />
        <CardBody>
          <ul className="space-y-2 text-[13.5px] leading-relaxed text-navy-soft">
            {view.story.map((s) => (
              <li key={s} className="flex gap-2.5">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
                {s}
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Sales by month" subtitle="Last twelve full months, in $M" />
          <CardBody>
            <Bars
              data={view.last12.map((m) => ({ month: label(m.month), value: Math.round(m.revenue / 1e5) / 10 }))}
              xKey="month"
              yKey="value"
              name="Sales $M"
              unit="M"
              height={240}
              colorBy={() => palette.navy}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="What moved sales" subtitle="Last 12 months against the 12 before, by kind of customer" />
          <Table dense>
            <thead>
              <tr>
                <Th>Who</Th>
                <Th align="right">Change in sales</Th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <Td className="text-muted-foreground">The 12 months before</Td>
                <Td align="right">{usd(view.bridge.prior)}</Td>
              </tr>
              {view.bridge.steps.map((s) => (
                <tr key={s.label}>
                  <Td>
                    <span className="font-semibold text-navy">{s.label}</span>
                    <span className="block text-[11.5px] text-muted-foreground">{s.note}</span>
                  </Td>
                  <Td align="right" className={s.value >= 0 ? "text-positive" : "text-negative"}>
                    {s.value >= 0 ? "+" : "−"}{usd(Math.abs(s.value))}
                  </Td>
                </tr>
              ))}
              <tr>
                <Td className="font-semibold text-navy">The last 12 months</Td>
                <Td align="right" className="font-semibold text-navy">{usd(view.bridge.now)}</Td>
              </tr>
            </tbody>
          </Table>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Markets" subtitle={`Sales by country, ${d.period.currentFrom} to ${d.period.currentTo}`} />
          <Table dense>
            <thead>
              <tr>
                <Th>Country</Th>
                <Th align="right">Sales</Th>
                <Th align="right">Share</Th>
                {d.period.hasPrior && <Th align="right">Change</Th>}
              </tr>
            </thead>
            <tbody>
              {d.countries.slice(0, 8).map((c) => (
                <tr key={c.name}>
                  <Td className="font-semibold text-navy">{c.name}</Td>
                  <Td align="right">{usd(c.revenue)}</Td>
                  <Td align="right">{c.share.toFixed(0)}%</Td>
                  {d.period.hasPrior && (
                    <Td align="right">
                      <Delta value={c.growth} />
                    </Td>
                  )}
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>

        <Card>
          <CardHeader title="The year ahead" subtitle="Expected sales for the next months, with a likely range" />
          {view.ahead ? (
            <Table dense>
              <thead>
                <tr>
                  <Th>Month</Th>
                  <Th align="right">Expected</Th>
                  <Th align="right">Likely range</Th>
                </tr>
              </thead>
              <tbody>
                {view.ahead.map((f) => (
                  <tr key={f.month}>
                    <Td className="font-semibold text-navy">{label(f.month)}</Td>
                    <Td align="right">{usd(f.revenue)}</Td>
                    <Td align="right" className="text-muted-foreground">
                      {usd(f.low)} to {usd(f.high)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <CardBody>
              <p className="text-[13px] text-muted-foreground">A forecast needs at least 15 full months of sales history.</p>
            </CardBody>
          )}
          <DataNote>
            Each month starts from the same month last year and applies how the latest three months compare with a
            year ago, eased back toward flat. The range is how much recent months have varied.
          </DataNote>
        </Card>
      </div>
    </>
  );
}
