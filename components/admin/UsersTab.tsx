"use client";

import { useEffect, useRef, useState } from "react";
import { Copy, KeyRound, Plus, SlidersHorizontal } from "lucide-react";
import { Card, CardBody, CardHeader, Badge } from "@/components/ui/primitives";
import { SelectInput, TextInput, Toggle, CheckRow, ReadOnlyRow } from "@/components/ui/form";
import { Drawer } from "@/components/ui/Drawer";
import { useToast } from "@/components/ui/Toast";
import { navigation } from "@/components/shell/nav";

type RoleRow = { id: number; key: string; label: string };
type GroupRow = { id: number; label: string; isSystem: boolean; scopeOwnData: boolean; roleIds: number[] };
type NamedEntity = { id: number; name: string };
type AdminUserRow = {
  id: number;
  email: string;
  name: string;
  roleId: number;
  roleLabel: string;
  groupId: number;
  groupLabel: string;
  permissionMode: "inherit" | "manual";
  departmentId: number | null;
  departmentName: string | null;
  marketId: number | null;
  marketName: string | null;
  ownerName: string | null;
  managerId: number | null;
};

const NONE = "__none__";
const pages = navigation.flatMap((g) => g.items.map((i) => ({ ...i, section: g.section })));

export default function UsersTab() {
  const [users, setUsers] = useState<AdminUserRow[] | null>(null);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [departments, setDepartments] = useState<NamedEntity[]>([]);
  const [markets, setMarkets] = useState<NamedEntity[]>([]);
  const [tempPassword, setTempPassword] = useState<{ email: string; password: string } | null>(null);
  const [editingUser, setEditingUser] = useState<AdminUserRow | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [step, setStep] = useState(0);
  const { error, success } = useToast();

  const [form, setForm] = useState({ email: "", name: "", groupId: "", roleId: "", departmentId: NONE, marketId: NONE, ownerName: "", managerId: NONE });

  const load = () => {
    fetch("/api/admin/users", { cache: "no-store" }).then((r) => r.json()).then((b: { users?: AdminUserRow[] }) => setUsers(b.users ?? []));
    fetch("/api/admin/roles", { cache: "no-store" }).then((r) => r.json()).then((b: { roles?: RoleRow[] }) => setRoles(b.roles ?? []));
    fetch("/api/admin/groups", { cache: "no-store" }).then((r) => r.json()).then((b: { groups?: GroupRow[] }) => setGroups(b.groups ?? []));
    fetch("/api/admin/departments", { cache: "no-store" }).then((r) => r.json()).then((b: { departments?: NamedEntity[] }) => setDepartments(b.departments ?? []));
    fetch("/api/admin/markets", { cache: "no-store" }).then((r) => r.json()).then((b: { markets?: NamedEntity[] }) => setMarkets(b.markets ?? []));
  };

  useEffect(load, []);

  // The Overview's "Add a person" shortcut lands here with ?add=1.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads the address once on mount
    if (new URLSearchParams(window.location.search).get("add")) setWizardOpen(true);
  }, []);

  // Keep the open panel's data in step with the table once a reload lands.
  useEffect(() => {
    if (!editingUser || !users) return;
    const fresh = users.find((u) => u.id === editingUser.id);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loads from the server on mount
    if (fresh) setEditingUser(fresh);
  }, [users, editingUser?.id]);

  const selectedGroup = groups.find((g) => String(g.id) === form.groupId);
  const rolesForSelectedGroup = selectedGroup ? roles.filter((r) => selectedGroup.roleIds.includes(r.id)) : roles;

  const createUser = async () => {
    if (!form.email.trim() || !form.name.trim() || !form.roleId || !form.groupId) {
      error("Missing fields", "Email, name, role, and group are required.");
      return;
    }
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.email.trim(),
        name: form.name.trim(),
        roleId: Number(form.roleId),
        groupId: Number(form.groupId),
        departmentId: form.departmentId === NONE ? null : Number(form.departmentId),
        marketId: form.marketId === NONE ? null : Number(form.marketId),
        ownerName: form.ownerName.trim() || null,
        managerId: form.managerId === NONE ? null : Number(form.managerId),
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      error("Could not create the user", body.error ?? "Try again.");
      return;
    }
    setTempPassword({ email: form.email.trim(), password: body.tempPassword });
    setForm({ email: "", name: "", groupId: "", roleId: "", departmentId: NONE, marketId: NONE, ownerName: "", managerId: NONE });
    setWizardOpen(false);
    setStep(0);
    success("Person added", "Their temporary password is shown at the top — copy it now.");
    load();
  };

  const updateField = async (id: number, field: "roleId" | "groupId" | "departmentId" | "marketId" | "managerId", value: string) => {
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value === NONE ? null : Number(value) }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      error("Could not update the user", body.error ?? "Try again.");
      return;
    }
    success("Saved", "User updated.");
    load();
  };

  const setPermissionMode = async (id: number, mode: "inherit" | "manual") => {
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ permissionMode: mode }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      error("Could not change permission mode", body.error ?? "Try again.");
      return;
    }
    success("Saved", mode === "manual" ? "This user now has their own permission set." : "This user now follows their group's permissions.");
    load();
  };

  const resetPassword = async (id: number, email: string) => {
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "resetPassword" }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      error("Could not reset the password", body.error ?? "Try again.");
      return;
    }
    setTempPassword({ email, password: body.tempPassword });
  };

  if (!users) return <Card><CardBody>Loading users…</CardBody></Card>;

  return (
    <div className="space-y-6">
      {tempPassword && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-[10px] border border-accent/30 bg-accent-bg px-5 py-4">
          <p className="text-[13.5px] text-navy">
            Temporary password for <span className="font-semibold">{tempPassword.email}</span>:{" "}
            <span className="font-mono font-semibold">{tempPassword.password}</span> — share it with them now, it won&apos;t be shown again.
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={() => navigator.clipboard?.writeText(tempPassword.password)} className="btn btn-secondary">
              <Copy size={14} />
              Copy
            </button>
            <button type="button" onClick={() => setTempPassword(null)} className="btn btn-secondary">
              Dismiss
            </button>
          </div>
        </div>
      )}

      <AddPersonWizard
        open={wizardOpen}
        onClose={() => { setWizardOpen(false); setStep(0); }}
        step={step}
        setStep={setStep}
        form={form}
        setForm={setForm}
        groups={groups}
        roles={rolesForSelectedGroup}
        departments={departments}
        markets={markets}
        scopeOwnData={!!selectedGroup?.scopeOwnData}
        people={users}
        onCreate={createUser}
      />

      <Card>
        <CardHeader
          title="Team members"
          subtitle="Open a person to change their access level, job title, team, or permissions."
          action={<button type="button" onClick={() => setWizardOpen(true)} className="btn btn-primary"><Plus size={15} />Add a person</button>}
        />
        <CardBody className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-[13.5px]">
            <thead>
              <tr className="border-b border-border text-left text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Access level</th>
                <th className="py-2 pr-4">Job title</th>
                <th className="py-2 pr-4">Department / market</th>
                <th className="py-2 pr-4">Permissions</th>
                <th className="py-2 pr-4" />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-border/60">
                  <td className="py-2.5 pr-4">
                    <p className="font-medium text-navy">{u.name}</p>
                    <p className="text-[11.5px] text-muted-foreground">{u.email}</p>
                  </td>
                  <td className="py-2.5 pr-4 text-navy">{u.groupLabel}</td>
                  <td className="py-2.5 pr-4 text-navy">{u.roleLabel}</td>
                  <td className="py-2.5 pr-4 text-muted-foreground">
                    {[u.departmentName, u.marketName].filter(Boolean).join(" · ") || "—"}
                  </td>
                  <td className="py-2.5 pr-4">
                    <Badge tone={u.permissionMode === "manual" ? "accent" : "neutral"}>
                      {u.permissionMode === "manual" ? "Manual" : "Inherits group"}
                    </Badge>
                  </td>
                  <td className="py-2.5 pr-4 text-right">
                    <button
                      type="button"
                      onClick={() => setEditingUser(u)}
                      className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-accent transition-colors hover:text-accent-dark"
                    >
                      <SlidersHorizontal size={13} />
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>

      <UserEditPanel
        user={editingUser}
        roles={roles}
        groups={groups}
        departments={departments}
        markets={markets}
        people={users}
        onClose={() => setEditingUser(null)}
        onUpdateField={updateField}
        onSetPermissionMode={setPermissionMode}
        onResetPassword={(id, email) => resetPassword(id, email)}
      />
    </div>
  );
}

