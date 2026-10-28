"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Check, ListChecks, StickyNote, Undo2, X } from "lucide-react";
import type { Priority } from "@/lib/data/types";
import { useCustomerAnalytics } from "@/lib/data/store";
import { predictReorder } from "@/lib/analytics/customer";
import { callKind, isAtRisk, type CallKind } from "@/lib/analytics/portfolio";
import { clientKey } from "@/lib/clientKey";
import { EmptyState } from "@/components/ui/feedback";
import { FilterBar, useListFilter } from "@/components/ui/FilterBar";
import { useToast } from "@/components/ui/Toast";
import { Badge, Card, CardBody, CardHeader, DataNote, Meter, PageHeader } from "@/components/ui/primitives";
import { usd } from "@/lib/format";
import type { CallEntry } from "@/app/api/calls/route";
import CustomerNotes from "@/components/customers/CustomerNotes";
import DismissForm from "@/components/priorities/DismissForm";
import MyTasks from "@/components/priorities/MyTasks";
import { Drawer } from "@/components/ui/Drawer";

/** Cards shown before "Show more": a day's worth, not the whole book. */
const PAGE = 15;

type Chip = "today" | "due" | "past" | "risk" | "winback";
const CHIPS: { key: Chip; label: string; subtitle: string }[] = [
  { key: "today", label: "All calls for today", subtitle: "Due, past their usual time or slipping, most worth calling first" },
  { key: "due", label: "Due now", subtitle: "In their usual buying window, or entering it this week" },
  { key: "past", label: "Past their usual time", subtitle: "Missed their usual reorder, still worth a call" },
  { key: "risk", label: "At risk of leaving", subtitle: "Still buying, but buying has dropped sharply against their own history" },
  { key: "winback", label: "Win-back", subtitle: "Stopped buying long ago: find out why and what would bring them back" },
];

/**
 * The rep's own record of what they did today, saved per user. "Called" keeps
 * a customer off the list for 7 days; "Not today" only until tomorrow.
 */
