"use client";

import { useMemo } from "react";
import { Card, CardHeader, DataNote, Delta, Meter, Table, Td, Th } from "@/components/ui/primitives";
import { idealMix } from "@/lib/analytics/insights";
import type { Dimensions } from "@/lib/db/dimensions";
import { usd } from "@/lib/format";

export type StockTab = "Locations" | "Ideal mix";

/** Stock views worked out from what actually sold, by location and by stone type. */
export default function StockInsights({ d, tab }: { d: NonNullable<Dimensions>; tab: StockTab }) {
  const mix = useMemo(() => idealMix(d.specs).slice(0, 15), [d]);

  if (tab === "Locations") {
    const total = d.locations.reduce((a, l) => a + l.revenue, 0);
    return (
      <Card>
        <CardHeader title="Where stock sells from" subtitle="Sales and how long stones sat before selling, by location" />
        <Table dense>
          <thead>
            <tr>
              <Th>Location</Th>
              <Th align="right">Sales</Th>
              <Th align="right">Share</Th>
              <Th align="right">Stones</Th>
              <Th align="right">Days on the shelf</Th>
            </tr>
          </thead>
          <tbody>
            {d.locations.map((l) => (
              <tr key={l.name}>
                <Td className="font-semibold text-navy">{l.name}</Td>
                <Td align="right">{usd(l.revenue)}</Td>
                <Td align="right">{total ? ((l.revenue / total) * 100).toFixed(0) : 0}%</Td>
                <Td align="right">{l.stones.toLocaleString()}</Td>
                <Td align="right">{l.avgDaysInStock || "—"}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
        <DataNote>Days on the shelf is the average time between a stone entering stock and being sold. Stock on hand now is not in the sales data.</DataNote>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader title="Ideal mix" subtitle="How the next purchases could be split across stone types" />
      <Table dense>
        <thead>
          <tr>
            <Th>Stone type</Th>
            <Th align="right">Share of sales now</Th>
            <Th align="right">Days to sell</Th>
            <Th align="right">Trend</Th>
            <Th>Suggested share</Th>
          </tr>
        </thead>
        <tbody>
          {mix.map((s) => (
            <tr key={s.spec}>
              <Td className="font-semibold text-navy">{s.spec}</Td>
              <Td align="right">{s.share.toFixed(1)}%</Td>
              <Td align="right">{s.daysToSell || "—"}</Td>
              <Td align="right"><Delta value={s.growth} /></Td>
              <Td>
                <div className="flex items-center gap-2">
                  <div className="w-24"><Meter value={s.suggested} max={Math.max(...mix.map((m) => m.suggested))} tone="accent" height="h-1" /></div>
                  <span className="text-[12px] tabular-nums">{s.suggested.toFixed(1)}%</span>
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
      <DataNote>
        The suggested share starts from each type&apos;s share of sales, then gives more to types that sell faster than
        the middle one and are growing, and less to slow or shrinking ones. It guides buying; it does not know what
        is on the shelf today.
      </DataNote>
    </Card>
  );
}