function UserEditPanel({
  user,
  roles,
  groups,
  departments,
  markets,
  people,
  onClose,
  onUpdateField,
  onSetPermissionMode,
  onResetPassword,
}: {
  user: AdminUserRow | null;
  roles: RoleRow[];
  groups: GroupRow[];
  departments: NamedEntity[];
  markets: NamedEntity[];
  people: AdminUserRow[];
  onClose: () => void;
  onUpdateField: (id: number, field: "roleId" | "groupId" | "departmentId" | "marketId" | "managerId", value: string) => void;
  onSetPermissionMode: (id: number, mode: "inherit" | "manual") => void;
  onResetPassword: (id: number, email: string) => void;
}) {
  const triggerRef = useRef<HTMLElement | null>(null);

  // The trigger that opened the panel has already lost focus by the time we
  // get here, so hand focus back to the body rather than chasing a stale ref.
  useEffect(() => {
    if (user) triggerRef.current = document.activeElement as HTMLElement;
  }, [user]);

  const group = user ? groups.find((g) => g.id === user.groupId) : undefined;
  const rolesForGroup = group ? roles.filter((r) => group.roleIds.includes(r.id)) : roles;

  return (
    <Drawer
      open={!!user}
      onClose={onClose}
      title={user?.name ?? ""}
      subtitle={user?.email}
      returnFocusTo={triggerRef}
      width={440}
    >
      {user && (
        <div className="space-y-6">
          <div className="grid gap-4">
            <SelectInput
              label="Access level"
              hint="Decides which pages this person can open."
              value={String(user.groupId)}
              onChange={(v) => onUpdateField(user.id, "groupId", v)}
              options={groups.map((g) => ({ value: String(g.id), label: g.label }))}
            />
            <SelectInput
              label="Job title"
              hint="Shown next to their name. It does not change what they can see."
              value={String(user.roleId)}
              onChange={(v) => onUpdateField(user.id, "roleId", v)}
              options={rolesForGroup.map((r) => ({ value: String(r.id), label: r.label }))}
            />
            <SelectInput
              label="Department"
              value={user.departmentId ? String(user.departmentId) : NONE}
              onChange={(v) => onUpdateField(user.id, "departmentId", v)}
              options={[{ value: NONE, label: "None" }, ...departments.map((d) => ({ value: String(d.id), label: d.name }))]}
            />
            <SelectInput
              label="Market"
              value={user.marketId ? String(user.marketId) : NONE}
              onChange={(v) => onUpdateField(user.id, "marketId", v)}
              options={[{ value: NONE, label: "None" }, ...markets.map((m) => ({ value: String(m.id), label: m.name }))]}
            />
            <SelectInput
              label="Reports to"
              hint="Their approval requests go to this person."
              value={user.managerId ? String(user.managerId) : NONE}
              onChange={(v) => onUpdateField(user.id, "managerId", v)}
              options={[{ value: NONE, label: "Nobody yet" }, ...people.filter((u) => u.id !== user.id).map((u) => ({ value: String(u.id), label: u.name }))]}
            />
          </div>

          <div className="border-t border-border pt-5">
            <Toggle
              label="Choose pages for this person only"
              description="Off: they follow their access level. On: they get their own list of pages, starting from the access level's current settings."
              checked={user.permissionMode === "manual"}
              onChange={(v) => onSetPermissionMode(user.id, v ? "manual" : "inherit")}
            />
          </div>

          {user.permissionMode === "manual" && (
            <div className="border-t border-border pt-5">
              <UserPermissionMatrix userId={user.id} />
            </div>
          )}

          <div className="border-t border-border pt-5">
            <ReadOnlyRow label="Sign-in email" value={user.email} />
            <button
              type="button"
              onClick={() => onResetPassword(user.id, user.email)}
              className="mt-3 flex items-center gap-1.5 text-[12.5px] font-semibold text-accent transition-colors hover:text-accent-dark"
            >
              <KeyRound size={14} />
              Reset password
            </button>
          </div>
        </div>
      )}
    </Drawer>
  );
}

