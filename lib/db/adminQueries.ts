import "server-only";

import { and, count, eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { getDb } from "@/lib/db/client";
import {
  departments, groupPermissions, groupRoles, groups, markets, roles, userPermissions, users,
} from "@/lib/db/schema";
import { PAGE_LABELS } from "@/lib/access";
import { AdminError, mapDbError } from "@/lib/adminErrors";

function slugify(label: string): string {
  return label.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "item";
}

/* ------------------------------------------------------------------ */
/* Roles — plain designations, no access rights                        */
/* ------------------------------------------------------------------ */

export type RoleRow = { id: number; key: string; label: string };

export async function listRoles(): Promise<RoleRow[]> {
  return getDb().select({ id: roles.id, key: roles.key, label: roles.label }).from(roles);
}

export async function createRole(label: string): Promise<RoleRow> {
  const db = getDb();
  const base = slugify(label);
  let key = base;
  let suffix = 2;
  for (;;) {
    const [existing] = await db.select().from(roles).where(eq(roles.key, key));
    if (!existing) break;
    key = `${base}-${suffix}`;
    suffix += 1;
  }
  const [created] = await db.insert(roles).values({ key, label }).returning({ id: roles.id, key: roles.key, label: roles.label });
  return created;
}

export async function renameRole(id: number, label: string): Promise<RoleRow> {
  const [updated] = await getDb()
    .update(roles)
    .set({ label })
    .where(eq(roles.id, id))
    .returning({ id: roles.id, key: roles.key, label: roles.label });
  if (!updated) throw new AdminError("Role not found.", 404);
  return updated;
}

export async function deleteRole(id: number) {
  const [{ value: userCount }] = await getDb().select({ value: count() }).from(users).where(eq(users.roleId, id));
  if (userCount > 0) {
    throw new AdminError(`${userCount} user${userCount === 1 ? " is" : "s are"} still using this role.`);
  }
  const [{ value: groupCount }] = await getDb().select({ value: count() }).from(groupRoles).where(eq(groupRoles.roleId, id));
  if (groupCount > 0) {
    throw new AdminError(`${groupCount} group${groupCount === 1 ? " still offers" : "s still offer"} this role — remove it from ${groupCount === 1 ? "that group" : "those groups"} first.`);
  }
  await getDb().delete(roles).where(eq(roles.id, id));
}

/* ------------------------------------------------------------------ */
/* Groups — the access-control unit                                    */
/* ------------------------------------------------------------------ */

export type GroupWithDetails = {
  id: number;
  key: string;
  label: string;
  isSystem: boolean;
  scopeOwnData: boolean;
  permissions: Record<string, boolean>;
  roleIds: number[];
};

export async function listGroups(): Promise<GroupWithDetails[]> {
  const db = getDb();
  const groupRows = await db.select().from(groups);
  const permRows = await db.select().from(groupPermissions);
  const roleLinkRows = await db.select().from(groupRoles);
  return groupRows.map((g) => ({
    id: g.id,
    key: g.key,
    label: g.label,
    isSystem: g.isSystem,
    scopeOwnData: g.scopeOwnData,
    permissions: Object.fromEntries(
      permRows.filter((p) => p.groupId === g.id).map((p) => [p.permissionKey, p.enabled]),
    ),
    roleIds: roleLinkRows.filter((r) => r.groupId === g.id).map((r) => r.roleId),
  }));
}

/** The group's `key` is derived from the label, same reasoning as roles —
 *  an internal identifier nobody outside this file should have to think
 *  about. */
export async function createGroup(input: { label: string; scopeOwnData: boolean }): Promise<GroupWithDetails> {
  const db = getDb();
  const base = slugify(input.label);
  let key = base;
  let suffix = 2;
  for (;;) {
    const [existing] = await db.select().from(groups).where(eq(groups.key, key));
    if (!existing) break;
    key = `${base}-${suffix}`;
    suffix += 1;
  }
  const [created] = await db
    .insert(groups)
    .values({ key, label: input.label, scopeOwnData: input.scopeOwnData, isSystem: false })
    .returning();
  return { ...created, permissions: {}, roleIds: [] };
}

/**
 * Only `label` and `scopeOwnData` are ever settable — `isSystem` must never
 * reach `.set()`, or a crafted request could turn any group into a second
 * super-admin group. Whitelisting field-by-field is what actually enforces
 * that (see the same reasoning on `updateRole` before this rework, and the
 * mass-assignment finding that fix closed).
 */
export async function updateGroup(id: number, input: { label?: string; scopeOwnData?: boolean }) {
  const [group] = await getDb().select().from(groups).where(eq(groups.id, id));
  if (!group) throw new AdminError("Group not found.", 404);
  if (group.isSystem) throw new AdminError("The system group can't be edited.");

  const patch: { label?: string; scopeOwnData?: boolean } = {};
  if (typeof input.label === "string" && input.label.trim()) patch.label = input.label.trim();
  if (typeof input.scopeOwnData === "boolean") patch.scopeOwnData = input.scopeOwnData;
  if (Object.keys(patch).length === 0) throw new AdminError("Nothing to update.");

  const [updated] = await getDb().update(groups).set(patch).where(eq(groups.id, id)).returning();
  return updated;
}

export async function deleteGroup(id: number) {
  const [group] = await getDb().select().from(groups).where(eq(groups.id, id));
  if (!group) throw new AdminError("Group not found.", 404);
  if (group.isSystem) throw new AdminError("The system group can't be deleted.");
  const [{ value: userCount }] = await getDb().select({ value: count() }).from(users).where(eq(users.groupId, id));
  if (userCount > 0) {
    throw new AdminError(`${userCount} user${userCount === 1 ? " is" : "s are"} still assigned to this group.`);
  }
  await getDb().delete(groups).where(eq(groups.id, id));
}

export async function setGroupPermissions(groupId: number, permissions: Record<string, boolean>) {
  const [group] = await getDb().select().from(groups).where(eq(groups.id, groupId));
  if (!group) throw new AdminError("Group not found.", 404);
  if (group.isSystem) throw new AdminError("The system group always has full access.");
  const db = getDb();
  for (const [permissionKey, enabled] of Object.entries(permissions)) {
    const [existing] = await db
      .select()
      .from(groupPermissions)
      .where(and(eq(groupPermissions.groupId, groupId), eq(groupPermissions.permissionKey, permissionKey)));
    if (existing) {
      await db.update(groupPermissions).set({ enabled, updatedAt: new Date() }).where(eq(groupPermissions.id, existing.id));
    } else {
      await db.insert(groupPermissions).values({
        groupId,
        permissionKey,
        enabled,
        label: PAGE_LABELS[permissionKey] ?? permissionKey,
        category: "page",
      });
    }
  }
}

/** Replaces the full set of role designations this group offers. */
export async function setGroupRoles(groupId: number, roleIds: number[]) {
  const [group] = await getDb().select().from(groups).where(eq(groups.id, groupId));
  if (!group) throw new AdminError("Group not found.", 404);
  const db = getDb();
  await db.delete(groupRoles).where(eq(groupRoles.groupId, groupId));
  if (roleIds.length > 0) {
    await db.insert(groupRoles).values(roleIds.map((roleId) => ({ groupId, roleId })));
  }
}

/* ------------------------------------------------------------------ */
/* Departments & Markets                                               */
/* ------------------------------------------------------------------ */

export async function listDepartments() {
  return getDb().select().from(departments);
}

export async function createDepartment(name: string) {
  try {
    const [created] = await getDb().insert(departments).values({ name }).returning();
    return created;
  } catch (error) {
    mapDbError(error, { duplicate: "A department with this name already exists." });
  }
}

export async function renameDepartment(id: number, name: string) {
  try {
    const [updated] = await getDb().update(departments).set({ name }).where(eq(departments.id, id)).returning();
    if (!updated) throw new AdminError("Department not found.", 404);
    return updated;
  } catch (error) {
    mapDbError(error, { duplicate: "A department with this name already exists." });
  }
}

export async function deleteDepartment(id: number) {
  const [{ value: userCount }] = await getDb()
    .select({ value: count() })
    .from(users)
    .where(eq(users.departmentId, id));
  if (userCount > 0) {
    throw new AdminError(`${userCount} user${userCount === 1 ? " is" : "s are"} still assigned to this department.`);
  }
  await getDb().delete(departments).where(eq(departments.id, id));
}

export async function listMarkets() {
  return getDb().select().from(markets);
}

export async function createMarket(name: string) {
  try {
    const [created] = await getDb().insert(markets).values({ name }).returning();
    return created;
  } catch (error) {
    mapDbError(error, { duplicate: "A market with this name already exists." });
  }
}

export async function renameMarket(id: number, name: string) {
  try {
    const [updated] = await getDb().update(markets).set({ name }).where(eq(markets.id, id)).returning();
    if (!updated) throw new AdminError("Market not found.", 404);
    return updated;
  } catch (error) {
    mapDbError(error, { duplicate: "A market with this name already exists." });
  }
}

export async function deleteMarket(id: number) {
  const [{ value: userCount }] = await getDb()
    .select({ value: count() })
    .from(users)
    .where(eq(users.marketId, id));
  if (userCount > 0) {
    throw new AdminError(`${userCount} user${userCount === 1 ? " is" : "s are"} still assigned to this market.`);
  }
  await getDb().delete(markets).where(eq(markets.id, id));
}

/* ------------------------------------------------------------------ */
/* Users                                                                */
/* ------------------------------------------------------------------ */

/* Same shape check as lib/auth.ts's authorize() — every entry point that
 * creates a users row validates the same way, so they can't drift apart. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type AdminUserRow = {
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

const userRowSelection = {
  id: users.id,
  email: users.email,
  name: users.name,
  roleId: users.roleId,
  roleLabel: roles.label,
  groupId: users.groupId,
  groupLabel: groups.label,
  permissionMode: users.permissionMode,
  departmentId: users.departmentId,
  departmentName: departments.name,
  marketId: users.marketId,
  marketName: markets.name,
  ownerName: users.ownerName,
  managerId: users.managerId,
};

export async function listUsers(): Promise<AdminUserRow[]> {
  const rows = await getDb()
    .select(userRowSelection)
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .innerJoin(groups, eq(users.groupId, groups.id))
    .leftJoin(departments, eq(users.departmentId, departments.id))
    .leftJoin(markets, eq(users.marketId, markets.id));
  return rows as AdminUserRow[];
}

/** URL-safe, 12 characters, cryptographically random — shown once to the
 *  admin, never logged or stored in plain text. */
export function generateTempPassword(): string {
  return randomBytes(9).toString("base64url");
}

export async function createUser(input: {
  email: string;
  name: string;
  roleId: number;
  groupId: number;
  departmentId: number | null;
  marketId: number | null;
  ownerName: string | null;
  managerId?: number | null;
}): Promise<{ id: number; tempPassword: string }> {
  const email = input.email.trim().toLowerCase();
  if (!email || email.length > 254 || !EMAIL.test(email)) {
    throw new AdminError("That doesn't look like a valid email address.");
  }
  if (!input.name.trim()) {
    throw new AdminError("A user needs a name.");
  }
  const [existing] = await getDb().select().from(users).where(eq(users.email, email));
  if (existing) {
    throw new AdminError("A user with this email already exists.", 409);
  }

  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 10);
  try {
    const [created] = await getDb()
      .insert(users)
      .values({
        email,
        name: input.name.trim(),
        passwordHash,
        roleId: input.roleId,
        groupId: input.groupId,
        departmentId: input.departmentId,
        marketId: input.marketId,
        ownerName: input.ownerName,
        managerId: input.managerId ?? null,
      })
      .returning({ id: users.id });
    return { id: created.id, tempPassword };
  } catch (error) {
    mapDbError(error, {
      duplicate: "A user with this email already exists.",
      missingRef: "That role, group, department, or market no longer exists.",
    });
  }
}

