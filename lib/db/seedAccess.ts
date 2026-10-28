import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";
import { getDb } from "./client";
import { departments, groupPermissions, groupRoles, groups, markets, roles, users } from "./schema";
import { navigation } from "@/components/shell/nav";

/**
 * Seeds the groups/roles access model: two starter roles (plain
 * designations — "Management", "Sales Rep" — carrying no access rights),
 * two starter groups (Management is the one `isSystem` group — always full
 * access, can't be deleted), the markets already referenced in the
 * account-settings UI, two departments matching the demo viewers,
 * group_permissions from nav.ts's `defaultEnabledForRep` flags, and two
 * starter users (each `permissionMode: "inherit"`, so they follow their
 * group's permissions).
 *
 * Run once: npx tsx --conditions react-server --env-file .env.local lib/db/seedAccess.ts
 * (`--conditions react-server` satisfies the `server-only` import guard
 * outside Next's own build; `--env-file` loads DATABASE_URL.)
 * Re-running is safe — every insert is guarded by a pre-check.
 */
async function seed() {
  const db = getDb();

  async function upsertRole(key: string, label: string) {
    const [existing] = await db.select().from(roles).where(eq(roles.key, key));
    if (existing) return existing.id;
    const [created] = await db.insert(roles).values({ key, label }).returning({ id: roles.id });
    return created.id;
  }

  async function upsertGroup(key: string, label: string, isSystem: boolean, scopeOwnData: boolean) {
    const [existing] = await db.select().from(groups).where(eq(groups.key, key));
    if (existing) return existing.id;
    const [created] = await db.insert(groups).values({ key, label, isSystem, scopeOwnData }).returning({ id: groups.id });
    return created.id;
  }

  const managementRoleId = await upsertRole("management", "Management");
  const repRoleId = await upsertRole("rep", "Sales Rep");

  const managementGroupId = await upsertGroup("management", "Management", true, false);
  const repGroupId = await upsertGroup("rep", "Sales Rep", false, true);

  async function linkGroupRole(groupId: number, roleId: number) {
    const [existing] = await db
      .select()
      .from(groupRoles)
      .where(and(eq(groupRoles.groupId, groupId), eq(groupRoles.roleId, roleId)));
    if (existing) return;
    await db.insert(groupRoles).values({ groupId, roleId });
  }
  await linkGroupRole(managementGroupId, managementRoleId);
  await linkGroupRole(repGroupId, repRoleId);

  async function upsertMarket(name: string) {
    const [existing] = await db.select().from(markets).where(eq(markets.name, name));
    if (existing) return existing.id;
    const [created] = await db.insert(markets).values({ name }).returning({ id: markets.id });
    return created.id;
  }

  const marketNames = ["Global", "Belgium", "Dubai", "Israel", "Hong Kong", "India", "USA"];
  const marketIds: Record<string, number> = {};
  for (const name of marketNames) marketIds[name] = await upsertMarket(name);

  async function upsertDepartment(name: string) {
    const [existing] = await db.select().from(departments).where(eq(departments.name, name));
    if (existing) return existing.id;
    const [created] = await db.insert(departments).values({ name }).returning({ id: departments.id });
    return created.id;
  }

  const deptIds = {
    salesLeadership: await upsertDepartment("Sales Leadership"),
    europeDesk: await upsertDepartment("Europe Desk"),
  };

  // Page-level permissions, one row per nav item, scoped to the Sales Rep
  // group. Every item gets a row (not just the restricted ones) so
  // hasAccess's fail-safe-closed default never wrongly denies a rep-visible
  // page just because it was never seeded.
  for (const group of navigation) {
    for (const item of group.items) {
      const existing = await db
        .select()
        .from(groupPermissions)
        .where(and(eq(groupPermissions.groupId, repGroupId), eq(groupPermissions.permissionKey, item.permissionKey)));
      if (existing.length) continue;
      await db.insert(groupPermissions).values({
        groupId: repGroupId,
        permissionKey: item.permissionKey,
        label: item.label,
        category: "page",
        enabled: item.defaultEnabledForRep,
      });
    }
  }

  const fieldDefaults = [
    { key: "field.margin", label: "Margin figures", enabled: false },
    { key: "field.costPrice", label: "Cost price", enabled: false },
  ];
  for (const f of fieldDefaults) {
    const existing = await db
      .select()
      .from(groupPermissions)
      .where(and(eq(groupPermissions.groupId, repGroupId), eq(groupPermissions.permissionKey, f.key)));
    if (existing.length) continue;
    await db.insert(groupPermissions).values({
      groupId: repGroupId,
      permissionKey: f.key,
      label: f.label,
      category: "field",
      enabled: f.enabled,
    });
  }

  // Matches components/shell/RoleContext.tsx's `viewers` — the same two
  // identities LoginForm.tsx's "Use X" shortcuts already reference.
  const starters = [
    {
      email: "arjun.malhotra@lustre.example", name: "Arjun Malhotra", roleId: managementRoleId, groupId: managementGroupId,
      departmentId: deptIds.salesLeadership, marketId: marketIds.Global, ownerName: null,
    },
    {
      email: "priya.mehta@lustre.example", name: "Priya Mehta", roleId: repRoleId, groupId: repGroupId,
      departmentId: deptIds.europeDesk, marketId: marketIds.Belgium, ownerName: "Priya Mehta",
    },
  ];
  for (const s of starters) {
    const existing = await db.select().from(users).where(eq(users.email, s.email));
    if (existing.length) continue;
    await db.insert(users).values({
      email: s.email,
      passwordHash: await bcrypt.hash("changeme123", 10),
      name: s.name,
      roleId: s.roleId,
      groupId: s.groupId,
      permissionMode: "inherit",
      departmentId: s.departmentId,
      marketId: s.marketId,
      ownerName: s.ownerName,
    });
  }

  console.log("Seed complete.");
}

seed()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
