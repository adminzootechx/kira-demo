"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/primitives";
import { TextInput } from "@/components/ui/form";
import { useToast } from "@/components/ui/Toast";

type NamedEntity = { id: number; name: string };
type Kind = "departments" | "markets";

function EntityList({ kind, title, subtitle }: { kind: Kind; title: string; subtitle: string }) {
  const [items, setItems] = useState<NamedEntity[] | null>(null);
  const [newName, setNewName] = useState("");
  const { error, success } = useToast();

  const load = () => {
    fetch(`/api/admin/${kind}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((b: Record<Kind, NamedEntity[]>) => setItems(b[kind] ?? []));
  };

  useEffect(load, [kind]);

  const create = async () => {
    if (!newName.trim()) return;
    const res = await fetch(`/api/admin/${kind}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      error(`Could not add to ${title.toLowerCase()}`, body.error ?? "Try again.");
      return;
    }
    setNewName("");
    load();
  };

  const remove = async (id: number, name: string) => {
    const res = await fetch(`/api/admin/${kind}/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      error(`Could not remove "${name}"`, body.error ?? "Try again.");
      return;
    }
    success("Removed", `"${name}" has been removed.`);
    load();
  };

  const rename = async (id: number, name: string) => {
    const res = await fetch(`/api/admin/${kind}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      error("Could not rename", body.error ?? "Try again.");
      return;
    }
    success("Saved", `Renamed to "${name}".`);
    load();
  };

  return (
    <Card>
      <CardHeader title={title} subtitle={subtitle} />
      <CardBody className="space-y-4">
        <div className="flex gap-3">
          <div className="flex-1">
            <TextInput label={`New ${title.toLowerCase().replace(/s$/, "")}`} value={newName} onChange={setNewName} />
          </div>
          <button type="button" onClick={create} className="btn btn-secondary self-end">
            <Plus size={14} />
            Add
          </button>
        </div>
        <ul className="divide-y divide-border/70">
          {(items ?? []).map((item) => (
            <EntityRow key={item.id} item={item} onRename={(name) => rename(item.id, name)} onRemove={() => remove(item.id, item.name)} />
          ))}
          {items?.length === 0 && <li className="py-2.5 text-[13px] text-muted-foreground">None yet.</li>}
        </ul>
      </CardBody>
    </Card>
  );
}

/** One department/market row with its own local draft, so typing a rename
 *  doesn't fight the list's refetch-on-every-mutation pattern. */
function EntityRow({
  item,
  onRename,
  onRemove,
}: {
  item: NamedEntity;
  onRename: (name: string) => void;
  onRemove: () => void;
}) {
  const [name, setName] = useState(item.name);
  const changed = name.trim() !== item.name && name.trim().length > 0;

  return (
    <li className="flex items-center justify-between gap-3 py-2.5">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="h-9 min-w-0 flex-1 rounded-[8px] border border-border bg-card px-2.5 text-[13.5px] text-navy outline-none focus:border-accent"
      />
      <div className="flex shrink-0 items-center gap-3">
        {changed && (
          <button type="button" onClick={() => onRename(name.trim())} className="text-[12.5px] font-semibold text-accent hover:text-accent-dark">
            Save
          </button>
        )}
        <button
          type="button"
          onClick={onRemove}
          className="flex items-center gap-1.5 text-[12.5px] font-semibold text-negative transition-colors hover:text-navy"
        >
          <Trash2 size={13} />
          Remove
        </button>
      </div>
    </li>
  );
}

export function DepartmentsList() {
  return <EntityList kind="departments" title="Departments" subtitle="Teams a user can belong to." />;
}

export function MarketsList() {
  return <EntityList kind="markets" title="Markets" subtitle="Primary markets a user can be assigned to." />;
}