/** This user's own independent permission matrix — only ever shown/editable
 *  while their permissionMode is "manual". Pre-filled from their current
 *  user_permissions rows, which updateUser seeded from the group's
 *  permissions at the moment they were switched to manual. */
function UserPermissionMatrix({ userId }: { userId: number }) {
  const [permissions, setPermissions] = useState<Record<string, boolean> | null>(null);
  const { error, success } = useToast();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loads from the server on mount
    setPermissions(null);
    fetch(`/api/admin/users/${userId}/permissions`, { cache: "no-store" })
      .then((r) => r.json())
      .then((b: { permissions?: Record<string, boolean> }) => setPermissions(b.permissions ?? {}));
  }, [userId]);

  const toggle = async (permissionKey: string, enabled: boolean) => {
    setPermissions((prev) => ({ ...prev, [permissionKey]: enabled }));
    const res = await fetch(`/api/admin/users/${userId}/permissions`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ permissions: { [permissionKey]: enabled } }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      error("Could not update the permission", body.error ?? "Try again.");
      return;
    }
    success("Saved", enabled ? "Page turned on." : "Page turned off.");
  };

  if (!permissions) return <p className="text-[13px] text-muted-foreground">Loading permissions…</p>;

  return (
    <div>
      <p className="mb-1 text-[12.5px] font-semibold text-navy">Individual permissions</p>
      <div className="divide-y divide-border/70">
        {pages.map((p) => (
          <CheckRow
            key={p.href}
            label={p.label}
            checked={permissions[p.permissionKey] ?? false}
            onChange={(v) => toggle(p.permissionKey, v)}
          />
        ))}
      </div>
    </div>
  );
}

