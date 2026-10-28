"use client";

import { useCallback, useEffect, useState } from "react";
import { Compass } from "lucide-react";
import { EmptyState } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/Toast";
import { Badge, Card, CardBody, CardHeader, DataNote, PageHeader, Table, Td, Th } from "@/components/ui/primitives";
import type { AssignmentsResponse } from "@/app/api/admin/assignments/route";

type Company = {
  companyKey: string; name: string; country: string | null; owner: string | null;
  data: Record<string, unknown> | null; isClient: boolean;
};

const input =
  "rounded-lg border border-border bg-input/60 px-3.5 py-2 text-[13px] text-navy outline-none focus:border-accent focus:bg-card";

/** The few facts the scraper reported about a company, as short text. */
function summary(data: Company["data"]) {
  if (!data || typeof data !== "object") return null;
  return Object.entries(data)
    .filter(([, v]) => ["string", "number"].includes(typeof v))
    .slice(0, 4)
    .map(([k, v]) => `${k}: ${v}`)
    .join(" · ");
}

export default function SalesNavigatorPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [companies, setCompanies] = useState<Company[] | null>(null);
  const [reps, setReps] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [country, setCountry] = useState("");
  const [busy, setBusy] = useState(false);
  // Giving up or moving a company is a second, explicit step.
  const [removing, setRemoving] = useState<string | null>(null);
  const [moving, setMoving] = useState<{ c: Company; owner: string } | null>(null);
  const { error, success } = useToast();

  const load = useCallback(async () => {
    const res = await fetch("/api/opportunities", { cache: "no-store" });
    if (!res.ok) return setCompanies([]);
    const body = await res.json();
    setIsAdmin(body.isAdmin);
    setCompanies(body.companies);
    if (body.isAdmin) {
      fetch("/api/admin/assignments?repsOnly=1", { cache: "no-store" })
        .then((r) => r.json())
        .then((b: AssignmentsResponse) => setReps(b.reps ?? []));
    }
  }, []);

  useEffect(() => {
    // Loads from the server on mount; the state set happens after the fetch resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const add = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    const res = await fetch("/api/opportunities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, country }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      error("Could not add that company", body.error ?? "Try again.");
      return;
    }
    success("Done", body.message);
    setName("");
    setCountry("");
    void load();
  };

  const remove = async (c: Company) => {
    const res = await fetch(`/api/opportunities?key=${encodeURIComponent(c.companyKey)}`, { method: "DELETE" });
    if (!res.ok) return error("Could not remove it", "Try again.");
    success("Removed", `${c.name} is free to be added again.`);
    void load();
  };

  const reassign = async (c: Company, owner: string) => {
    const res = await fetch("/api/opportunities", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: c.companyKey, owner: owner || null }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return error("Could not change the salesperson", body.error ?? "Try again.");
    success("Saved", owner ? `${c.name} now belongs to ${owner}.` : `${c.name} is unassigned.`);
    void load();
  };

  return (
    <>
      <PageHeader
        title="New buyers"
        subtitle={
          isAdmin
            ? "Companies outside the book, who holds each one, and what the external data says about them."
            : "Companies you are working on, and what the external data says about your own customers."
        }
      />

      <Card>
        <CardHeader
          title="Add a company"
          subtitle="Each company can belong to only one salesperson. If it is already a customer or has been taken by someone else, it cannot be added."
        />
        <CardBody className="flex flex-wrap items-end gap-3">
          <label className="text-[12px] text-muted-foreground">
            Company name
            <input className={`${input} mt-1 block w-72 max-w-full`} value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void add()} />
          </label>
          <label className="text-[12px] text-muted-foreground">
            Country (optional)
            <input className={`${input} mt-1 block w-44 max-w-full`} value={country} onChange={(e) => setCountry(e.target.value)} />
          </label>
          <button type="button" className="btn btn-primary" disabled={!name.trim() || busy} onClick={() => void add()}>
            Add
          </button>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={isAdmin ? "All companies" : "Your companies"} subtitle="Companies you added, and external data on your own customers" />
        {companies && companies.length === 0 ? (
          <EmptyState
            icon={<Compass size={22} strokeWidth={1.8} />}
            title="Nothing here yet"
            description="Add a company above. Details from the external data source appear next to a company once they are loaded."
          />
        ) : (
          <>
          {moving && (
            <div role="alert" className="mx-5 mb-3 rounded-[10px] border border-warn/30 bg-warn-bg px-3.5 py-3">
              <p className="text-[13px] leading-relaxed text-navy">
                {moving.owner
                  ? `Give ${moving.c.name} to ${moving.owner}?`
                  : `Release ${moving.c.name} so any salesperson can add it?`}{" "}
                {moving.c.owner ? `${moving.c.owner} will no longer see it.` : ""}
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                <button type="button" className="btn btn-primary" onClick={() => { const m = moving; setMoving(null); void reassign(m.c, m.owner); }}>
                  Confirm
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setMoving(null)}>
                  Cancel
                </button>
              </div>
            </div>
          )}
          <Table dense>
            <thead>
              <tr>
                <Th>Company</Th>
                <Th>Country</Th>
                <Th>Status</Th>
                <Th>What we know</Th>
                {isAdmin && <Th>Salesperson</Th>}
                <Th />
              </tr>
            </thead>
            <tbody>
              {(companies ?? []).map((c) => (
                <tr key={c.companyKey}>
                  <Td className="font-semibold text-navy">{c.name}</Td>
                  <Td className="text-muted-foreground">{c.country ?? "—"}</Td>
                  <Td>{c.isClient ? <Badge tone="positive">Existing customer</Badge> : <Badge tone="accent">New buyer</Badge>}</Td>
                  <Td className="text-muted-foreground">{summary(c.data) ?? "Waiting for external data"}</Td>
                  {isAdmin && (
                    <Td>
                      <select className={input} aria-label={`Salesperson for ${c.name}`} value={c.owner ?? ""} onChange={(e) => setMoving({ c, owner: e.target.value })}>
                        <option value="">Unassigned</option>
                        {[...new Set([...(c.owner ? [c.owner] : []), ...reps])].map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </Td>
                  )}
                  <Td align="right">
                    {(isAdmin || !c.isClient) &&
                      (removing === c.companyKey ? (
                        <span className="inline-flex flex-wrap items-center justify-end gap-2">
                          <span className="text-[12.5px] text-navy">Give up this company?</span>
                          <button type="button" className="btn btn-secondary text-[12px]" onClick={() => { setRemoving(null); void remove(c); }}>
                            Remove
                          </button>
                          <button type="button" className="btn btn-ghost text-[12px]" onClick={() => setRemoving(null)}>
                            Keep
                          </button>
                        </span>
                      ) : (
                        <button type="button" className="btn btn-ghost text-[12px]" onClick={() => setRemoving(c.companyKey)}>Remove</button>
                      ))}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          </>
        )}
        <DataNote>
          Salespeople see only their own companies and external data on their own customers. An existing customer is
          always handled by the salesperson it is assigned to.
        </DataNote>
      </Card>
    </>
  );
}
