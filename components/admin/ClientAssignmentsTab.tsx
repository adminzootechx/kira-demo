"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Badge, Card, CardBody, CardHeader, Table, Td, Th } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/Toast";
import { usd } from "@/lib/format";
import type { AssignmentsResponse } from "@/app/api/admin/assignments/route";

const PAGE = 50;

/** Where a client stood before a move: an admin's choice, or the sales data's owner. */
type Prior = { key: string; owner: string; assigned: boolean };
const select = "rounded-lg border border-border bg-input/60 px-3 py-2 text-[13px] text-navy outline-none focus:border-accent focus:bg-card";

export default function ClientAssignmentsTab() {
  const [data, setData] = useState<AssignmentsResponse | null>(null);
  const [filterRep, setFilterRep] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [bulkTo, setBulkTo] = useState("");
  // Moving customers out of someone's book always takes a second, explicit step.
  const [pendingRow, setPendingRow] = useState<{ key: string; name: string; from: string; to: string } | null>(null);
  const [confirmTransfer, setConfirmTransfer] = useState(false);
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [fromRep, setFromRep] = useState("");
  const [toRep, setToRep] = useState("");
  const { error, success, toast } = useToast();

  const load = () =>
    fetch("/api/admin/assignments", { cache: "no-store" })
      .then((r) => r.json())
      .then((b: AssignmentsResponse) => setData(b));

  useEffect(() => {
    void load();
  }, []);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of data?.clients ?? []) m.set(c.owner, (m.get(c.owner) ?? 0) + 1);
    return m;
  }, [data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.clients ?? []).filter(
      (c) => (!filterRep || c.owner === filterRep) && (!q || c.name.toLowerCase().includes(q)),
    );
  }, [data, filterRep, search]);

  const pageRows = filtered.slice(page * PAGE, page * PAGE + PAGE);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));

  const put = (payload: object) =>
    fetch("/api/admin/assignments", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

  const priorOf = (keys: Iterable<string>): Prior[] => {
    const wanted = new Set(keys);
    return (data?.clients ?? []).filter((c) => wanted.has(c.key)).map((c) => ({ key: c.key, owner: c.owner, assigned: c.assigned }));
  };

  // Puts clients back exactly as they were: an admin's choice back to that
  // person, the sales data's owner back to no override at all.
  const restore = async (prior: Prior[]) => {
    const groups = new Map<string | null, string[]>();
    for (const p of prior) {
      const owner = p.assigned ? p.owner : null;
      groups.set(owner, [...(groups.get(owner) ?? []), p.key]);
    }
    for (const [owner, keys] of groups) {
      if (!(await put({ keys, owner })).ok) {
        error("Could not undo every move", "Reload the page to see who handles each client now.");
        await load();
        return;
      }
    }
    success("Undone", `${prior.length} ${prior.length === 1 ? "client is" : "clients are"} back where they were.`);
    await load();
  };

  const send = async (payload: object, done: (moved: number) => string, prior: Prior[]) => {
    const res = await put(payload);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      error("Could not save the change", body.error ?? "Try again.");
      return;
    }
    toast({
      variant: "success",
      title: "Saved",
      description: done(body.moved),
      duration: 10_000,
      action: { label: "Undo", onClick: () => void restore(prior) },
    });
    setPicked(new Set());
    await load();
  };

  if (!data) return <p className="text-[13px] text-muted-foreground">Loading clients…</p>;

  const allOnPagePicked = pageRows.length > 0 && pageRows.every((c) => picked.has(c.key));
  const togglePage = () =>
    setPicked((p) => {
      const next = new Set(p);
      for (const c of pageRows) { if (allOnPagePicked) next.delete(c.key); else next.add(c.key); }
      return next;
    });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Transfer all clients"
          subtitle="Move every client one salesperson handles to another, for example when someone leaves."
        />
        <CardBody className="flex flex-wrap items-end gap-3">
          <label className="text-[12px] text-muted-foreground">
            From
            <select className={`${select} mt-1 block`} value={fromRep} onChange={(e) => setFromRep(e.target.value)}>
              <option value="">Choose…</option>
              {data.reps.map((r) => (
                <option key={r} value={r}>{r} ({counts.get(r) ?? 0})</option>
              ))}
            </select>
          </label>
          <ArrowRight size={16} className="mb-2.5 text-muted-foreground" aria-hidden />
          <label className="text-[12px] text-muted-foreground">
            To
            <select className={`${select} mt-1 block`} value={toRep} onChange={(e) => setToRep(e.target.value)}>
              <option value="">Choose…</option>
              {data.reps.filter((r) => r !== fromRep).map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={!fromRep || !toRep || !counts.get(fromRep)}
            onClick={() => setConfirmTransfer(true)}
          >
            Transfer {fromRep && counts.get(fromRep) ? `${counts.get(fromRep)} clients` : "all"}
          </button>
          {confirmTransfer && fromRep && toRep && (
            <div role="alert" className="basis-full rounded-[10px] border border-warn/30 bg-warn-bg px-3.5 py-3">
              <p className="text-[13px] leading-relaxed text-navy">
                Move all {(counts.get(fromRep) ?? 0).toLocaleString()} customers from <span className="font-semibold">{fromRep}</span> to{" "}
                <span className="font-semibold">{toRep}</span>? {fromRep} will no longer see any of them.
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() =>
                    void send(
                      { from: fromRep, to: toRep },
                      (n) => `${n} clients moved from ${fromRep} to ${toRep}.`,
                      priorOf(data.clients.filter((c) => c.owner === fromRep).map((c) => c.key)),
                    ).then(() => {
                      setFromRep("");
                      setConfirmTransfer(false);
                    })
                  }
                >
                  Move them
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setConfirmTransfer(false)}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Clients and who handles them"
          subtitle="Pick a salesperson to see their whole list. Change one client with its own menu, or tick several and move them together."
        />
        <CardBody className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => { setFilterRep(""); setPage(0); }}
              className={`rounded-full border px-3 py-1 text-[12px] font-medium ${!filterRep ? "border-accent bg-accent-bg text-accent-dark" : "border-border text-navy-soft"}`}
            >
              Everyone ({data.clients.length})
            </button>
            {[...counts].sort((a, b) => b[1] - a[1]).map(([rep, n]) => (
              <button
                key={rep}
                type="button"
                onClick={() => { setFilterRep(rep); setPage(0); }}
                className={`rounded-full border px-3 py-1 text-[12px] font-medium ${filterRep === rep ? "border-accent bg-accent-bg text-accent-dark" : "border-border text-navy-soft"}`}
              >
                {rep} ({n})
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              placeholder="Search clients"
              aria-label="Search clients"
              className="w-60 max-w-full rounded-lg border border-border bg-input/60 px-3.5 py-2 text-[13px] text-navy outline-none focus:border-accent focus:bg-card"
            />
            {picked.size > 0 && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-accent-border bg-accent-bg px-3 py-1.5">
                <span className="text-[12.5px] font-semibold text-accent-dark">{picked.size} selected</span>
                <select className={select} aria-label="Move selected clients to" value={bulkTo} onChange={(e) => { setBulkTo(e.target.value); setConfirmBulk(false); }}>
                  <option value="">Move to…</option>
                  {data.reps.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                  <option value="__clear">Back to the owner in the sales data</option>
                </select>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={!bulkTo}
                  onClick={() => setConfirmBulk(true)}
                >
                  Apply
                </button>
              </div>
            )}
          </div>

          {confirmBulk && bulkTo && picked.size > 0 && (
            <div role="alert" className="rounded-[10px] border border-warn/30 bg-warn-bg px-3.5 py-3">
              <p className="text-[13px] leading-relaxed text-navy">
                {bulkTo === "__clear" ? (
                  <>Put {picked.size} {picked.size === 1 ? "client" : "clients"} back with the salesperson in the sales data?</>
                ) : (
                  <>
                    Move {picked.size} {picked.size === 1 ? "client" : "clients"} to <span className="font-semibold">{bulkTo}</span>?
                    Whoever handles them now will no longer see them.
                  </>
                )}
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-primary"
                  autoFocus
                  onClick={() => {
                    setConfirmBulk(false);
                    void send(
                      { keys: [...picked], owner: bulkTo === "__clear" ? null : bulkTo },
                      (n) => `${n} clients updated.`,
                      priorOf(picked),
                    ).then(() => setBulkTo(""));
                  }}
                >
                  {bulkTo === "__clear" ? "Put them back" : "Move them"}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setConfirmBulk(false)}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          <Table dense>
            <thead>
              <tr>
                <Th>
                  <input type="checkbox" aria-label="Select this page" checked={allOnPagePicked} onChange={togglePage} />
                </Th>
                <Th>Client</Th>
                <Th>Country</Th>
                <Th align="right">Sales, last 12 months</Th>
                <Th>Handled by</Th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((c) => (
                <Fragment key={c.key}>
                <tr>
                  <Td>
                    <input
                      type="checkbox"
                      aria-label={`Select ${c.name}`}
                      checked={picked.has(c.key)}
                      onChange={() =>
                        setPicked((p) => {
                          const next = new Set(p);
                          if (next.has(c.key)) next.delete(c.key); else next.add(c.key);
                          return next;
                        })
                      }
                    />
                  </Td>
                  <Td className="font-semibold text-navy">{c.name}</Td>
                  <Td className="text-muted-foreground">{c.country}</Td>
                  <Td align="right">{usd(c.ytd)}</Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <select
                        className={select}
                        aria-label={`Salesperson for ${c.name}`}
                        value={c.owner}
                        onChange={(e) => setPendingRow({ key: c.key, name: c.name, from: c.owner, to: e.target.value })}
                      >
                        {[...new Set([c.owner, ...data.reps])].map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                      {c.assigned && <Badge tone="accent">Set by admin</Badge>}
                    </div>
                  </Td>
                </tr>
                {pendingRow?.key === c.key && (
                  <tr>
                    <td colSpan={5} className="px-4 pb-3">
                      <div role="alert" className="rounded-[10px] border border-warn/30 bg-warn-bg px-3.5 py-3">
                        <p className="text-[13px] leading-relaxed text-navy">
                          Move <span className="font-semibold">{pendingRow.name}</span> from <span className="font-semibold">{pendingRow.from}</span> to{" "}
                          <span className="font-semibold">{pendingRow.to}</span>? {pendingRow.from} will no longer see this customer.
                        </p>
                        <div className="mt-2.5 flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="btn btn-primary"
                            autoFocus
                            onClick={() => {
                              const p = pendingRow;
                              setPendingRow(null);
                              void send({ keys: [p.key], owner: p.to }, () => `${p.name} now handled by ${p.to}.`, priorOf([p.key]));
                            }}
                          >
                            Move
                          </button>
                          <button type="button" className="btn btn-secondary" onClick={() => setPendingRow(null)}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
                </Fragment>
              ))}
            </tbody>
          </Table>

          <div className="flex items-center justify-between text-[12.5px] text-muted-foreground">
            <span>{filtered.length} clients</span>
            <div className="flex items-center gap-2">
              <button type="button" className="btn btn-ghost" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button>
              <span>Page {page + 1} of {pages}</span>
              <button type="button" className="btn btn-ghost" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Next</button>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