function useCallLog() {
  const [log, setLog] = useState<Map<string, CallEntry>>(new Map());
  // Read once on mount; the page is not open across midnight often enough to matter.
  const [today] = useState(() => new Date().toDateString());
  const isToday = (iso: string) => new Date(iso).toDateString() === today;
  const { error } = useToast();

  useEffect(() => {
    let cancelled = false;
    fetch("/api/calls", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((b: { calls: CallEntry[] } | null) => {
        if (!cancelled && b) setLog(new Map(b.calls.map((c) => [c.key, c])));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const record = (customer: string, outcome: CallEntry["outcome"] | null) => {
    const key = clientKey(customer);
    const before = log.get(key);
    setLog((prev) => {
      const next = new Map(prev);
      if (outcome) next.set(key, { key, outcome, at: new Date().toISOString() });
      else next.delete(key);
      return next;
    });
    fetch("/api/calls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customer, outcome }),
    })
      .then((r) => {
        if (!r.ok) throw new Error();
      })
      .catch(() => {
        setLog((prev) => {
          const next = new Map(prev);
          if (before) next.set(key, before);
          else next.delete(key);
          return next;
        });
        error("Could not save that", "Check your connection and try again.");
      });
  };

  /** The action still in force for a customer, if any. */
  const activeFor = (customer: string) => {
    const e = log.get(clientKey(customer));
    if (!e) return null;
    return e.outcome === "skipped" && !isToday(e.at) ? null : e;
  };
  const doneToday = [...log.values()].filter((e) => isToday(e.at)).length;
  return { record, activeFor, doneToday, isToday };
}

/** How many notes each listed customer has, and the newest one, so a rep sees the reason before dialling. */
function useNoteSummary(names: string[], refresh: unknown) {
  const [by, setBy] = useState<Map<string, { count: number; latest: string }>>(new Map());
  const list = names.join("|");
  useEffect(() => {
    if (!list) return;
    let cancelled = false;
    fetch(`/api/notes?customers=${encodeURIComponent(list)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((b: { summary: { key: string; count: number; latest: { body: string } }[] } | null) => {
        if (!cancelled && b) setBy(new Map(b.summary.map((s) => [s.key, { count: s.count, latest: s.latest.body }])));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [list, refresh]);
  return by;
}

export default function PrioritiesPage() {
  const book = useCustomerAnalytics();
  const calls = useCallLog();
  const [notesFor, setNotesFor] = useState<string | null>(null);
  const [dismissing, setDismissing] = useState<string | null>(null);
  const router = useRouter();
  const shown0 = useSearchParams().get("show");
  const [chip, setChip] = useState<Chip>(CHIPS.some((c) => c.key === shown0) ? (shown0 as Chip) : "today");
  const [limit, setLimit] = useState(PAGE);

  // One rule decides who is on the list and why (callKind, shared with Home,
  // notifications and Things to check), so the counts agree everywhere.
  // "Chance of an order" is how reliably they reorder on their own cycle when
  // a reorder is due, or how likely they are to keep buying when they have
  // lapsed or are slipping.
  const realPriorities: Priority[] = useMemo(
    () =>
      book.customers
        .map((c): Priority | null => {
          const kind = callKind(c);
          if (!kind) return null;
          const reorder = predictReorder(c);
          const cycle = `${c.cycleDays[0]}–${c.cycleDays[1]} days`;
          const copy: Record<CallKind, { why: string; action: string; tone: Priority["tone"] }> = {
            "Due now": {
              why: `Usually orders every ${cycle}; last order ${c.daysSince} days ago.`,
              action: "Call about their next order this week.",
              tone: "accent",
            },
            "Past their usual time": {
              why: `Usually orders every ${cycle}; it has been ${c.daysSince} days.`,
              action: "Ask what they are buying now and whether anything has changed.",
              tone: "warn",
            },
            Lapsed: {
              why: `Last order ${c.daysSince} days ago, far past their usual ${cycle}.`,
              action: "Find out why they stopped and what would bring them back.",
              tone: "negative",
            },
            "At risk": {
              why: `Bought ${usd(c.lastYear)} in the 12 months before, ${usd(c.ytd)} in the last 12.`,
              action: "Check in before they go quiet.",
              tone: "negative",
            },
          };
          const reorderCall = kind === "Due now" || kind === "Past their usual time";
          return {
            id: c.id,
            rank: 0,
            kind,
            customer: c.name,
            customerId: c.id,
            flag: c.flag,
            owner: c.owner,
            value: c.avgTxn,
            probability: reorderCall ? reorder.confidence : Math.max(0, 100 - Math.round(c.churnRisk)),
            why: copy[kind].why,
            action: copy[kind].action,
            bestDay: "",
            channel: "",
            tone: copy[kind].tone,
          };
        })
        .filter((p): p is Priority => p !== null)
        .sort((a, b) => b.value * (b.probability / 100) - a.value * (a.probability / 100)),
    [book.customers],
  );

  const atRiskIds = useMemo(() => new Set(book.customers.filter(isAtRisk).map((c) => c.id)), [book.customers]);
  const inChip = (p: Priority, k: Chip) =>
    k === "today" ? p.kind !== "Lapsed"
      : k === "due" ? p.kind === "Due now"
        : k === "past" ? p.kind === "Past their usual time"
          : k === "risk" ? atRiskIds.has(p.customerId)
            : p.kind === "Lapsed";

  const chipRows = realPriorities.filter((p) => inChip(p, chip));
  const open = chipRows.filter((p) => !calls.activeFor(p.customer));
  const done = chipRows.filter((p) => calls.activeFor(p.customer));

  const priorityFilter = useListFilter(open, {
    searchIn: (p) => `${p.customer} ${p.owner} ${p.kind} ${p.why} ${p.action}`,
    facets: [{ label: "All owners", get: (p) => p.owner }],
    sorts: [
      { key: "weighted", label: "Most worth calling", value: (p) => p.value * (p.probability / 100) },
      { key: "value", label: "Usual order size", value: (p) => p.value },
      { key: "probability", label: "Chance of an order", value: (p) => p.probability },
    ],
    initialSort: "weighted",
    placeholder: "Search customers, owners, reasons…",
  });

  const shown = priorityFilter.rows.slice(0, limit);
  const noteSummary = useNoteSummary(shown.map((p) => p.customer), notesFor);
  const likely = open.reduce((s, p) => s + p.value * (p.probability / 100), 0);
  const current = CHIPS.find((c) => c.key === chip)!;

  return (
    <>
      <PageHeader
        title="My day"
        subtitle="The calls worth making today, in order, with what each one is worth and why it came up."
      />

      {!book.isLoading && !book.isImported && (
        <Card>
          <EmptyState title="No sales data loaded yet" description="Your day list is worked out from your own sales records and appears here once they are imported." />
        </Card>
      )}

      {book.isImported && (
        <Card>
          <CardHeader
            icon={<ListChecks size={16} />}
            title={current.label}
            help="The work worth doing today, biggest first, after allowing for how likely each one is to lead to an order. Press Done when a task is finished and it stays off this list for a week. Dismiss a task with a short reason and it comes back tomorrow, unless you pause that customer's alerts."
            subtitle={current.subtitle}
            action={
              <span className="text-[12.5px] font-semibold text-navy">
                {calls.doneToday} done today · about {usd(likely)} in likely orders
              </span>
            }
          />
          <MyTasks />
          <div role="tablist" aria-label="Which calls" className="flex flex-wrap gap-2 px-5 pb-3">
            {CHIPS.map((c) => (
              <button
                key={c.key}
                type="button"
                role="tab"
                aria-selected={chip === c.key}
                onClick={() => {
                  setChip(c.key);
                  setLimit(PAGE);
                }}
                className={`min-h-9 rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                  chip === c.key
                    ? "border-accent-border bg-accent-bg text-accent-dark"
                    : "border-border text-navy-soft hover:bg-secondary"
                }`}
              >
                {c.label} <span className="tabular-nums">({realPriorities.filter((p) => inChip(p, c.key)).length.toLocaleString()})</span>
              </button>
            ))}
          </div>
          <FilterBar {...priorityFilter.bind} />
          <div className="divide-y divide-border">
            {shown.map((p, i) => (
              <div
                key={p.id}
                className="cursor-pointer px-6 py-7 transition-colors hover:bg-secondary/40"
                onClick={(e) => {
                  // Empty space opens the customer; buttons, links, fields and the dismiss form keep their own clicks.
                  if ((e.target as HTMLElement).closest("button, a, input, textarea, select, label, [data-no-row-click]")) return;
                  router.push(`/customers/${p.customerId}`);
                }}
              >
                <div className="flex flex-wrap items-start gap-x-6 gap-y-5">
                  <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-secondary display text-[13.5px] font-semibold text-navy">
                    {i + 1}
                  </span>

                  <div className="min-w-0 flex-1 lg:w-[380px] lg:flex-none">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <Badge tone={p.tone}>{p.kind}</Badge>
                      <Link
                        href={`/customers/${p.customerId}`}
                        className="text-[14px] font-semibold text-navy transition-colors hover:text-accent-dark"
                      >
                        <span className="mr-1.5">{p.flag}</span>
                        {p.customer}
                      </Link>
                      <span className="text-[12px] text-muted-foreground">{p.owner}</span>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2.5">
                      <button
                        type="button"
                        className="btn btn-done"
                        aria-label={`Done: ${p.customer}`}
                        onClick={() => calls.record(p.customer, "called")}
                      >
                        <Check size={14} aria-hidden />
                        Done
                      </button>
                      <button
                        type="button"
                        className="btn btn-dismiss"
                        aria-label={`Dismiss ${p.customer}`}
                        onClick={() => setDismissing(dismissing === p.customer ? null : p.customer)}
                      >
                        <X size={14} aria-hidden />
                        Dismiss
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        aria-label={`Notes on ${p.customer}`}
                        onClick={() => setNotesFor(p.customer)}
                      >
                        <StickyNote size={14} aria-hidden />
                        {noteSummary.get(clientKey(p.customer))?.count ? `Notes (${noteSummary.get(clientKey(p.customer))!.count})` : "Add note"}
                      </button>
                    </div>
                  </div>

                  <div className="grid w-full gap-4 sm:grid-cols-2 lg:w-auto lg:min-w-0 lg:flex-1">
                    <div className="rounded-[10px] border border-border bg-card px-4 py-4">
                      <p className="text-[11.5px] font-semibold text-muted-foreground">Why it came up</p>
                      <p className="mt-1.5 text-[13px] leading-relaxed text-navy">{p.why}</p>
                    </div>
                    <div className="rounded-[10px] border border-accent-border bg-accent-bg px-4 py-4">
                      <p className="text-[11.5px] font-semibold text-accent-dark">What to do</p>
                      <p className="mt-1.5 text-[13px] leading-relaxed text-navy">{p.action}</p>
                    </div>
                  </div>

                  <div className="flex w-full shrink-0 gap-6 pl-11 sm:w-auto sm:pl-0 sm:text-right">
                    <div>
                      <p className="text-[12px] text-muted-foreground">Usual order</p>
                      <p className="kpi-value mt-1 text-[20px]">{usd(p.value)}</p>
                    </div>
                    <div className="w-[92px]">
                      <p className="text-[12px] text-muted-foreground">Chance of an order</p>
                      <p className="kpi-value mt-1 text-[20px]">{p.probability}%</p>
                      <div className="mt-1.5">
                        <Meter
                          value={p.probability}
                          tone={p.probability >= 70 ? "positive" : p.probability >= 50 ? "accent" : "warn"}
                          height="h-1"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                  {dismissing === p.customer && (
                    <DismissForm
                      customer={p.customer}
                      onCancel={() => setDismissing(null)}
                      onDone={() => {
                        calls.record(p.customer, "skipped");
                        setDismissing(null);
                      }}
                    />
                  )}
                  {noteSummary.get(clientKey(p.customer)) && (
                    <p className="mt-2 line-clamp-2 text-[12.5px] leading-relaxed text-muted-foreground">
                      <span className="font-semibold text-navy">Latest note: </span>
                      {noteSummary.get(clientKey(p.customer))!.latest}
                    </p>
                  )}
              </div>
            ))}
            {priorityFilter.rows.length === 0 && (
              <p className="px-5 py-10 text-center text-[13.5px] text-muted-foreground">
                {open.length === 0 && done.length > 0 ? "All done here for today." : "No customers match these filters."}
              </p>
            )}
            {priorityFilter.rows.length > limit && (
              <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <span className="text-[12.5px] text-muted-foreground">
                  Showing {shown.length} of {priorityFilter.rows.length.toLocaleString()}
                </span>
                <button type="button" className="btn btn-secondary" onClick={() => setLimit((l) => l + PAGE)}>
                  Show {Math.min(PAGE, priorityFilter.rows.length - limit)} more
                </button>
              </div>
            )}
          </div>

          {done.length > 0 && (
            <details className="border-t border-border">
              <summary className="cursor-pointer px-5 py-3 text-[13px] font-semibold text-navy">
                Done ({done.length.toLocaleString()})
              </summary>
              <ul className="divide-y divide-border">
                {done.map((p) => {
                  const e = calls.activeFor(p.customer)!;
                  const when = calls.isToday(e.at)
                    ? "today"
                    : new Date(e.at).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
                  return (
                    <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-2.5 text-[13px]">
                      <span className="text-navy">
                        <Link href={`/customers/${p.customerId}`} className="font-semibold hover:text-accent-dark">
                          {p.customer}
                        </Link>
                        <span className="text-muted-foreground"> · {e.outcome === "called" ? `Done ${when}` : "Dismissed"}</span>
                      </span>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        aria-label={`Undo for ${p.customer}`}
                        onClick={() => calls.record(p.customer, null)}
                      >
                        <Undo2 size={13} aria-hidden />
                        Undo
                      </button>
                    </li>
                  );
                })}
              </ul>
            </details>
          )}

          <CardBody className="pt-4">
            <DataNote>
              &quot;Chance of an order&quot; is how reliably a customer has reordered on their own cycle, or for
              lapsed and at-risk customers how likely they are to keep buying. It is an estimate, not a
              promise. Phone numbers and call history are not in the sales data, so calls are marked here
              by hand.
            </DataNote>
          </CardBody>
        </Card>
      )}

      <Drawer open={notesFor !== null} onClose={() => setNotesFor(null)} title={notesFor ?? ""} subtitle="Notes on this customer" width={460}>
        {notesFor && <CustomerNotes name={notesFor} />}
      </Drawer>
    </>
  );
}
