"use client";

import Link from "next/link";
import type { Customer } from "@/lib/data/types";
import { Badge, Meter } from "@/components/ui/primitives";
import DataTable, { type Column, type Facet } from "@/components/ui/DataTable";
import { usd, type Tone } from "@/lib/format";

export const segmentTone: Record<string, Tone> = {
  VIP: "accent", Growing: "positive", Healthy: "info", Stable: "neutral",
  Declining: "warn", Dormant: "negative", Lost: "negative",
  Recovered: "positive", "High Potential": "violet", New: "violet",
  Seasonal: "info", "Price Sensitive": "warn",
};

const columns: Column<Customer>[] = [
  {
    key: "name",
    header: "Customer",
    sortValue: (c) => c.name,
    cell: (c) => (
      <>
        <Link
          href={`/customers/${c.id}`}
          className="font-semibold text-navy transition-colors hover:text-accent-dark"
        >
          <span className="mr-2">{c.flag}</span>
          {c.name}
        </Link>
        <span className="mt-0.5 block text-[11.5px] text-muted-foreground">
          {c.country} · {c.preferences.shape} {c.preferences.carat} · {c.transactions} invoices
        </span>
      </>
    ),
  },
  {
    key: "segment",
    header: "Group",
    sortValue: (c) => c.segment,
    cell: (c) => <Badge tone={segmentTone[c.segment] ?? "neutral"}>{c.segment}</Badge>,
  },
  {
    key: "health",
    header: "Health",
    align: "right",
    sortValue: (c) => c.health,
    cell: (c) => (
      <div className="flex items-center justify-end gap-2">
        <div className="w-14">
          <Meter
            value={c.health}
            tone={c.health >= 75 ? "positive" : c.health >= 50 ? "warn" : "negative"}
            height="h-1"
          />
        </div>
        <span className="font-semibold text-navy">{c.health}</span>
      </div>
    ),
  },
  {
    key: "churnRisk",
    header: "Risk of losing them",
    align: "right",
    sortValue: (c) => c.churnRisk,
    cell: (c) => (
      <span
        className={`font-semibold ${
          c.churnRisk >= 60 ? "text-negative" : c.churnRisk >= 30 ? "text-warn" : "text-positive"
        }`}
      >
        {c.churnRisk}%
      </span>
    ),
  },
  {
    key: "ytd",
    header: "Sales, last 12 months",
    align: "right",
    sortValue: (c) => c.ytd,
    className: "font-semibold text-navy",
    cell: (c) => usd(c.ytd),
  },
  {
    key: "growth",
    header: "Growth",
    align: "right",
    sortValue: (c) => c.growth,
    cell: (c) => (
      <span className={c.growth >= 0 ? "text-positive" : "text-negative"}>
        {c.growth > 0 ? "+" : ""}
        {c.growth.toFixed(1)}%
      </span>
    ),
  },
  {
    key: "ltv",
    header: "Likely future value",
    align: "right",
    hideBelow: "xl",
    sortValue: (c) => c.ltv,
    cell: (c) => usd(c.ltv),
  },
  {
    key: "daysSince",
    header: "How often they buy",
    align: "right",
    hideBelow: "lg",
    sortValue: (c) => c.daysSince,
    cell: (c) => (
      <>
        <span
          className={
            c.daysSince > c.cycleDays[1] ? "font-semibold text-negative" : "text-navy-soft"
          }
        >
          Day {c.daysSince}
        </span>
        <span className="block text-[11px] text-muted-foreground">
          of {c.cycleDays[0]}–{c.cycleDays[1]}
        </span>
      </>
    ),
  },
  {
    key: "owner",
    header: "Owner",
    hideBelow: "md",
    sortValue: (c) => c.owner,
    className: "text-muted-foreground",
    cell: (c) => c.owner,
  },
];

const facets: Facet<Customer>[] = [
  {
    label: "All groups",
    options: (rows) => Array.from(new Set(rows.map((c) => c.segment))).sort(),
    matches: (c, v) => c.segment === v,
  },
  {
    label: "All markets",
    options: (rows) => Array.from(new Set(rows.map((c) => c.country))).sort(),
    matches: (c, v) => c.country === v,
  },
  {
    label: "All owners",
    options: (rows) => Array.from(new Set(rows.map((c) => c.owner))).sort(),
    matches: (c, v) => c.owner === v,
  },
];

export default function CustomerTable({ customers }: { customers: Customer[] }) {
  return (
    <DataTable
      rows={customers}
      columns={columns}
      facets={facets}
      getKey={(c) => c.id}
      searchIn={(c) =>
        `${c.name} ${c.owner} ${c.country} ${c.segment} ${c.broker ?? ""} ${c.preferences.shape}`
      }
      initialSort={{ key: "ytd", direction: "desc" }}
      rowHref={(c) => `/customers/${c.id}`}
      searchPlaceholder="Search customers, owners, markets, brokers…"
      emptyMessage="No customers match these filters."
      minWidth={1040}
    />
  );
}
