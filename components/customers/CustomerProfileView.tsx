"use client";

import Link from "next/link";
import {
  ArrowLeft, CalendarClock, CircleDollarSign, Gem, HeartPulse,
  ShieldAlert, TrendingUp, Wallet, PhoneCall, ChevronDown, StickyNote,
} from "lucide-react";
import { useCustomerBook } from "@/lib/data/store";
import { useRole } from "@/components/shell/RoleContext";
import AssignRep from "@/components/customers/AssignRep";
import TransactionHistory, { useCustomerOrders } from "@/components/customers/TransactionHistory";
import { CallBadge } from "@/components/customers/CallBadge";
import CustomerNotes from "@/components/customers/CustomerNotes";
import {
  churnDrivers, discountRankIn, evidenceStrength, healthComposition, predictReorder,
} from "@/lib/analytics/customer";
import { ScoreRadar, palette } from "@/components/charts";
import { segmentTone } from "@/components/customers/CustomerTable";
import {
  Badge, Card, CardBody, CardHeader, DataNote, Delta,
  Meter,
} from "@/components/ui/primitives";
import { usd } from "@/lib/format";
import { callKind } from "@/lib/analytics/portfolio";
import type { Customer } from "@/lib/data/types";

/** Loading, unreachable or genuinely missing: three different messages, never a false "not found". */
function NoCustomer({ state }: { state: "loading" | "unreachable" | "missing" }) {
  if (state === "loading") {
    return (
      <Card>
        <CardBody className="py-12 text-center" aria-live="polite">
          <p className="text-[13.5px] text-muted-foreground">Loading this customer…</p>
        </CardBody>
      </Card>
    );
  }
  const unreachable = state === "unreachable";
  return (
    <Card>
      <CardBody className="space-y-4 py-12 text-center">
        <h1 className="display text-[21px] font-bold text-navy">
          {unreachable ? "Customer records are not available right now" : "We could not find this customer"}
        </h1>
        <p className="mx-auto max-w-lg text-[13.5px] leading-relaxed text-navy-muted">
          {unreachable
            ? "The connection to the sales data dropped. Try again in a minute."
            : "The link may be out of date, or the customer is handled by someone else. Search for them from the customer list."}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
          {unreachable && (
            <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
              Try again
            </button>
          )}
          <Link href="/customers" className={unreachable ? "btn btn-secondary" : "btn btn-primary"}>
            Back to customers
          </Link>
        </div>
      </CardBody>
    </Card>
  );
}

const healthWord = (h: number) => (h >= 75 ? "Good" : h >= 50 ? "Fair" : "Weak");
const riskWord = (r: number) => (r >= 60 ? "High" : r >= 30 ? "Medium" : "Low");

/** The next call, in words, built from the same facts the page shows. Null when there is nothing to say. */
function nextStep(c: Customer): { text: string; urgent: boolean } | null {
  const kind = callKind(c);
  const p = c.preferences;
  const buys = [p.shape, p.carat, p.colour, p.clarity].filter((x) => x && x !== "—" && x !== "Unspecified").join(" · ");
  const usual = buys ? ` They usually buy ${buys}.` : "";
  const cycle = `${c.cycleDays[0]}–${c.cycleDays[1]} days`;
  const down = c.lastYear > 0 && c.ytd < c.lastYear ? Math.round((1 - c.ytd / c.lastYear) * 100) : 0;
  if (kind === "Due now") return { text: `Due to reorder: they usually order every ${cycle} and it has been ${c.daysSince}. Call about their next order.${usual}`, urgent: false };
  if (kind === "Past their usual time")
    return { text: `${c.daysSince} days since their last order, past their usual ${cycle}${down ? `, and spending is down ${down}%` : ""}. Call to ask what they are buying now.${usual}`, urgent: true };
  if (kind === "Lapsed") return { text: `No order in ${c.daysSince} days. Win-back call: ask what changed and what would bring them back.${usual}`, urgent: true };
  if (kind === "At risk") return { text: `Spending is down ${down}% on the 12 months before. Check in before they go quiet.${usual}`, urgent: true };
  return null;
}

