"use client";

import { perCarat, usd } from "@/lib/format";

import { Percent, Scale } from "lucide-react";
import { useDimensions } from "@/lib/data/dimensionStore";
import { liveBenchmark, liveDiscountBands, liveReps } from "@/lib/data/live";
import { ImportBanner } from "@/components/ui/ImportBanner";
import { EmptyState } from "@/components/ui/feedback";
import { Bars, palette } from "@/components/charts";
import { Tabs } from "@/components/ui/Tabs";
import PriceInsights from "@/components/pricing/PriceInsights";
import {
  Card, CardBody, CardHeader, DataNote, Delta, KpiCard,
  Meter, PageHeader, Table, Td, Th,
} from "@/components/ui/primitives";

export default function PricingPage() {
  const { dimensions, isImported, isLoading } = useDimensions();
  const d = dimensions;

  // Each stone type against its own price across all sales (comparable
  // historical transactions, SOW 5.4).
  const priceBenchmark = d ? liveBenchmark(d) : [];
  const discountBands = d ? liveDiscountBands(d) : [];
  // Realisation is the share of Rap list actually retained, so a lower
  // discount reads as better pricing. Ranked against the team, not an
  // external feed — the export carries no market price.
  //
  // On this book that share is a low single-digit percentage, and it is
  // supposed to be: LUSTRE sells lab-grown against the *natural* Rapaport list,
  // and a 98-99% spread is the market rather than anything a rep conceded.
  // The ranking is what carries the meaning here, not the level.
  const repPricingSkill = d
    ? [...liveReps(d)]
        .filter((r) => r.avgDiscount > 0)
        .sort((a, b) => a.avgDiscount - b.avgDiscount)
        .slice(0, 8)
        .map((r, i) => ({
          rep: r.name,
          realisation: Number((100 - r.avgDiscount).toFixed(1)),
          avgDiscount: Number(r.avgDiscount.toFixed(1)),
          rank: i + 1,
        }))
    : [];
  const pricingKpis = d
    ? [
        { label: "Price per carat", value: perCarat(d.overview.realisedRate), delta: 0, sub: "Across the whole mix of stones" },
        { label: "Average discount", value: `${d.overview.avgDiscount.toFixed(1)}%`, delta: 0, sub: "Off the natural Rapaport list" },
        { label: "Average invoice", value: `$${Math.round(d.overview.avgOrderValue).toLocaleString()}`, delta: 0, sub: `${Math.round(d.overview.orders).toLocaleString()} orders in the period` },
        { label: "Specifications priced", value: d.specs.length.toString(), delta: 0, sub: "With 30+ comparable sales" },
      ]
    : [];

  return (
    <>
      <PageHeader
        title="Prices"
        subtitle="What we actually sold at, how much discount we gave, which customers push hardest on price, and where money is being left behind."
      />

      <ImportBanner
        isImported={isImported}
        isLoading={isLoading}
        note={
          isImported
            ? "Prices, discount bands and comparisons are worked out from every sale in your sales records. Discount is measured against list price, so it reads in the high nineties across the whole book — compare salespeople and stone types against each other, not against the number itself."
            : undefined
        }
      />

      {!isLoading && !d && (
        <Card>
          <EmptyState title="No pricing data yet" description="Prices, discounts and comparisons are worked out from your lot-level sales. They appear here once that data is available." />
        </Card>
      )}

      {d && (
        <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {pricingKpis.map((k) => (
          <KpiCard
            key={k.label}
            label={k.label}
            value={k.value}
            delta={k.delta || undefined}
            sub={k.sub}
          />
        ))}
      </div>

      <Tabs tabs={["Comparison", "Discounts", "Odd sales", "Price rises", "Money lost", "Terms"]}>
        {(active) => (
          <div className="mt-6 space-y-6">
            {active === "Comparison" && (
              <Card>
                <CardHeader
                  icon={<Scale size={16} />}
                  title="How our prices compare"
                  help="What each type of stone sold for recently, against its own price across all our sales. A big gap either way is worth a look."
                  subtitle="Recent price per carat against each stone type's own usual price"
                />
                <Table dense>
                  <thead>
                    <tr>
                      <Th>Stone type</Th>
                      <Th align="right">Usual price</Th>
                      <Th align="right">Recently</Th>
                      <Th align="right">Difference</Th>
                      <Th align="right">Stones</Th>
                      <Th align="right">What the drop cost</Th>
                      <Th align="right">Against usual</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {priceBenchmark.map((p) => (
                      <tr key={p.spec} className="transition-colors hover:bg-secondary/40">
                        <Td className="font-semibold text-navy">{p.spec}</Td>
                        <Td align="right" className="text-muted-foreground">{perCarat(p.benchmark)}</Td>
                        <Td align="right">{perCarat(p.realised)}</Td>
                        <Td align="right"><Delta value={p.variance} /></Td>
                        <Td align="right">{p.stones.toLocaleString()}</Td>
                        <Td align="right" className={p.leakage > 0 ? "font-semibold text-negative" : "text-muted-foreground"}>
                          {p.leakage > 0 ? usd(p.leakage) : "—"}
                        </Td>
                        <Td align="right">
                          <div className="ml-auto flex w-28 items-center gap-1">
                            <div className="flex h-1.5 flex-1 justify-end overflow-hidden rounded-l-full bg-muted">
                              {p.variance < 0 && (
                                <div className="h-full rounded-l-full bg-negative" style={{ width: `${Math.min(100, Math.abs(p.variance) * 12)}%` }} />
                              )}
                            </div>
                            <div className="h-3 w-px bg-border" />
                            <div className="flex h-1.5 flex-1 overflow-hidden rounded-r-full bg-muted">
                              {p.variance > 0 && (
                                <div className="h-full rounded-r-full bg-positive" style={{ width: `${Math.min(100, p.variance * 12)}%` }} />
                              )}
                            </div>
                          </div>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
                <CardBody className="pt-4">
                  <DataNote>
                    Each stone type (shape, size, colour and clarity) is compared only with itself:
                    its price over the latest months against its price across all our sales. A drop
                    can mean weaker prices or a change in the stones sold within the type.
                  </DataNote>
                </CardBody>
              </Card>
            )}

            {active === "Discounts" && (
              <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader
                    icon={<Percent size={16} />}
                    title="How much discount we give"
                    subtitle="Transaction count and invoiced value by discount band"
                  />
                  <CardBody>
                    <Bars
                      data={discountBands.map((d) => ({ band: d.band, value: d.value }))}
                      xKey="band"
                      yKey="value"
                      name="Value $M"
                      unit="M"
                      height={240}
                      colorBy={(r) => ((r.value as number) < 20 ? palette.red : (r.value as number) < 50 ? palette.amber : palette.navy)}
                    />
                    <div className="mt-4 space-y-2">
                      {discountBands.map((d) => (
                        <div key={d.band} className="flex items-center gap-3 text-[12px]">
                          <span className="w-14 font-medium text-navy">{d.band}</span>
                          <div className="flex-1">
                            <Meter
                              value={d.share}
                              max={35}
                              tone={d.band === "99.9 to 100%" || d.band.startsWith("Over 100") ? "negative" : "accent"}
                              height="h-1"
                            />
                          </div>
                          <span className="w-28 text-right text-muted-foreground">
                            {d.txns.toLocaleString()} txns · {d.share}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardBody>
                </Card>

                <Card>
                  <CardHeader
                    title="Who holds price best"
                    subtitle="How well each account manager holds price"
                  />
                  <Table dense>
                    <thead>
                      <tr>
                        <Th align="center">#</Th>
                        <Th>Account manager</Th>
                        <Th align="right">Price held</Th>
                        <Th align="right">Average discount</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {repPricingSkill.map((r) => (
                        <tr key={r.rep} className="transition-colors hover:bg-secondary/40">
                          <Td align="center" className="text-muted-foreground">{r.rank}</Td>
                          <Td className="font-semibold text-navy">{r.rep}</Td>
                          <Td align="right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16">
                                <Meter
                                  value={r.realisation}
                                  max={100}
                                  tone={r.realisation >= 96 ? "positive" : r.realisation >= 93 ? "warn" : "negative"}
                                  height="h-1"
                                />
                              </div>
                              <span className="font-semibold text-navy">{r.realisation}%</span>
                            </div>
                          </Td>
                          <Td align="right" className={r.avgDiscount > 6 ? "font-semibold text-negative" : ""}>
                            {r.avgDiscount}%
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </Card>
              </div>
            )}
            {(active === "Odd sales" || active === "Price rises" || active === "Money lost" || active === "Terms") && <PriceInsights d={d} tab={active} />}
          </div>
        )}
      </Tabs>
        </>
      )}
    </>
  );
}