/**
 * Only these five fields are ever settable — never `passwordHash`, `email`,
 * `name`, `id`, or `createdAt`, and the returned row never includes
 * `passwordHash`. When `permissionMode` is being switched to "manual" for a
 * user who has no `user_permissions` rows yet, this seeds them from their
 * *current* group's permissions as of this moment — a starting point the
 * admin then edits independently, not a live-synced mirror of the group.
 */
export async function updateUser(
  id: number,
  input: {
    roleId?: number;
    groupId?: number;
    permissionMode?: "inherit" | "manual";
    departmentId?: number | null;
    marketId?: number | null;
    ownerName?: string | null;
    managerId?: number | null;
  },
): Promise<AdminUserRow> {
  const patch: typeof input = {};
  if (typeof input.roleId === "number") patch.roleId = input.roleId;
  if (typeof input.groupId === "number") patch.groupId = input.groupId;
  if (input.permissionMode === "inherit" || input.permissionMode === "manual") patch.permissionMode = input.permissionMode;
  if (input.departmentId === null || typeof input.departmentId === "number") patch.departmentId = input.departmentId;
  if (input.marketId === null || typeof input.marketId === "number") patch.marketId = input.marketId;
  if (input.ownerName === null || typeof input.ownerName === "string") patch.ownerName = input.ownerName;
  if (input.managerId === null || typeof input.managerId === "number") {
    if (input.managerId === id) throw new AdminError("Someone cannot report to themselves.");
    patch.managerId = input.managerId;
  }
  if (Object.keys(patch).length === 0) throw new AdminError("Nothing to update.");

  const db = getDb();
  try {
    const [existingUser] = await db.select().from(users).where(eq(users.id, id));
    if (!existingUser) throw new AdminError("User not found.", 404);

    if (patch.permissionMode === "manual" && existingUser.permissionMode !== "manual") {
      const [{ value: existingCount }] = await db
        .select({ value: count() })
        .from(userPermissions)
        .where(eq(userPermissions.userId, id));
      if (existingCount === 0) {
        const groupPerms = await db
          .select()
          .from(groupPermissions)
          .where(eq(groupPermissions.groupId, patch.groupId ?? existingUser.groupId));
        if (groupPerms.length > 0) {
          await db.insert(userPermissions).values(
            groupPerms.map((p) => ({
              userId: id,
              permissionKey: p.permissionKey,
              enabled: p.enabled,
              label: p.label,
              category: p.category,
            })),
          );
        }
      }
    }

    const [updated] = await db.update(users).set(patch).where(eq(users.id, id)).returning({ id: users.id });
    if (!updated) throw new AdminError("User not found.", 404);
  } catch (error) {
    if (error instanceof AdminError) throw error;
    mapDbError(error, { missingRef: "That role, group, department, or market no longer exists." });
  }

  const [row] = await getDb().select(userRowSelection).from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .innerJoin(groups, eq(users.groupId, groups.id))
    .leftJoin(departments, eq(users.departmentId, departments.id))
    .leftJoin(markets, eq(users.marketId, markets.id))
    .where(eq(users.id, id));
  return row as AdminUserRow;
}

