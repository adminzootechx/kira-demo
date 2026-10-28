"use client";

import { Boxes, Gem, Zap } from "lucide-react";
import { useDimensions } from "@/lib/data/dimensionStore";
import type { Dimensions } from "@/lib/db/dimensions";
import { EmptyState } from "@/components/ui/feedback";
import { liveHeatmap, liveSpecs, periodLabel } from "@/lib/data/live";
import { ImportBanner } from "@/components/ui/ImportBanner";
import { Bars, palette } from "@/components/charts";
import { Tabs } from "@/components/ui/Tabs";
import StockInsights from "@/components/pricing/StockInsights";
import {
  Badge, Card, CardBody, CardHeader, DataNote, Delta, KpiCard,
  Meter, PageHeader, Table, Td, Th,
} from "@/components/ui/primitives";
import { perCarat, usd, type Tone } from "@/lib/format";

const statusTone: Record<string, Tone> = {
  Accelerating: "positive",
  Steady: "info",
  Weakening: "warn",
  Oversupplied: "negative",
  Short: "accent",
};

const riskTone: Record<string, Tone> = {
  Healthy: "positive",
  Watch: "info",
  Ageing: "warn",
  "Stock that may never sell": "negative",
};

export default function ProductsPage() {
  const { dimensions, isImported, isLoading } = useDimensions();
  if (!dimensions) {
    return (
      <>
        <PageHeader
          title="Stock"
          subtitle="What is selling and what is sitting, by shape, size, colour and clarity."
        />
        {!isLoading && (
          <Card>
            <EmptyState title="No stock data yet" description="Stone-type demand and time on shelf are worked out from your lot-level sales. They appear here once that data is available." />
          </Card>
        )}
      </>
    );
  }
  return <ProductsView dimensions={dimensions} isImported={isImported} isLoading={isLoading} />;
}

