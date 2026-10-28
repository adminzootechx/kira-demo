import { Database } from "lucide-react";
import DataWorkspace from "@/components/data/DataWorkspace";
import TradeApiPanel from "@/components/data/TradeApiPanel";
import { customerFields } from "@/lib/data/csv";
import { Badge, Card, CardBody, CardHeader, PageHeader, SectionHeading } from "@/components/ui/primitives";
import { Alert } from "@/components/ui/feedback";

export const metadata = {
  title: "Data Sources — LUSTRE Sales Intelligence",
};

/**
 * What each engine needs from LUSTRE in order to compute rather than estimate.
 * Listing the required columns is the fastest way to get the right export
 * back — it turns "send us your data" into a specific request.
 */
const engineSources = [
  {
    engine: 2,
    name: "Customers",
    status: "ready" as const,
    columns: "Customer, revenue this period and prior, last purchase date, invoice count, discount, buying capacity",
    unlocks: "Grouping customers by buying habits, spotting who may stop buying, predicting reorders, and scoring account health",
  },
  {
    engine: 1,
    name: "Sales, targets and the year ahead",
    status: "partial" as const,
    columns: "Monthly invoiced revenue by month, annual target, carats and stones per month",
    unlocks: "Which months are usually busiest, a forecast for the rest of the year, and the chance of hitting the target",
  },
  {
    engine: 3,
    name: "Stock and what is selling",
    status: "blocked" as const,
    columns: "Stock on hand by stone type and location, when it arrived, and what has sold",
    unlocks: "What we are about to run out of, how long stock will last, and what should move between locations",
  },
  {
    engine: 4,
    name: "Prices and discounts",
    status: "blocked" as const,
    columns: "The price on each line, the list price, the discount given, plus cost and commission from your accounts system",
    unlocks: "What each discount really costs once margin is known, and which ones look wrong",
  },
  {
    engine: 5,
    name: "The team and the brokers",
    status: "partial" as const,
    columns: "Invoices by salesperson and broker, customer interaction log",
    unlocks: "How active each person is, how quickly they respond, and who is keeping customers",
  },
  {
    engine: 6,
    name: "Open chances and the day’s work",
    status: "partial" as const,
    columns: "Enquiry, quotation and order records with dates and outcomes",
    unlocks: "How many enquiries turn into orders, and where we lose people along the way",
  },
  {
    engine: 7,
    name: "Things to check",
    status: "partial" as const,
    columns: "Worked out from everything above — nothing extra to send",
    unlocks: "Alerts set against what is actually at stake, rather than fixed limits",
  },
  {
    engine: 8,
    name: "Finding new buyers, and asking questions",
    status: "blocked" as const,
    columns: "Licensed external trade or customs-shipment data",
    unlocks: "New markets worth entering, companies that look like our best customers, and what they are buying now",
  },
];

const statusBadge = {
  ready: { tone: "positive" as const, label: "Ready to load" },
  partial: { tone: "warn" as const, label: "We know what we need" },
  blocked: { tone: "neutral" as const, label: "Waiting on data" },
};

export default function DataSourcesPage() {
  return (
    <>
      <PageHeader
        breadcrumb={["Setup", "Your data"]}
        title="Your data"
        subtitle="Load your own sales history. Once it is in, every number on the site is worked out from your data instead of the sample figures."
      />

      <Alert variant="warning" title="Legacy import path — being replaced by the Trade Data API">
        Manual CSV/Excel upload is on its way out. Once the Trade Data API integration is
        live, sales data will sync automatically and this upload flow will be retired. It still
        works today as a fallback while that integration is being built.
      </Alert>

      <TradeApiPanel />

      <DataWorkspace />

      <section className="space-y-6">
        <SectionHeading
          id="engine-coverage"
          title="What each part of the site needs"
          help="Anything marked 'Waiting on data' is built and working — it is just waiting on a file LUSTRE has not sent yet, such as live stock levels or cost figures from the accounts system. The columns listed are exactly what would switch it on."
          description="The file LUSTRE would need to send for each part of the site, and what sending it turns on."
        />

        <Card>
          <div className="divide-y divide-border">
            {engineSources.map((source) => {
              const badge = statusBadge[source.status];
              return (
                <div key={source.engine} className="px-6 py-5">
                  <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
                    <div className="flex min-w-0 gap-4">
                      <span className="kpi-value shrink-0 text-[16px] text-accent-dark">
                        0{source.engine}
                      </span>
                      <div className="min-w-0">
                        <h3 className="text-[14.5px] font-semibold text-navy">{source.name}</h3>
                        <p className="mt-1.5 text-[13px] leading-relaxed text-navy-muted">
                          <span className="font-medium text-navy">Needs:</span> {source.columns}
                        </p>
                        <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
                          <span className="font-medium">Unlocks:</span> {source.unlocks}
                        </p>
                      </div>
                    </div>
                    <Badge tone={badge.tone}>{badge.label}</Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </section>

      <section className="space-y-6">
        <SectionHeading
          id="template"
          title="Customer export template"
          help="Header names are matched automatically against these aliases, so an export using any of them needs no manual mapping at all."
          description="Header names LUSTRE's export can use. Any one of the listed aliases is recognised without manual mapping."
        />
        <Card>
          <CardHeader
            icon={<Database size={16} />}
            title="Recognised column names"
            subtitle="Matching is case-insensitive and ignores spaces, underscores and punctuation"
          />
          <CardBody>
            <div className="grid gap-x-8 gap-y-4 md:grid-cols-2">
              {customerFields.map((field) => (
                <div key={field.key} className="border-b border-border/70 pb-3 last:border-0">
                  <p className="text-[13px] font-semibold text-navy">
                    {field.label}
                    {field.required && <span className="ml-1.5 text-negative">required</span>}
                  </p>
                  <p className="mt-1 font-mono text-[11.5px] leading-relaxed text-muted-foreground">
                    {field.aliases.slice(0, 6).join(" · ")}
                  </p>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </section>
    </>
  );
}