const STEPS = ["Who", "Their access", "Their team", "Check and add"];

type WizardForm = { email: string; name: string; groupId: string; roleId: string; departmentId: string; marketId: string; ownerName: string; managerId: string };

/** Adding a person as four short steps instead of one long form. */
function AddPersonWizard({
  open, onClose, step, setStep, form, setForm, groups, roles, departments, markets, scopeOwnData, people, onCreate,
}: {
  open: boolean;
  onClose: () => void;
  step: number;
  setStep: (n: number) => void;
  form: WizardForm;
  setForm: React.Dispatch<React.SetStateAction<WizardForm>>;
  groups: GroupRow[];
  roles: RoleRow[];
  departments: NamedEntity[];
  markets: NamedEntity[];
  scopeOwnData: boolean;
  people: AdminUserRow[];
  onCreate: () => void;
}) {
  const set = (k: keyof WizardForm) => (v: string) => setForm((f) => ({ ...f, [k]: v, ...(k === "groupId" ? { roleId: "" } : {}) }));
  const nameOf = (list: { id: number; name?: string; label?: string }[], id: string) => {
    const x = list.find((i) => String(i.id) === id);
    return x ? (x.name ?? x.label ?? "") : "";
  };
  const ready = [Boolean(form.email.trim() && form.name.trim()), Boolean(form.groupId && form.roleId), true, true][step];
  const last = step === STEPS.length - 1;

  return (
    <Drawer open={open} onClose={onClose} title="Add a person" subtitle={`Step ${step + 1} of ${STEPS.length}: ${STEPS[step]}`} width={460}>
      <div className="space-y-6">
        <div className="flex gap-1.5" aria-hidden>
          {STEPS.map((s, i) => (
            <span key={s} className={`h-1 flex-1 rounded-full ${i <= step ? "bg-accent" : "bg-border"}`} />
          ))}
        </div>

        {step === 0 && (
          <div className="grid gap-4">
            <TextInput label="Full name" value={form.name} onChange={set("name")} autoComplete="off" />
            <TextInput label="Work email" hint="They sign in with this." type="email" value={form.email} onChange={set("email")} autoComplete="off" />
          </div>
        )}

        {step === 1 && (
          <div className="grid gap-4">
            <SelectInput
              label="Access level"
              hint="Decides which pages this person can open."
              value={form.groupId}
              onChange={set("groupId")}
              options={[{ value: "", label: "Choose one…" }, ...groups.map((g) => ({ value: String(g.id), label: g.label }))]}
            />
            <SelectInput
              label="Job title"
              hint="Shown next to their name. It does not change what they can see."
              value={form.roleId}
              onChange={set("roleId")}
              options={[{ value: "", label: form.groupId ? "Choose one…" : "Choose an access level first" }, ...roles.map((r) => ({ value: String(r.id), label: r.label }))]}
            />
          </div>
        )}

        {step === 2 && (
          <div className="grid gap-4">
            <SelectInput label="Department" value={form.departmentId} onChange={set("departmentId")} options={[{ value: NONE, label: "None" }, ...departments.map((d) => ({ value: String(d.id), label: d.name }))]} />
            <SelectInput label="Market" value={form.marketId} onChange={set("marketId")} options={[{ value: NONE, label: "None" }, ...markets.map((m) => ({ value: String(m.id), label: m.name }))]} />
            <SelectInput
              label="Reports to"
              hint="Their approval requests go to this person."
              value={form.managerId}
              onChange={set("managerId")}
              options={[{ value: NONE, label: "Nobody yet" }, ...people.map((u) => ({ value: String(u.id), label: u.name }))]}
            />
            {scopeOwnData && (
              <TextInput
                label="Name on their sales records"
                hint="Must match the salesperson name on the sales data, so they see only their own clients."
                value={form.ownerName}
                onChange={set("ownerName")}
              />
            )}
          </div>
        )}

        {last && (
          <dl className="divide-y divide-border/70 text-[13.5px]">
            {[
              ["Name", form.name],
              ["Email", form.email],
              ["Access level", nameOf(groups, form.groupId)],
              ["Job title", nameOf(roles, form.roleId)],
              ["Department", nameOf(departments, form.departmentId) || "None"],
              ["Market", nameOf(markets, form.marketId) || "None"],
              ["Reports to", people.find((u) => String(u.id) === form.managerId)?.name ?? "Nobody yet"],
              ...(scopeOwnData ? [["Name on sales records", form.ownerName || "Not set"]] : []),
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 py-2">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="text-right font-medium text-navy">{v}</dd>
              </div>
            ))}
          </dl>
        )}

        <div className="flex items-center justify-between border-t border-border pt-4">
          <button type="button" onClick={() => (step === 0 ? onClose() : setStep(step - 1))} className="btn btn-secondary">
            {step === 0 ? "Cancel" : "Back"}
          </button>
          {last ? (
            <button type="button" onClick={onCreate} className="btn btn-primary"><Plus size={15} />Add person</button>
          ) : (
            <button type="button" disabled={!ready} onClick={() => setStep(step + 1)} className="btn btn-primary disabled:opacity-50">Next</button>
          )}
        </div>
        {last && <p className="text-[12px] text-muted-foreground">A temporary password is made for them and shown once. They should change it after signing in.</p>}
      </div>
    </Drawer>
  );
}
