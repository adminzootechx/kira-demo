"use client";

import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, Plus } from "lucide-react";
import { EmptyState } from "@/components/ui/feedback";
import { Badge, Card, CardBody, CardHeader } from "@/components/ui/primitives";
import { SelectInput, TextInput, Field } from "@/components/ui/form";
import { Drawer } from "@/components/ui/Drawer";
import { useToast } from "@/components/ui/Toast";
import { useCustomerAnalytics } from "@/lib/data/store";
import { usd, type Tone } from "@/lib/format";

type Status = "waiting" | "approved" | "declined" | "cancelled";
type Row = {
  id: number; typeName: string; requesterId: number; requesterName: string; managerName: string;
  customerName: string | null; amount: number | null; note: string; status: Status;
  decidedByName: string | null; decidedAt: string | null; decisionNote: string | null; createdAt: string;
};
type TypeRow = { id: number; name: string; needsAmount: boolean; needsCustomer: boolean };
type Data = { managerId: number | null; managerName: string | null; mine: Row[]; waiting: Row[]; decided: Row[]; types: TypeRow[] };

const statusTone: Record<Status, Tone> = { waiting: "warn", approved: "positive", declined: "negative", cancelled: "neutral" };
const statusLabel: Record<Status, string> = { waiting: "Waiting", approved: "Approved", declined: "Declined", cancelled: "Cancelled" };
const when = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export default function ApprovalsView() {
  const [data, setData] = useState<Data | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const { error, success } = useToast();

  const load = () => {
    fetch("/api/approvals", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setFailed(true));
  };
  useEffect(load, []);

  const act = async (id: number, action: "approve" | "decline" | "cancel", note = "") => {
    const res = await fetch(`/api/approvals/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, note }) });
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      error("Could not do that", b.error ?? "Try again.");
      load();
      return false;
    }
    success("Done", action === "approve" ? "Approved." : action === "decline" ? "Declined." : "Request cancelled.");
    load();
    return true;
  };

  if (failed) return <Card><EmptyState title="Approvals could not be loaded" description="Check your connection and reload the page." /></Card>;
  if (!data) return <Card><CardBody>Loading approvals…</CardBody></Card>;

  return (
    <div className="space-y-6">
      {data.waiting.length > 0 && (
        <Card>
          <CardHeader title={`Waiting for you (${data.waiting.length})`} subtitle="Oldest first. Declining needs a short reason." />
          <CardBody className="divide-y divide-border/70 !pt-0">
            {data.waiting.map((r) => <WaitingItem key={r.id} row={r} onDecide={(approve, note) => act(r.id, approve ? "approve" : "decline", note)} />)}
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader
          title="My requests"
          subtitle={data.managerName ? `Sent to ${data.managerName}.` : undefined}
          action={
            <button type="button" onClick={() => setOpen(true)} disabled={!data.managerId} className="btn btn-primary disabled:opacity-50">
              <Plus size={15} />
              New request
            </button>
          }
        />
        {!data.managerId && (
          <p className="px-6 pb-4 text-[13px] text-muted-foreground">You do not have a manager set yet, so you cannot send a request. Ask an administrator to set who you report to.</p>
        )}
        {data.mine.length === 0 ? (
          <EmptyState compact icon={<BadgeCheck size={20} />} title="Nothing sent yet" description="Requests you send to your manager, and their answers, show here." />
        ) : (
          <CardBody className="divide-y divide-border/70 !pt-0">
            {data.mine.map((r) => <MineItem key={r.id} row={r} onCancel={() => act(r.id, "cancel")} />)}
          </CardBody>
        )}
      </Card>

      {data.decided.length > 0 && (
        <Card>
          <CardHeader title="Decided by you" subtitle="The last 50." />
          <CardBody className="divide-y divide-border/70 !pt-0">
            {data.decided.map((r) => <Summary key={r.id} row={r} who={r.requesterName} />)}
          </CardBody>
        </Card>
      )}

      <NewRequest open={open} onClose={() => setOpen(false)} types={data.types} managerName={data.managerName} onSent={() => { setOpen(false); load(); }} />
    </div>
  );
}

function Summary({ row, who }: { row: Row; who: string }) {
  return (
    <div className="py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[14px] font-semibold text-navy">
          {row.typeName}
          <span className="font-normal text-muted-foreground"> · {who}</span>
        </p>
        <Badge tone={statusTone[row.status]}>{statusLabel[row.status]}</Badge>
      </div>
      <p className="mt-1 text-[12.5px] text-muted-foreground">
        {[row.customerName, row.amount !== null ? usd(row.amount) : null, when(row.createdAt)].filter(Boolean).join(" · ")}
      </p>
      <p className="mt-2 whitespace-pre-wrap text-[13.5px] text-navy">{row.note}</p>
      {row.decidedByName && (
        <p className="mt-2 text-[12.5px] text-muted-foreground">
          {statusLabel[row.status]} by {row.decidedByName}{row.decidedAt ? `, ${when(row.decidedAt)}` : ""}
          {row.decisionNote ? `: ${row.decisionNote}` : ""}
        </p>
      )}
    </div>
  );
}

function MineItem({ row, onCancel }: { row: Row; onCancel: () => void }) {
  return (
    <div>
      <Summary row={row} who={`to ${row.managerName}`} />
      {row.status === "waiting" && (
        <button type="button" onClick={onCancel} className="mb-4 text-[12.5px] font-semibold text-accent hover:text-accent-dark">Cancel this request</button>
      )}
    </div>
  );
}

function WaitingItem({ row, onDecide }: { row: Row; onDecide: (approve: boolean, note: string) => Promise<boolean> }) {
  const [note, setNote] = useState("");
  const [declining, setDeclining] = useState(false);
  return (
    <div>
      <Summary row={row} who={row.requesterName} />
      <div className="mb-4 space-y-3">
        {declining && <TextInput label="Why are you declining?" value={note} onChange={setNote} />}
        <div className="flex flex-wrap gap-2">
          {!declining && <button type="button" onClick={() => onDecide(true, note)} className="btn btn-primary">Approve</button>}
          {declining ? (
            <>
              <button type="button" disabled={!note.trim()} onClick={() => onDecide(false, note)} className="btn btn-primary disabled:opacity-50">Decline</button>
              <button type="button" onClick={() => setDeclining(false)} className="btn btn-secondary">Back</button>
            </>
          ) : (
            <button type="button" onClick={() => setDeclining(true)} className="btn btn-secondary">Decline…</button>
          )}
        </div>
      </div>
    </div>
  );
}

function NewRequest({ open, onClose, types, managerName, onSent }: { open: boolean; onClose: () => void; types: TypeRow[]; managerName: string | null; onSent: () => void }) {
  const { customers } = useCustomerAnalytics();
  const [typeId, setTypeId] = useState("");
  const [customer, setCustomer] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const { error, success } = useToast();
  const type = types.find((t) => String(t.id) === typeId);
  const match = useMemo(() => customers.find((c) => c.name.toLowerCase() === customer.trim().toLowerCase()), [customers, customer]);

  const send = async () => {
    const res = await fetch("/api/approvals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        typeId: Number(typeId),
        note,
        amount: type?.needsAmount ? Number(amount) : undefined,
        customerName: customer.trim() || undefined,
        customerKey: match?.id,
      }),
    });
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      error("Could not send the request", b.error ?? "Try again.");
      return;
    }
    success("Request sent", managerName ? `${managerName} will see it.` : "Your manager will see it.");
    setTypeId(""); setCustomer(""); setAmount(""); setNote("");
    onSent();
  };

  const ready = Boolean(type && note.trim() && (!type.needsAmount || (amount !== "" && Number(amount) >= 0)) && (!type.needsCustomer || customer.trim()));

  return (
    <Drawer open={open} onClose={onClose} title="New request" subtitle={managerName ? `Goes to ${managerName}` : undefined} width={460}>
      <div className="space-y-4">
        <SelectInput
          label="What do you need approved?"
          value={typeId}
          onChange={setTypeId}
          options={[{ value: "", label: "Choose one…" }, ...types.map((t) => ({ value: String(t.id), label: t.name }))]}
        />
        {type && (
          <>
            <Field label={type.needsCustomer ? "Customer" : "Customer (optional)"} htmlFor="approval-customer">
              <input
                id="approval-customer"
                list="approval-customers"
                value={customer}
                onChange={(e) => setCustomer(e.target.value)}
                autoComplete="off"
                className="h-10 w-full rounded-[10px] border border-border bg-card px-3 text-[13.5px] text-navy outline-none focus:border-accent"
              />
              <datalist id="approval-customers">
                {customers.slice(0, 500).map((c) => <option key={c.id} value={c.name} />)}
              </datalist>
            </Field>
            {type.needsAmount && <TextInput label="Amount (US dollars)" type="number" value={amount} onChange={setAmount} />}
            <TextInput label="What are you asking, and why?" hint="A sentence or two is enough." value={note} onChange={setNote} />
          </>
        )}
        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
          <button type="button" disabled={!ready} onClick={send} className="btn btn-primary disabled:opacity-50">Send request</button>
        </div>
      </div>
    </Drawer>
  );
}
