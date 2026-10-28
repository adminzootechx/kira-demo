"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Card, CardBody, CardHeader, Badge } from "@/components/ui/primitives";
import { TextInput, Toggle } from "@/components/ui/form";
import { useToast } from "@/components/ui/Toast";
import { navigation } from "@/components/shell/nav";

type GroupWithDetails = {
  id: number;
  key: string;
  label: string;
  isSystem: boolean;
  scopeOwnData: boolean;
  permissions: Record<string, boolean>;
  roleIds: number[];
};
type RoleRow = { id: number; key: string; label: string };

const pages = navigation.flatMap((g) => g.items.map((i) => ({ ...i, section: g.section })));

export default function GroupsTab() {
  const [groups, setGroups] = useState<GroupWithDetails[] | null>(null);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [newLabel, setNewLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const { error, success } = useToast();

  const load = () => {
    fetch("/api/admin/groups", { cache: "no-store" })
      .then((r) => r.json())
      .then((body: { groups?: GroupWithDetails[] }) => setGroups(body.groups ?? []))
      .catch(() => error("Could not load groups", "Refresh the page to try again."));
    fetch("/api/admin/roles", { cache: "no-store" })
      .then((r) => r.json())
      .then((body: { roles?: RoleRow[] }) => setRoles(body.roles ?? []));
  };

  useEffect(load, []);

  const createGroup = async () => {
    if (!newLabel.trim()) return;
    setCreating(true);
    const res = await fetch("/api/admin/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: newLabel.trim(), scopeOwnData: true }),
    });
    setCreating(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      error("Could not create the group", body.error ?? "Try again.");
      return;
    }
    setNewLabel("");
    success("Group created", `"${newLabel.trim()}" starts with every page turned off.`);
    load();
  };

  const deleteGroup = async (id: number, label: string) => {
    const res = await fetch(`/api/admin/groups/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      error(`Could not delete "${label}"`, body.error ?? "Try again.");
      return;
    }
    success("Group deleted", `"${label}" has been removed.`);
    load();
  };

  const togglePermission = async (groupId: number, permissionKey: string, enabled: boolean) => {
    setGroups((prev) =>
      prev?.map((g) => (g.id === groupId ? { ...g, permissions: { ...g.permissions, [permissionKey]: enabled } } : g)) ?? prev,
    );
    const res = await fetch(`/api/admin/groups/${groupId}/permissions`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ permissions: { [permissionKey]: enabled } }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      error("Could not update the permission", body.error ? `${body.error} Reverting.` : "Reverting.");
      load();
      return;
    }
    success("Saved", enabled ? "Page turned on." : "Page turned off.");
  };

  const toggleGroupRole = async (group: GroupWithDetails, roleId: number, checked: boolean) => {
    const nextRoleIds = checked ? [...group.roleIds, roleId] : group.roleIds.filter((r) => r !== roleId);
    setGroups((prev) => prev?.map((g) => (g.id === group.id ? { ...g, roleIds: nextRoleIds } : g)) ?? prev);
    const res = await fetch(`/api/admin/groups/${group.id}/roles`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roleIds: nextRoleIds }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      error("Could not update roles for this group", body.error ? `${body.error} Reverting.` : "Reverting.");
      load();
      return;
    }
    success("Saved", "Roles updated for this group.");
  };

  if (!groups) return <Card><CardBody>Loading groups…</CardBody></Card>;

  const editableGroups = groups.filter((g) => !g.isSystem);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="New access level" subtitle="Every new group starts with no pages visible — turn them on below." />
        <CardBody className="flex flex-wrap items-end gap-4">
          <div className="min-w-[240px] flex-1">
            <TextInput label="Name" value={newLabel} onChange={setNewLabel} placeholder="e.g. Finance" />
          </div>
          <button type="button" onClick={createGroup} disabled={creating || !newLabel.trim()} className="btn btn-primary">
            <Plus size={15} />
            Add group
          </button>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Access levels"
          subtitle="What each group can see. The system group always has everything and can't be edited here."
          action={<Badge tone="neutral">{groups.length} total</Badge>}
        />
        <CardBody className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-[13.5px]">
            <thead>
              <tr className="border-b border-border text-left text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-4">Page</th>
                {groups.map((g) => (
                  <th key={g.id} className="py-2 pr-4 text-center">
                    {g.label}
                    {g.isSystem && <span className="ml-1 text-[10.5px] font-normal normal-case text-muted-foreground">(all access)</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pages.map((p) => (
                <tr key={p.href} className="border-b border-border/60">
                  <td className="py-2.5 pr-4">
                    <p className="font-medium text-navy">{p.label}</p>
                    <p className="text-[11.5px] text-muted-foreground">{p.section}</p>
                  </td>
                  {groups.map((g) => (
                    <td key={g.id} className="py-2.5 pr-4 text-center">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={g.isSystem || (g.permissions[p.permissionKey] ?? false)}
                        aria-label={`${p.label} for ${g.label}`}
                        disabled={g.isSystem}
                        onClick={() => togglePermission(g.id, p.permissionKey, !(g.permissions[p.permissionKey] ?? false))}
                        className={`relative mx-auto h-5 w-9 rounded-[4px] border transition-colors ${
                          g.isSystem || (g.permissions[p.permissionKey] ?? false)
                            ? "border-accent bg-accent"
                            : "border-border bg-muted"
                        } ${g.isSystem ? "cursor-not-allowed opacity-70" : ""}`}
                      >
                        <span
                          className={`absolute top-[2px] size-3.5 rounded-[2px] bg-card transition-[left] duration-150 ${
                            g.isSystem || (g.permissions[p.permissionKey] ?? false) ? "left-[18px]" : "left-[2px]"
                          }`}
                          aria-hidden
                        />
                      </button>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>

      {editableGroups.length > 0 && (
        <Card>
          <CardHeader title="Access level settings" subtitle="Rename a group, control whether it sees only its own book, which roles it offers, or delete it." />
          <CardBody className="divide-y divide-border/70">
            {editableGroups.map((g) => (
              <GroupSettingsRow
                key={g.id}
                group={g}
                roles={roles}
                onChanged={load}
                onToggleRole={(roleId, checked) => toggleGroupRole(g, roleId, checked)}
                onDelete={() => deleteGroup(g.id, g.label)}
              />
            ))}
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function GroupSettingsRow({
  group,
  roles,
  onChanged,
  onToggleRole,
  onDelete,
}: {
  group: GroupWithDetails;
  roles: RoleRow[];
  onChanged: () => void;
  onToggleRole: (roleId: number, checked: boolean) => void;
  onDelete: () => void;
}) {
  const [label, setLabel] = useState(group.label);
  const { error, success } = useToast();

  const renamed = label.trim() !== group.label && label.trim().length > 0;

  const saveLabel = async () => {
    const res = await fetch(`/api/admin/groups/${group.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: label.trim() }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      error("Could not rename the group", body.error ?? "Try again.");
      return;
    }
    success("Saved", `Renamed to "${label.trim()}".`);
    onChanged();
  };

  return (
    <div className="space-y-4 py-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-[220px]">
            <TextInput label="Name" value={label} onChange={setLabel} />
          </div>
          {renamed && (
            <button type="button" onClick={saveLabel} className="btn btn-secondary">
              Save name
            </button>
          )}
        </div>
        <Toggle
          label="Sees only their own accounts"
          description="Off means this group sees the whole organisation's data, like Management does."
          checked={group.scopeOwnData}
          onChange={async (v) => {
            const res = await fetch(`/api/admin/groups/${group.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ scopeOwnData: v }),
            });
            if (!res.ok) {
              const body = await res.json().catch(() => ({}));
              error("Could not update the group", body.error ?? "Try again.");
              return;
            }
            success("Saved", v ? "Now sees only their own accounts." : "Now sees the whole organisation.");
            onChanged();
          }}
        />
        <button
          type="button"
          onClick={onDelete}
          className="flex items-center gap-1.5 text-[12.5px] font-semibold text-negative transition-colors hover:text-navy"
        >
          <Trash2 size={14} />
          Delete group
        </button>
      </div>
      <div>
        <p className="mb-2 text-[12.5px] font-semibold text-navy">Roles offered in this group</p>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {roles.map((r) => (
            <label key={r.id} className="flex cursor-pointer items-center gap-2 text-[13px] text-navy">
              <input
                type="checkbox"
                checked={group.roleIds.includes(r.id)}
                onChange={(e) => onToggleRole(r.id, e.target.checked)}
                className="size-4 rounded border-border"
              />
              {r.label}
            </label>
          ))}
          {roles.length === 0 && <p className="text-[12.5px] text-muted-foreground">No job titles yet — add some under Job titles.</p>}
        </div>
      </div>
    </div>
  );
}
