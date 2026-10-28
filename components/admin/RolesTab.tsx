"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/primitives";
import { TextInput } from "@/components/ui/form";
import { useToast } from "@/components/ui/Toast";

type RoleRow = { id: number; key: string; label: string };

export default function RolesTab() {
  const [roles, setRoles] = useState<RoleRow[] | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const { error, success } = useToast();

  const load = () => {
    fetch("/api/admin/roles", { cache: "no-store" })
      .then((r) => r.json())
      .then((body: { roles?: RoleRow[] }) => setRoles(body.roles ?? []))
      .catch(() => error("Could not load roles", "Refresh the page to try again."));
  };

  useEffect(load, []);

  const create = async () => {
    if (!newLabel.trim()) return;
    const res = await fetch("/api/admin/roles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: newLabel.trim() }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      error("Could not add the job title", body.error ?? "Try again.");
      return;
    }
    setNewLabel("");
    load();
  };

  const rename = async (id: number, label: string) => {
    const res = await fetch(`/api/admin/roles/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      error("Could not rename", body.error ?? "Try again.");
      return;
    }
    success("Saved", `Renamed to "${label}".`);
    load();
  };

  const remove = async (id: number, label: string) => {
    const res = await fetch(`/api/admin/roles/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      error(`Could not remove "${label}"`, body.error ?? "Try again.");
      return;
    }
    success("Removed", `"${label}" has been removed.`);
    load();
  };

  if (!roles) return <Card><CardBody>Loading roles…</CardBody></Card>;

  return (
    <Card>
      <CardHeader
        title="Job titles"
        subtitle="Shown next to a person's name. To change what someone can see, use Access levels."
      />
      <CardBody className="space-y-4">
        <div className="flex gap-3">
          <div className="flex-1">
            <TextInput label="New job title" value={newLabel} onChange={setNewLabel} placeholder="e.g. Senior Sales Rep" />
          </div>
          <button type="button" onClick={create} className="btn btn-secondary self-end">
            <Plus size={14} />
            Add
          </button>
        </div>
        <ul className="divide-y divide-border/70">
          {roles.map((role) => (
            <RoleRowItem key={role.id} role={role} onRename={(label) => rename(role.id, label)} onRemove={() => remove(role.id, role.label)} />
          ))}
          {roles.length === 0 && <li className="py-2.5 text-[13px] text-muted-foreground">None yet.</li>}
        </ul>
      </CardBody>
    </Card>
  );
}

function RoleRowItem({
  role,
  onRename,
  onRemove,
}: {
  role: RoleRow;
  onRename: (label: string) => void;
  onRemove: () => void;
}) {
  const [label, setLabel] = useState(role.label);
  const changed = label.trim() !== role.label && label.trim().length > 0;

  return (
    <li className="flex items-center justify-between gap-3 py-2.5">
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        className="h-9 min-w-0 flex-1 rounded-[8px] border border-border bg-card px-2.5 text-[13.5px] text-navy outline-none focus:border-accent"
      />
      <div className="flex shrink-0 items-center gap-3">
        {changed && (
          <button type="button" onClick={() => onRename(label.trim())} className="text-[12.5px] font-semibold text-accent hover:text-accent-dark">
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
