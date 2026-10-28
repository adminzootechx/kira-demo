"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Target as TargetIcon } from "lucide-react";
import { EmptyState } from "@/components/ui/feedback";
import {
  Badge, Card, CardBody, CardHeader, DataNote, KpiCard, Meter, PageHeader, Table, Td, Th,
} from "@/components/ui/primitives";
import { useCustomerAnalytics } from "@/lib/data/store";
import { closeTheGap } from "@/lib/analytics/insights";
import { usd } from "@/lib/format";
import type { TargetRow, TargetsResponse } from "@/app/api/targets/route";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Share of the year gone by the data date: sales after it are not loaded yet, so pace stops there too. */
function yearFractionElapsed(year: number, asOf: string) {
  const start = Date.UTC(year, 0, 1);
  const end = Date.UTC(year + 1, 0, 1);
  return Math.min(1, Math.max(0, (Date.parse(asOf) + 86_400_000 - start) / (end - start)));
}

const dayLabel = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

function Progress({ row, year, who, share, asOf }: { row: TargetRow; year: number; who: string; share: number | null; asOf: string }) {
  const { customers, reorderDue } = useCustomerAnalytics();
  // Last year's shape says how much of a year's sales normally lands by now;
  // a straight line is only the fallback when there is no full prior year.
  const elapsed = share ?? yearFractionElapsed(year, asOf);
  const asOfLabel = dayLabel(asOf);
  const projected = elapsed > 0.05 ? row.actual / elapsed : null;
  const levers = closeTheGap(
    customers,
    new Set(reorderDue.filter((c) => c.kind === "Past their usual time").map((c) => c.name)),
    (a) => (a as { name: string }).name,
    1 - elapsed,
    projected ? Math.max(0, projected - row.actual) : 0,
  );
  const target = row.target ?? 0;
  const expected = target * elapsed;
  const gap = row.actual - expected;
  const monthsLeft = Math.max(1, 12 - (Number(asOf.slice(5, 7)) - 1));
  const stillNeeded = Math.max(0, target - row.actual);
  const pct = target ? (row.actual / target) * 100 : 0;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label={`${who} target for ${year}`} value={usd(target)} sub="Set by your administrator" help="The yearly amount management has set in Administration. It is the figure every pace and projection on this page is measured against." />
        <KpiCard
          label="Sold so far"
          value={usd(row.actual)}
          sub={`${pct.toFixed(0)}% of the target, counting the salesperson recorded on each sale`}
          tone="accent"
          footer={
            row.handled !== null ? (
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
                From the customers {who === "Your" ? "you handle" : "they handle"} now:{" "}
                <span className="font-semibold text-navy">{usd(row.handled)}</span>
              </p>
            ) : undefined
          }
        />
        <KpiCard
          label={gap >= 0 ? "Ahead of pace" : "Behind pace"}
          value={usd(Math.abs(gap))}
          tone={gap >= 0 ? "positive" : "negative"}
          sub={`Should have sold ${usd(expected)} by ${asOfLabel}, going by last year's pattern`}
        />
        {projected !== null && (
          <KpiCard
            label="Expected by year end"
            value={usd(projected)}
            tone={projected >= target ? "positive" : "negative"}
            sub={projected >= target ? "On course to reach the target" : `${usd(target - projected)} short at this pace`}
          />
        )}
        <KpiCard
          label="Still to sell"
          value={usd(stillNeeded)}
          sub={stillNeeded ? `About ${usd(stillNeeded / monthsLeft)} a month for the rest of the year` : "Target reached"}
        />
      </div>

      <Card>
        <CardHeader title="Progress through the year" subtitle={`The bar shows what has been sold; the marker is where last year's sales pattern says you should be by ${asOfLabel}, the date the sales data runs to.`} />
        <CardBody>
          <div className="relative">
            <Meter value={Math.min(row.actual, target)} max={target} tone={gap >= 0 ? "positive" : "warn"} height="h-3" />
            <span
              aria-hidden
              className="absolute -top-1 h-5 w-0.5 bg-navy"
              style={{ left: `${Math.min(100, elapsed * 100)}%` }}
            />
          </div>
          <p className="mt-2 text-[12px] text-muted-foreground">
            {pct.toFixed(0)}% sold, {(elapsed * 100).toFixed(0)}% of the year gone by {asOfLabel}.
          </p>
        </CardBody>
      </Card>

      {target > row.actual && (
        <Card>
          <CardHeader title="Ways to close the gap" subtitle={`What could add to the ${usd(Math.max(0, target - (projected ?? row.actual)))} still missing`} />
          <Table dense>
            <thead>
              <tr>
                <Th>Where it could come from</Th>
                <Th align="right">Worth about</Th>
              </tr>
            </thead>
            <tbody>
              {levers.map((l) => (
                <tr key={l.label}>
                  <Td>
                    <span className="font-semibold text-navy">{l.label}</span>
                    <span className="block text-[11.5px] text-muted-foreground">{l.detail}</span>
                  </Td>
                  <Td align="right" className="font-semibold text-navy">{usd(l.expected)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <DataNote>
            Each figure is the amount at stake times the chance the customer keeps buying, so they are cautious
            estimates and they overlap. They are not a promise.
          </DataNote>
        </Card>
      )}

      <Card>
        <CardHeader title="Sales by month" subtitle={`Against an even monthly share of ${usd(target / 12)}`} />
        <CardBody className="space-y-3">
          {row.monthly.map((v, i) => (
            <div key={MONTHS[i]}>
              <div className="flex items-baseline justify-between text-[13px]">
                <span className="text-navy-soft">{MONTHS[i]}</span>
                <span className="font-semibold text-navy">{usd(v)}</span>
              </div>
              <div className="mt-1">
                <Meter value={v} max={Math.max(target / 12, ...row.monthly)} tone={v >= target / 12 ? "positive" : "accent"} height="h-1.5" />
              </div>
            </div>
          ))}
        </CardBody>
      </Card>
    </>
  );
}

export default function TargetsPage() {
  const [data, setData] = useState<TargetsResponse | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch("/api/targets", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setFailed(true));
  }, []);

  const mine = useMemo(() => (data && !data.isAdmin ? data.reps[0] : null), [data]);

  return (
    <>
      <PageHeader
        title="Targets"
        subtitle="How this year's sales are tracking against target."
        actions={data ? <Badge tone="accent">{data.year}</Badge> : undefined}
      />

      {failed && (
        <Card>
          <EmptyState title="Targets could not be loaded" description="Check your connection and reload the page." />
        </Card>
      )}

      {data && !data.isAdmin && (
        mine?.target ? (
          <Progress row={mine} year={data.year} who="Your" share={data.seasonalShare} asOf={data.asOf} />
        ) : (
          <Card>
            <EmptyState
              icon={<TargetIcon size={22} strokeWidth={1.8} />}
              title="No target set for you yet"
              description={`Your administrator sets yearly targets. You have sold ${usd(mine?.actual ?? 0)} so far in ${data.year}.`}
            />
          </Card>
        )
      )}

      {data?.isAdmin && (
        <>
          {data.company?.target ? (
            <Progress row={data.company} year={data.year} who="Company" share={data.seasonalShare} asOf={data.asOf} />
          ) : (
            <Card>
              <EmptyState
                icon={<TargetIcon size={22} strokeWidth={1.8} />}
                title="No company target set yet"
                description={`${usd(data.company?.actual ?? 0)} sold so far in ${data.year}.`}
                action={<Link href="/admin/targets" className="btn btn-secondary">Set targets in Administration</Link>}
              />
            </Card>
          )}

          <Card>
            <CardHeader
              title="By salesperson"
              subtitle="Sold so far against each person's target"
              action={<Link href="/admin/targets" className="btn btn-ghost text-[12px]">Edit targets</Link>}
            />
            <Table>
              <thead>
                <tr>
                  <Th>Salesperson</Th>
                  <Th align="right">Target</Th>
                  <Th align="right">Sold, by salesperson on the sale</Th>
                  <Th align="right">From clients they handle now</Th>
                  <Th>Progress</Th>
                </tr>
              </thead>
              <tbody>
                {data.reps.map((r) => (
                  <tr key={r.owner}>
                    <Td className="font-semibold text-navy">{r.owner}</Td>
                    <Td align="right">{r.target ? usd(r.target) : <span className="text-muted-foreground">Not set</span>}</Td>
                    <Td align="right">{usd(r.actual)}</Td>
                    <Td align="right" className="text-muted-foreground">{usd(r.handled ?? 0)}</Td>
                    <Td>
                      {r.target ? (
                        <div className="flex items-center gap-2">
                          <div className="w-28">
                            <Meter value={Math.min(r.actual, r.target)} max={r.target} tone="accent" height="h-1" />
                          </div>
                          <span className="text-[12px] tabular-nums">{((r.actual / r.target) * 100).toFixed(0)}%</span>
                        </div>
                      ) : null}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <DataNote>
              Two ways of counting the same sales. &quot;By salesperson on the sale&quot; credits each sale to the person
              recorded on it, and is what progress is measured on. &quot;From clients they handle now&quot; credits each
              customer&apos;s sales to whoever handles them today, as Team does, so a reassigned customer&apos;s history moves
              with them. Targets are the amounts entered in Administration.
            </DataNote>
          </Card>
        </>
      )}
    </>
  );
}
