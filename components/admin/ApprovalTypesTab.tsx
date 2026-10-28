"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Badge, Card, CardBody, CardHeader } from "@/components/ui/primitives";
import { CheckRow, TextInput } from "@/components/ui/form";
import { useToast } from "@/components/ui/Toast";

type TypeRow = { id: number; name: string; needsAmount: boolean; needsCustomer: boolean; active: boolean };

export default function ApprovalTypesTab() {
  const [types, setTypes] = useState<TypeRow[] | null>(null);
  const [name, setName] = useState("");
  const [needsAmount, setNeedsAmount] = useState(false);
  const [needsCustomer, setNeedsCustomer] = useState(false);
  const { error, success } = useToast();

  const load = () => {
    fetch("/api/admin/approval-types", { cache: "no-store" })
      .then((r) => r.json())
      .then((b: { types?: TypeRow[] }) => setTypes(b.types ?? []));
  };
  useEffect(load, []);

  const send = async (url: string, method: string, body: object, done: string) => {
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      error("Could not save", b.error ?? "Try again.");
      return false;
    }
    success("Saved", done);
    load();
    return true;
  };

  const add = async () => {
    if (!name.trim()) return;
    if (await send("/api/admin/approval-types", "POST", { name, needsAmount, needsCustomer }, `"${name.trim()}" can now be requested.`)) {
      setName("");
      setNeedsAmount(false);
      setNeedsCustomer(false);
    }
  };

  const patch = (t: TypeRow, body: Partial<TypeRow>, done: string) => send(`/api/admin/approval-types/${t.id}`, "PATCH", body, done);

  if (!types) return <Card><CardBody>Loading request types…</CardBody></Card>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="New request type" subtitle="Something a salesperson can ask their manager to approve, such as a discount or a payment extension." />
        <CardBody className="space-y-4">
          <TextInput label="Name" value={name} onChange={setName} placeholder="e.g. Extra discount" />
          <div className="divide-y divide-border/70">
            <CheckRow label="Ask for an amount" checked={needsAmount} onChange={setNeedsAmount} />
            <CheckRow label="Ask which customer it is about" checked={needsCustomer} onChange={setNeedsCustomer} />
          </div>
          <button type="button" onClick={add} disabled={!name.trim()} className="btn btn-primary disabled:opacity-50">
            <Plus size={15} />
            Add request type
          </button>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Request types" subtitle="Switching one off hides it from new requests. Old requests keep it." />
        <CardBody className="divide-y divide-border/70">
          {types.map((t) => (
            <TypeItem key={t.id} type={t} onRename={(n) => patch(t, { name: n }, "Renamed.")} onToggle={(b) => patch(t, b, "Updated.")} />
          ))}
        </CardBody>
      </Card>
    </div>
  );
}

function TypeItem({ type, onRename, onToggle }: { type: TypeRow; onRename: (name: string) => void; onToggle: (b: Partial<TypeRow>) => void }) {
  const [label, setLabel] = useState(type.name);
  const changed = label.trim() !== type.name && label.trim().length > 0;
  return (
    <div className="space-y-2 py-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          aria-label={`Name of ${type.name}`}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="h-10 min-w-0 flex-1 rounded-[10px] border border-border bg-card px-3 text-[13.5px] text-navy outline-none focus:border-accent"
        />
        {changed && <button type="button" onClick={() => onRename(label)} className="btn btn-secondary">Save name</button>}
        {!type.active && <Badge tone="neutral">Off</Badge>}
      </div>
      <div className="flex flex-wrap gap-x-6">
        <CheckRow label="Asks for an amount" checked={type.needsAmount} onChange={(v) => onToggle({ needsAmount: v })} />
        <CheckRow label="Asks for a customer" checked={type.needsCustomer} onChange={(v) => onToggle({ needsCustomer: v })} />
        <CheckRow label="Available to request" checked={type.active} onChange={(v) => onToggle({ active: v })} />
      </div>
    </div>
  );
}
