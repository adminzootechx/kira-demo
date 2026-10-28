"use client";

import { useMemo } from "react";
import { Card, CardHeader, DataNote, Delta, Table, Td, Th } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/feedback";
import { moneyLeftBehind, oddSellers } from "@/lib/analytics/insights";
import type { Dimensions } from "@/lib/db/dimensions";
import { perCarat, usd } from "@/lib/format";

export type PriceTab = "Odd sales" | "Price rises" | "Money lost" | "Terms";

/** The four pricing views that are worked out from the sales rollups. */
export default function PriceInsights({ d, tab }: { d: NonNullable<Dimensions>; tab: PriceTab }) {
  const sellers = useMemo(
    () => d.owners.map((o) => ({ name: o.name, stones: o.stones, discount: o.avgDiscount, sales: o.revenue })),
    [d],
  );
  const odd = useMemo(() => oddSellers(sellers), [sellers]);
  const lost = useMemo(() => moneyLeftBehind(sellers), [sellers]);

  if (tab === "Odd sales") {
    return (
      <Card>
        <CardHeader title="Discounts that stand out" subtitle="Salespeople whose average discount is far from the rest of the team" />
        {odd.length === 0 ? (
          <EmptyState title="Nothing stands out" description="No salesperson is unusually far from the team's average price." />
        ) : (
          <Table dense>
            <thead>
              <tr>
                <Th>Salesperson</Th>
                <Th align="right">Average discount</Th>
                <Th align="right">Team average</Th>
                <Th>What it means</Th>
              </tr>
            </thead>
            <tbody>
              {odd.map((s) => (
                <tr key={s.name}>
                  <Td className="font-semibold text-navy">{s.name}</Td>
                  <Td align="right">{s.discount.toFixed(2)}%</Td>
                  <Td align="right" className="text-muted-foreground">{s.teamAverage.toFixed(2)}%</Td>
                  <Td className={s.z > 0 ? "text-negative" : "text-positive"}>
                    {s.z > 0 ? "Gives deeper discounts than most" : "Holds price better than most"}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        <DataNote>
          A salesperson shows here when their average is more than 1.5 standard deviations from the team&apos;s,
          weighted by stones sold. People with fewer than 200 stones are left out because their average is too noisy.
        </DataNote>
      </Card>
    );
  }

  if (tab === "Price rises") {
    const moves = [...d.priceMoves].sort((a, b) => b.change - a.change);
    const show = [...moves.slice(0, 8), ...moves.slice(-8).filter((m) => !moves.slice(0, 8).includes(m))];
    return (
      <Card>
        <CardHeader title="Where prices are moving" subtitle="Price per carat over the latest three full months, against the three before" />
        {show.length === 0 ? (
          <EmptyState title="Not enough history" description="Price movement needs at least six full months of sales." />
        ) : (
          <Table dense>
            <thead>
              <tr>
                <Th>Shape and size</Th>
                <Th align="right">Now</Th>
                <Th align="right">Before</Th>
                <Th align="right">Change</Th>
              </tr>
            </thead>
            <tbody>
              {show.map((m) => (
                <tr key={`${m.shape}${m.carat}`}>
                  <Td className="font-semibold text-navy">{m.shape} {m.carat}</Td>
                  <Td align="right">{perCarat(m.rate)}</Td>
                  <Td align="right" className="text-muted-foreground">{perCarat(m.priorRate)}</Td>
                  <Td align="right"><Delta value={m.change} /></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        <DataNote>Price per carat also moves with the colour and clarity sold, so read a change as a signal to look closer.</DataNote>
      </Card>
    );
  }

  if (tab === "Money lost") {
    return (
      <Card>
        <CardHeader
          title="Money left on the table"
          subtitle={`What each salesperson discounting more than the team average of ${lost.teamAverage.toFixed(2)}% would have added at that average`}
        />
        {lost.rows.length === 0 ? (
          <EmptyState title="Nothing to show" description="No salesperson with enough sales discounts more than the team average." />
        ) : (
          <Table dense>
            <thead>
              <tr>
                <Th>Salesperson</Th>
                <Th align="right">Average discount</Th>
                <Th align="right">Left on the table</Th>
              </tr>
            </thead>
            <tbody>
              {lost.rows.map((r) => (
                <tr key={r.name}>
                  <Td className="font-semibold text-navy">{r.name}</Td>
                  <Td align="right">{r.discount.toFixed(2)}%</Td>
                  <Td align="right" className="font-semibold text-negative">{usd(r.amount)}</Td>
                </tr>
              ))}
              <tr>
                <Td className="font-semibold text-navy">Total</Td>
                <Td />
                <Td align="right" className="font-semibold text-negative">{usd(lost.total)}</Td>
              </tr>
            </tbody>
          </Table>
        )}
        <DataNote>
          This compares people with each other, not with an outside price, so it is the gain from bringing everyone
          up to the team average. Different customers and stones will explain part of any gap.
        </DataNote>
      </Card>
    );
  }

  const total = d.terms.reduce((a, t) => a + t.revenue, 0);
  return (
    <Card>
      <CardHeader title="Payment terms" subtitle="Sales by the terms agreed with the customer" />
      {d.terms.length === 0 ? (
        <EmptyState title="No terms recorded" description="The sales data does not name payment terms." />
      ) : (
        <Table dense>
          <thead>
            <tr>
              <Th>Terms</Th>
              <Th align="right">Sales</Th>
              <Th align="right">Share</Th>
              <Th align="right">Average discount</Th>
            </tr>
          </thead>
          <tbody>
            {d.terms.map((t) => (
              <tr key={t.name}>
                <Td className="font-semibold text-navy">{t.name}</Td>
                <Td align="right">{usd(t.revenue)}</Td>
                <Td align="right">{total ? ((t.revenue / total) * 100).toFixed(0) : 0}%</Td>
                <Td align="right">{t.avgDiscount ? `${t.avgDiscount.toFixed(2)}%` : "—"}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <DataNote>Longer terms tie up cash. Compare the price realised against how long customers take to pay once payment dates are available.</DataNote>
    </Card>
  );
}
