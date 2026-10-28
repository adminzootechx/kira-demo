"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { ChevronRight, History } from "lucide-react";
import { EmptyState } from "@/components/ui/feedback";
import { Card, CardHeader, DataNote, Table, Td, Th } from "@/components/ui/primitives";
import { perCarat, usd } from "@/lib/format";

export type Order = {
  orderNo: string; date: string; stones: number; carats: number; amount: number;
  discount: number | null; location: string | null; terms: string | null; owner: string | null;
};
type Stone = {
  shape: string | null; carats: number; colour: string | null; clarity: string | null; cut: string | null;
  polish: string | null; symmetry: string | null; fluorescence: string | null; lab: string | null;
  pricePerCarat: number; amount: number; discount: number | null; daysInStock: number | null; location: string | null;
};

const PAGE = 15;
const dateLabel = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const grade = (s: Stone) => [s.cut, s.polish, s.symmetry].filter(Boolean).join(" / ") || "—";

function StoneLines({ name, order }: { name: string; order: Order }) {
  const [stones, setStones] = useState<Stone[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const qs = new URLSearchParams({ name, date: order.date, order: order.orderNo });
    fetch(`/api/customers/orders/stones?${qs}`, { cache: "no-store" })
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (cancelled) return;
        if (!r.ok) setError(body.error ?? "Could not load the stones.");
        else setStones(body.stones);
      })
      .catch(() => !cancelled && setError("Could not load the stones."));
    return () => {
      cancelled = true;
    };
  }, [name, order.date, order.orderNo]);

  if (error) return <p role="status" className="sticky left-0 max-w-[calc(100vw-4rem)] whitespace-normal px-4 py-3 text-[12.5px] text-muted-foreground">{error}</p>;
  if (!stones) return <p role="status" className="sticky left-0 max-w-[calc(100vw-4rem)] whitespace-normal px-4 py-3 text-[12.5px] text-muted-foreground">Loading the stones in this order…</p>;
  if (!stones.length) return <p role="status" className="sticky left-0 max-w-[calc(100vw-4rem)] whitespace-normal px-4 py-3 text-[12.5px] text-muted-foreground">No stone lines came back for this order.</p>;

  return (
    <Table dense>
      <thead>
        <tr>
          <Th>Shape</Th>
          <Th align="right">Carats</Th>
          <Th>Colour</Th>
          <Th>Clarity</Th>
          <Th>Cut / polish / symmetry</Th>
          <Th>Lab</Th>
          <Th align="right">Price per carat</Th>
          <Th align="right">Amount</Th>
          <Th align="right">Discount</Th>
          <Th align="right">Days in stock</Th>
        </tr>
      </thead>
      <tbody>
        {stones.map((s, i) => (
          <tr key={i}>
            <Td className="font-semibold text-navy">{s.shape ?? "—"}</Td>
            <Td align="right">{s.carats.toFixed(2)}</Td>
            <Td>{s.colour ?? "—"}</Td>
            <Td>{s.clarity ?? "—"}</Td>
            <Td className="text-muted-foreground">{grade(s)}</Td>
            <Td>{s.lab ?? "—"}</Td>
            <Td align="right" className="whitespace-nowrap">{perCarat(s.pricePerCarat)}</Td>
            <Td align="right">{usd(s.amount, { compact: s.amount >= 1_000_000 })}</Td>
            <Td align="right">{s.discount ? `${s.discount.toFixed(1)}%` : "—"}</Td>
            <Td align="right">{s.daysInStock ?? "—"}</Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

/** A customer's orders, newest first. Shared by the page so it fetches once. */
export function useCustomerOrders(name: string) {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!name) return;
    let cancelled = false;
    fetch(`/api/customers/orders?name=${encodeURIComponent(name)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((b: { orders: Order[] }) => !cancelled && setOrders(b.orders))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [name]);
  return { orders, failed };
}

/** Every past order for one customer, newest first, with the stones behind each one on request. */
export default function TransactionHistory({ name, orders, failed }: { name: string; orders: Order[] | null; failed: boolean }) {
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<string | null>(null);

  const totals = useMemo(
    () => ({
      amount: (orders ?? []).reduce((a, o) => a + o.amount, 0),
      stones: (orders ?? []).reduce((a, o) => a + o.stones, 0),
    }),
    [orders],
  );

  const pages = Math.max(1, Math.ceil((orders?.length ?? 0) / PAGE));
  const rows = (orders ?? []).slice(page * PAGE, page * PAGE + PAGE);

  return (
    <Card>
      <CardHeader
        icon={<History size={16} />}
        title="Past transactions"
        subtitle={
          orders?.length
            ? `${orders.length} orders, ${totals.stones.toLocaleString()} stones, ${usd(totals.amount)} in total`
            : "Every order we have on record for this customer"
        }
      />
      {failed && <EmptyState title="Transactions could not be loaded" description="Reload the page to try again." />}
      {!failed && orders && orders.length === 0 && (
        <EmptyState
          icon={<History size={22} strokeWidth={1.8} />}
          title="No orders on record"
          description="Order history appears here once sales for this customer are loaded."
        />
      )}
      {!failed && !orders && <p className="px-5 py-4 text-[13px] text-muted-foreground">Loading…</p>}
      {rows.length > 0 && (
        <>
          <Table dense>
            <thead>
              <tr>
                <Th />
                <Th>Date</Th>
                <Th align="right">Amount</Th>
                <Th>Order</Th>
                <Th align="right">Stones</Th>
                <Th align="right">Carats</Th>
                <Th align="right">Price per carat</Th>
                <Th align="right">Discount</Th>
                <Th>Sold from</Th>
                <Th>Terms</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => {
                const id = o.orderNo;
                const isOpen = open === id;
                return (
                  <Fragment key={id}>
                    <tr className="cursor-pointer transition-colors hover:bg-secondary/40" onClick={() => setOpen(isOpen ? null : id)}>
                      <Td>
                        <button
                          type="button"
                          aria-expanded={isOpen}
                          aria-label={isOpen ? "Hide the stones" : "Show the stones"}
                          className="icon-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpen(isOpen ? null : id);
                          }}
                        >
                          <ChevronRight size={14} className={`transition-transform ${isOpen ? "rotate-90" : ""}`} />
                        </button>
                      </Td>
                      <Td className="whitespace-nowrap font-semibold text-navy">{dateLabel(o.date)}</Td>
                      <Td align="right" className="whitespace-nowrap font-semibold text-navy">{usd(o.amount, { compact: o.amount >= 1_000_000 })}</Td>
                      <Td className="whitespace-nowrap text-muted-foreground">{o.orderNo.startsWith("day-") ? "—" : o.orderNo}</Td>
                      <Td align="right">{o.stones.toLocaleString()}</Td>
                      <Td align="right">{o.carats.toFixed(2)}</Td>
                      <Td align="right" className="whitespace-nowrap">{o.carats > 0 ? perCarat(o.amount / o.carats) : "—"}</Td>
                      <Td align="right">{o.discount ? `${o.discount.toFixed(1)}%` : "—"}</Td>
                      <Td className="text-muted-foreground">{o.location ?? "—"}</Td>
                      <Td className="text-muted-foreground">{o.terms ?? "—"}</Td>
                    </tr>
                    {isOpen && (
                      <tr>
                        <td colSpan={10} className="bg-secondary/30 p-0">
                          <StoneLines name={name} order={o} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </Table>
          <div className="flex items-center justify-between border-t border-border px-5 py-3 text-[12.5px] text-muted-foreground">
            <span>
              Showing {page * PAGE + 1} to {Math.min((page + 1) * PAGE, orders!.length)} of {orders!.length}
            </span>
            <div className="flex items-center gap-2">
              <button type="button" className="btn btn-ghost" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button>
              <span>Page {page + 1} of {pages}</span>
              <button type="button" className="btn btn-ghost" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Next</button>
            </div>
          </div>
          <DataNote>
            Discount is the average discount off the natural Rapaport list, which is how lab-grown stones trade. Open an order to see each stone. Stone
            details are fetched live from the sales service when you open it.
          </DataNote>
        </>
      )}
    </Card>
  );
}