function ProductsView({
  dimensions, isImported, isLoading,
}: { dimensions: NonNullable<Dimensions>; isImported: boolean; isLoading: boolean }) {

  // The imported book when there is one, the sample otherwise. Stock-on-hand
  // columns stay on the sample either way: the export is completed sales, so
  // it carries no current inventory to report.
  const specPerformance = liveSpecs(dimensions, dimensions.period.currentDays);
  const demandHeatmap = liveHeatmap(dimensions);
  const inventoryAgeing = dimensions.ageing.map((a) => ({
        band: `${a.band} days`, carats: a.carats, value: a.revenue / 1e6,
        risk: a.band === "365+" ? "Stock that may never sell"
            : a.band === "181-365" ? "Ageing" : a.band === "91-180" ? "Watch" : "Healthy",
      }));

  return (
    <>
      <PageHeader
        title="Stock"
        subtitle="What is selling and what is sitting, by shape, size, colour and clarity — plus how long stock has been on the shelf and where it should be."
        actions={<Badge tone="accent">{specPerformance.length} specifications</Badge>}
      />

      <ImportBanner
        isImported={isImported}
        isLoading={isLoading}
        note={
          isImported
            ? "Demand, price per carat and days to sell come from every sale in your records. The sales data does not include what is on the shelf now, so stock on hand is not shown."
            : undefined
        }
      />

      {(
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Carats sold" value={`${Math.round(dimensions.overview.carats).toLocaleString()} ct`} sub={periodLabel(dimensions)} />
          <KpiCard label="Stones sold" value={Math.round(dimensions.overview.stones).toLocaleString()} sub={`${Math.round(dimensions.overview.orders).toLocaleString()} orders`} />
          <KpiCard label="Price per carat" value={`$${Math.round(dimensions.overview.realisedRate).toLocaleString()}/ct`} sub="Across the whole mix of stones" />
          <KpiCard label="Specifications" value={dimensions.specs.length.toString()} sub="Distinct shape, size, colour and clarity combinations" />
        </div>
      )}

      <Tabs tabs={["By type", "Demand", "Time on shelf", "Locations", "Ideal mix"]}>
        {(active) => (
          <div className="mt-6 space-y-6">
            {active === "By type" && (
              <Card>
                <CardHeader
                  icon={<Gem size={16} />}
                  title="How each type of stone is selling"
                  help="Each row is one kind of stone — shape, size, colour, clarity. It shows what it earned, how fast it moves, and whether it risks sitting unsold."
                  subtitle="For each stone type: what it earned, what it sold at, how fast it moves, and how likely it is to sit"
                />
                <Table dense>
                  <thead>
                    <tr>
                      <Th>Stone type</Th>
                      <Th align="right">Sales</Th>
                      <Th align="right">Price per carat</Th>
                      <Th align="right">Growth</Th>
                      <Th align="right">How fast it sells</Th>
                      <Th align="right">Days to sell</Th>
                      <Th>Status</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {specPerformance.map((s) => (
                      <tr key={s.spec} className="transition-colors hover:bg-secondary/40">
                        <Td className="font-semibold text-navy">
                          {s.spec}
                          <span className="mt-0.5 block text-[12.5px] font-normal text-muted-foreground">
                            {Math.round(s.carats).toLocaleString()} ct · {s.stones.toLocaleString()} stones
                          </span>
                        </Td>
                        <Td align="right">{usd(s.revenue)}</Td>
                        <Td align="right">{perCarat(s.rate)}</Td>
                        <Td align="right"><Delta value={s.growth} /></Td>
                        <Td align="right">{s.velocity.toLocaleString()}</Td>
                        <Td align="right">
                          {s.daysToSell > 90 ? (
                            <span className="font-semibold text-negative">{s.daysToSell} · slow</span>
                          ) : (
                            s.daysToSell
                          )}
                        </Td>
                        <Td><Badge tone={statusTone[s.status]}>{s.status}</Badge></Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
                <CardBody className="pt-4">
                  <DataNote>
                    Expected days-to-sell is derived from historical how fast it sells for the same
                    stone type. Live stock-out risk and true inventory cover activate against
                    LUSTRE&rsquo;s live inventory feed once available.
                  </DataNote>
                </CardBody>
              </Card>
            )}

            {active === "Demand" && (
              <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
                <Card>
                  <CardHeader
                    title="What is in demand, by shape and size"
                    subtitle="Darker squares are selling better than average."
                  />
                  <CardBody>
                    <div className="overflow-x-auto">
                      <div className="min-w-[520px]">
                        <div className="grid grid-cols-[132px_repeat(6,1fr)] gap-1">
                          <div />
                          {demandHeatmap.cols.map((c) => (
                            <div key={c} className="pb-1 text-center text-[10.5px] font-semibold text-muted-foreground">
                              {c}
                            </div>
                          ))}
                          {demandHeatmap.rows.map((row, ri) => (
                            <div key={row} className="contents">
                              <div className="flex items-center pr-2 text-[12px] font-medium text-navy">
                                {row}
                              </div>
                              {demandHeatmap.values[ri].map((v, ci) => (
                                <div
                                  key={ci}
                                  title={`${row} · ${demandHeatmap.cols[ci]} — demand index ${v}`}
                                  className="flex h-9 items-center justify-center rounded border border-border/50 text-[11.5px] font-semibold"
                                  style={{
                                    background: `rgba(2, 37, 75, ${0.06 + (v / 100) * 0.82})`,
                                    color: v > 55 ? "#fff" : "#0F1729",
                                  }}
                                >
                                  {v}
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              </div>
            )}

            {active === "Time on shelf" && (
              <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
                <Card>
                  <CardHeader
                    icon={<Boxes size={16} />}
                    title="How long stock has been sitting"
                  help="Stock grouped by how long we have held it. The longer something sits, the more likely it is to need a discount to shift."
                    subtitle="How much stock is sitting, and for how long"
                  />
                  <CardBody className="space-y-3.5">
                    {inventoryAgeing.map((b) => (
                      <div key={b.band}>
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-[13px] font-medium text-navy">{b.band}</span>
                          <Badge tone={riskTone[b.risk]}>{b.risk}</Badge>
                        </div>
                        <div className="mt-1.5">
                          <Meter
                            value={"share" in b ? (b.share as number) : b.value}
                            max={"share" in b ? 25 : undefined}
                            tone={riskTone[b.risk]}
                            height="h-1.5"
                          />
                        </div>
                        <p className="mt-1 text-[11.5px] text-muted-foreground">
                          {Math.round(b.carats).toLocaleString()} ct · ${b.value.toFixed(1)}M
                          {"share" in b ? ` · ${b.share}% of inventory` : " sold from this age band"}
                        </p>
                      </div>
                    ))}
                  </CardBody>
                </Card>

                <Card>
                  <CardHeader
                    icon={<Zap size={16} />}
                    title="How fast each type of stone sells"
                    subtitle="Stones sold per 30 days — the input to expected days-to-sell"
                  />
                  <CardBody>
                    <Bars
                      data={specPerformance.map((s) => ({
                        spec: s.shape.replace(" Brilliant", ""),
                        velocity: s.velocity,
                      }))}
                      xKey="spec"
                      yKey="velocity"
                      name="Stones / 30 days"
                      height={260}
                      colorBy={(r) => ((r.velocity as number) > 1000 ? palette.navy : (r.velocity as number) > 300 ? palette.accent : palette.red)}
                    />
                  </CardBody>
                </Card>
              </div>
            )}
            {(active === "Locations" || active === "Ideal mix") && <StockInsights d={dimensions} tab={active} />}
          </div>
        )}
      </Tabs>
    </>
  );
}