export default function CustomerProfileView({ id }: { id: string }) {
  const { customers, isLoading, database } = useCustomerBook();
  const c = customers.find((x) => x.id === id);
  const { isSystem } = useRole();
  const { orders, failed: ordersFailed } = useCustomerOrders(c?.name ?? "");

  if (!c) {
    const state = isLoading ? "loading" : database === "connected" || database === "snapshot" ? "missing" : "unreachable";
    return <NoCustomer state={state} />;
  }
  const step = nextStep(c);
  const kind = callKind(c);
  const discountRank = discountRankIn(customers, c);

  // The radar is the decomposition of the headline health score, not a
  // separate approximation of it — same inputs, same weights. Realisation is
  // the account's discount standing in the loaded book, so it has to be
  // measured against that book rather than against this one account.
  const healthAxes = healthComposition(
    c, { ...c.rfm, label: "" }, c.growth, discountRank,
  );
  const drivers = churnDrivers(c, c.growth, c.rfm.f);
  const evidence = evidenceStrength(c);
  const reorder = predictReorder(c);

  const cycleProgress = Math.min(140, (c.daysSince / c.cycleDays[1]) * 100);

  return (
    <>
      <Link
        href="/customers"
        className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-muted-foreground transition-colors hover:text-navy"
      >
        <ArrowLeft size={13} />
        All customers
      </Link>

      {/* Identity ------------------------------------------------------- */}
      <div className="flex flex-wrap items-start justify-between gap-5 border-b border-border pb-5">
        <div className="flex gap-4">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-xl border border-border bg-secondary text-2xl">
            {c.flag}
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="display text-[27.5px] font-semibold leading-tight text-navy">
                {c.name}
              </h1>
              <Badge tone={segmentTone[c.segment] ?? "neutral"}>{c.segment}</Badge>
            </div>
            <p className="mt-1.5 text-[13.5px] text-muted-foreground">
              {c.country}{isSystem ? "" : ` · Handled by ${c.owner}`}
              {c.broker ? ` · Broker ${c.broker}` : " · Direct relationship"} · First order on record{" "}
              {c.firstPurchase}
            </p>
            {isSystem && (
              <div className="mt-2.5">
                <AssignRep name={c.name} owner={c.owner} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Before you call: what a rep needs in the two minutes before dialling */}
      <Card>
        <CardHeader icon={<PhoneCall size={16} />} title="Before you call" />
        <CardBody className="space-y-4">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            {c.pausedUntil ? <Badge tone="warn">Alerts paused</Badge> : kind ? <CallBadge kind={kind} daysPast={c.daysSince - c.cycleDays[1]} /> : <Badge tone="positive">On their usual pattern</Badge>}
            <span className="text-[13px] text-navy-soft">
              Last order {c.daysSince} days ago, on {c.lastPurchase}. They usually order every {c.cycleDays[0]}–{c.cycleDays[1]} days.
            </span>
          </div>

          <p className={`rounded-[10px] border px-3.5 py-3 text-[13.5px] leading-relaxed ${step?.urgent ? "border-warn/30 bg-warn-bg" : "border-accent-border bg-accent-bg"} text-navy`}>
            <span className="font-semibold">What to do next — </span>
            {step ? step.text : "Nothing pressing: they are buying on their usual pattern."}
          </p>

          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            <div>
              <dt className="text-[12.5px] text-muted-foreground">Last order</dt>
              <dd className="mt-0.5 text-[13.5px] font-semibold text-navy">
                {ordersFailed
                  ? "Could not load orders"
                  : !orders
                    ? "Loading…"
                    : orders?.[0]
                      ? `${usd(orders?.[0]!.amount, { compact: orders?.[0]!.amount >= 1_000_000 })} · ${orders?.[0]!.stones} ${orders?.[0]!.stones === 1 ? "stone" : "stones"} · ${orders?.[0]!.carats.toFixed(2)} ct`
                      : "No orders on record"}
              </dd>
            </div>
            <div>
              <dt className="text-[12.5px] text-muted-foreground">They usually buy</dt>
              <dd className="mt-0.5 text-[13.5px] font-semibold text-navy">
                {[c.preferences.shape, c.preferences.carat, c.preferences.colour, c.preferences.clarity].filter((x) => x && x !== "—" && x !== "Unspecified").join(" · ") || "Not enough orders to tell"}
                {c.preferences.lab && c.preferences.lab !== "—" ? ` · ${c.preferences.lab}` : ""}
              </dd>
            </div>
            <div>
              <dt className="text-[12.5px] text-muted-foreground">Usual order and terms</dt>
              <dd className="mt-0.5 text-[13.5px] font-semibold text-navy">
                {usd(c.avgTxn, { compact: false })} · {c.terms}
              </dd>
            </div>
            <div>
              <dt className="text-[12.5px] text-muted-foreground">Risk of losing them</dt>
              <dd className="mt-0.5 text-[13.5px] font-semibold text-navy">
                {c.churnRisk} / 100 · {riskWord(c.churnRisk)} (an estimate)
              </dd>
            </div>
          </dl>
        </CardBody>
      </Card>

      <Card>
        <CardHeader icon={<StickyNote size={16} />} title="Notes" subtitle="Why this customer is behaving the way they are. Anyone who can see this customer can read these." />
        <CardBody>
          <CustomerNotes name={c.name} />
        </CardBody>
      </Card>

      <TransactionHistory name={c.name} orders={orders} failed={ordersFailed} />

      {/* 360 metrics ---------------------------------------------------- */}
      <Card>
        <CardHeader
          icon={<CircleDollarSign size={16} />}
          title="The numbers"
          subtitle="From every sale we have on record for this customer"
        />
        <div className="grid divide-y divide-border sm:grid-cols-2 sm:divide-x lg:grid-cols-4 lg:divide-y-0">
          {[
            { l: "Sales, last 12 months", v: usd(c.ytd), d: c.growth },
            { l: "Carats purchased", v: `${c.carats.toLocaleString()} ct` },
            { l: "Stones purchased", v: c.stones.toLocaleString() },
            { l: "Orders a year", v: `About ${c.transactions}` },
            { l: "Average order", v: usd(c.avgTxn, { compact: false }) },
            { l: "Last purchase", v: c.lastPurchase },
            { l: "Usual payment terms", v: c.terms },
            { l: "First order on record", v: c.firstPurchase },
          ].map((m) => (
            <div key={m.l} className="p-4">
              <p className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground">{m.l}</p>
              <p className="kpi-value mt-2 text-[20px] leading-none">{m.v}</p>
              {typeof m.d === "number" && (
                <div className="mt-1.5">
                  <Delta value={m.d} />
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Why these scores: the model's reasoning, for whoever wants to check it */}
      <details className="group surface overflow-hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
          <span>
            <span className="display block text-[16px] font-semibold text-navy">Why these scores</span>
            <span className="block text-[12.5px] text-muted-foreground">Health, risk, buying pattern and value, broken down</span>
          </span>
          <ChevronDown size={16} className="shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <div className="space-y-6 border-t border-border bg-background/40 p-5">
          {/* Wraps: three 118px tiles plus gaps do not fit a 400px screen,
              and without this they pushed the whole page sideways. */}
          <div className="flex flex-wrap gap-3">
            {[
              { l: "Health score", v: String(c.health), word: healthWord(c.health), tone: c.health >= 75 ? "text-positive" : c.health >= 50 ? "text-warn" : "text-negative" },
              { l: "Risk of losing them", v: `${c.churnRisk} / 100`, word: `${riskWord(c.churnRisk)} · estimate`, tone: c.churnRisk >= 60 ? "text-negative" : c.churnRisk >= 30 ? "text-warn" : "text-positive" },
              { l: "Likely future value", v: usd(c.ltv), word: "Estimate", tone: "text-navy" },
            ].map((x) => (
              <div key={x.l} className="surface min-w-[118px] flex-1 p-3.5">
                <p className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground">{x.l}</p>
                <p className={`kpi-value mt-1.5 text-[23px] leading-none ${x.tone}`}>{x.v}</p>
                <p className={`mt-1.5 text-[12.5px] font-semibold ${x.tone}`}>{x.word}</p>
              </div>
            ))}
          </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Health composition */}
          <Card>
            <CardHeader
              icon={<HeartPulse size={16} />}
              title="Health score"
              help="The six things the health score is built from: how recently they bought (20%), whether they are growing (20%), how often they buy (15%), how much they spend (15%), how promptly they pay (15%) and how well prices held (15%). This is the same score broken open, not a second estimate."
              subtitle="The six things it is built from"
            />
            <CardBody>
              <ScoreRadar
                data={healthAxes}
                color={c.health >= 75 ? palette.green : c.health >= 50 ? palette.amber : palette.red}
              />
            </CardBody>
          </Card>
  
          {/* Why this account scores as it does */}
          <Card>
            <CardHeader
              icon={<ShieldAlert size={16} />}
              title="Risk of losing them"
              help="The risk score adds up four warning signs, each worth at most the points shown. Lateness is judged against this customer’s own normal gap between orders, not a fixed number of days — 54 days is alarming for someone who usually buys fortnightly and perfectly normal for someone who buys quarterly."
              subtitle={`${c.churnRisk} of 100 risk points (an estimate), broken down`}
            />
            <CardBody className="space-y-4">
              {drivers.map((d) => (
                <div key={d.label}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[13px] font-medium text-navy">{d.label}</span>
                    <span className="text-[13px] font-semibold tabular-nums text-navy">
                      {d.points}
                      <span className="text-muted-foreground"> / {d.max}</span>
                    </span>
                  </div>
                  <div className="mt-1.5">
                    <Meter
                      value={d.points}
                      max={d.max}
                      tone={d.points / d.max >= 0.6 ? "negative" : d.points / d.max >= 0.3 ? "warn" : "positive"}
                      height="h-1"
                      label={d.label}
                    />
                  </div>
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
                    {d.detail}
                  </p>
                </div>
              ))}
  
              <div className="border-t border-border/70 pt-4">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[13px] font-medium text-navy">How sure we are</span>
                  <Badge
                    tone={evidence.score >= 75 ? "positive" : evidence.score >= 50 ? "warn" : "negative"}
                  >
                    {evidence.label} · {evidence.score}%
                  </Badge>
                </div>
                <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">
                  {evidence.reasons.length
                    ? `Scores are weaker here because of ${evidence.reasons.join(", ")}.`
                    : "Based on a long, regular order history with a year to compare against."}
                </p>
              </div>
            </CardBody>
          </Card>
  
          {/* Purchase cycle */}
          <Card>
            <CardHeader
              icon={<CalendarClock size={16} />}
              title="Buying pattern"
              help="The reorder window is this account's own typical gap between purchases. Confidence reflects how regular that pattern is and how many invoices support it — an irregular buyer with few orders is predicted with far less certainty."
              subtitle={`A ${c.cycleType.toLowerCase()} buyer · we are ${reorder.confidence}% sure of this pattern`}
            />
            <CardBody className="space-y-5">
              <div>
                <div className="flex items-baseline justify-between">
                  <span className="text-[12.5px] text-muted-foreground">Expected reorder window</span>
                  <span className="text-[13.5px] font-semibold text-navy">
                    {c.cycleDays[0]}–{c.cycleDays[1]} days
                  </span>
                </div>
                <div className="relative mt-3">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full ${
                        c.daysSince > c.cycleDays[1] ? "bg-negative" : c.daysSince >= c.cycleDays[0] ? "bg-warn" : "bg-positive"
                      }`}
                      style={{ width: `${Math.min(100, cycleProgress)}%` }}
                    />
                  </div>
                  <div
                    className="absolute -top-1 h-4 w-0.5 bg-navy"
                    style={{ left: `${(c.cycleDays[0] / c.cycleDays[1]) * 100}%` }}
                  />
                </div>
                <div className="mt-2 flex justify-between text-[12.5px] text-muted-foreground">
                  <span>Day 0</span>
                  <span className={c.daysSince > c.cycleDays[1] ? "font-semibold text-negative" : "font-semibold text-navy"}>
                    Currently Day {c.daysSince}
                  </span>
                  <span>Day {c.cycleDays[1]}</span>
                </div>
              </div>
  
              <p className="rounded-lg border border-border bg-secondary/60 p-3 text-[13px] leading-relaxed text-navy-soft">
                This customer normally purchases every {c.cycleDays[0]}–{c.cycleDays[1]} days and is
                currently on Day {c.daysSince}.
                {c.daysSince > c.cycleDays[1]
                  ? ` That is ${c.daysSince - c.cycleDays[1]} days beyond the expected window.`
                  : c.daysSince >= c.cycleDays[0]
                    ? " The reorder window is open now."
                    : " The reorder window opens shortly."}
              </p>
  
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground">First purchase</p>
                  <p className="mt-1 text-[13.5px] font-semibold text-navy">{c.firstPurchase}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground">Last order</p>
                  <p className="mt-1 text-[13.5px] font-semibold text-navy">{c.lastPurchase}</p>
                </div>
              </div>
            </CardBody>
          </Card>
  
          {/* Preferences */}
          <Card>
            <CardHeader
              icon={<Gem size={16} />}
              title="What they buy"
              subtitle="What they usually buy, from all their orders"
            />
            <CardBody className="space-y-3">
              {[
                { l: "Shape", v: c.preferences.shape },
                { l: "Carat range", v: c.preferences.carat },
                { l: "Colour", v: c.preferences.colour },
                { l: "Clarity", v: c.preferences.clarity },
                { l: "Laboratory", v: c.preferences.lab },
              ].map((p) => (
                <div key={p.l} className="flex items-baseline justify-between border-b border-border pb-2.5 last:border-0 last:pb-0">
                  <span className="text-[12.5px] text-muted-foreground">{p.l}</span>
                  <span className="text-[13px] font-semibold text-navy">{p.v}</span>
                </div>
              ))}
              {c.crossSell.length > 0 && (
              <div className="pt-1">
                <p className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
                  Cross-sell candidates
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {c.crossSell.map((x) => (
                    <Badge key={x} tone="violet">{x}</Badge>
                  ))}
                </div>
                <DataNote>
                  Adjacent categories this account has not historically purchased but which similar
                  customers buy alongside its current mix.
                </DataNote>
              </div>
              )}
            </CardBody>
          </Card>
        </div>
  
        {/* Value & risk --------------------------------------------------- */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader
              icon={<TrendingUp size={16} />}
              title="What they are worth"
              subtitle="What they are likely to be worth to us"
            />
            <CardBody className="space-y-4">
              {[
                { l: "Likely future value", v: usd(c.ltv) },
                { l: "Allowing for the risk of losing them", v: usd(c.riskAdjustedValue) },
              ].map((x) => (
                <div key={x.l} className="flex items-baseline justify-between border-b border-border pb-3 last:border-0 last:pb-0">
                  <span className="text-[13px] text-navy-soft">{x.l}</span>
                  <span className="text-[13.5px] font-semibold text-navy">{x.v}</span>
                </div>
              ))}
              <DataNote>
                Both are estimates from their buying so far. The second takes off what is at stake if they stop buying.
              </DataNote>
            </CardBody>
          </Card>
  
          <Card>
            <CardHeader
              icon={<Wallet size={16} />}
              title="How they buy and pay"
              subtitle="Discount, price sensitivity and payment terms"
            />
            <CardBody className="space-y-4">
              {[
                { l: "Average discount", v: `${c.avgDiscount}%`, note: `Off the natural Rapaport list · ${discountRank >= 70 ? "deeper than most customers get" : discountRank <= 30 ? "lighter than most customers get" : "about what most customers get"}` },
                { l: "Sensitivity to price", v: c.priceSensitivity, note: c.priceSensitivity === "High" ? "Buys more when the price is right" : "Buys for the stone, less for the price" },
                { l: "Usual payment terms", v: c.terms, note: "The terms on most of their orders" },
              ].map((x) => (
                <div key={x.l} className="flex items-start justify-between gap-4 border-b border-border pb-3 last:border-0 last:pb-0">
                  <div>
                    <p className="text-[13px] font-medium text-navy">{x.l}</p>
                    <p className="mt-0.5 text-[12.5px] text-muted-foreground">{x.note}</p>
                  </div>
                  <span className="text-[13.5px] font-semibold text-navy">{x.v}</span>
                </div>
              ))}
            </CardBody>
          </Card>
        </div>
  
        </div>
      </details>

    </>
  );
}