export async function resetUserPassword(id: number): Promise<string> {
  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 10);
  const [updated] = await getDb().update(users).set({ passwordHash }).where(eq(users.id, id)).returning({ id: users.id });
  if (!updated) throw new AdminError("User not found.", 404);
  return tempPassword;
}

export async function getUserPermissions(userId: number): Promise<Record<string, boolean>> {
  const rows = await getDb()
    .select({ permissionKey: userPermissions.permissionKey, enabled: userPermissions.enabled })
    .from(userPermissions)
    .where(eq(userPermissions.userId, userId));
  return Object.fromEntries(rows.map((r) => [r.permissionKey, r.enabled]));
}

/** Only reachable when the target user's permissionMode is "manual" — the
 *  route enforces this before calling in, since writing here for an
 *  "inherit" user would silently do nothing useful (hasAccess never reads
 *  user_permissions for them). */
export async function setUserPermissions(userId: number, permissions: Record<string, boolean>) {
  const [user] = await getDb().select().from(users).where(eq(users.id, userId));
  if (!user) throw new AdminError("User not found.", 404);
  if (user.permissionMode !== "manual") {
    throw new AdminError("Switch this user to manual permissions before editing them individually.");
  }
  const db = getDb();
  for (const [permissionKey, enabled] of Object.entries(permissions)) {
    const [existing] = await db
      .select()
      .from(userPermissions)
      .where(and(eq(userPermissions.userId, userId), eq(userPermissions.permissionKey, permissionKey)));
    if (existing) {
      await db.update(userPermissions).set({ enabled, updatedAt: new Date() }).where(eq(userPermissions.id, existing.id));
    } else {
      await db.insert(userPermissions).values({
        userId,
        permissionKey,
        enabled,
        label: PAGE_LABELS[permissionKey] ?? permissionKey,
        category: "page",
      });
    }
  }
}
