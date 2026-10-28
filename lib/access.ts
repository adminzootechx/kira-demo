import "server-only";

import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { groupPermissions, userPermissions } from "@/lib/db/schema";
import { navigation } from "@/components/shell/nav";
import { DEMO_REP_PERMISSIONS, isDemoMode } from "@/lib/demo";

/**
 * Fail-safe: an `isSystem` group (Management) is always allowed — the one
 * group that can't be locked out by a permissions mistake. Otherwise, access
 * comes from `group_permissions` for the normal case, or from this specific
 * user's own `user_permissions` when their `permissionMode` is "manual" — a
 * full, independent matrix for that one user, not a partial override layered
 * on top of the group. Either way, missing row = denied, not "assume
 * visible" — an unseeded or mistyped key must never silently grant access,
 * and a brand-new group (or a user just switched to manual mode) starts with
 * nothing checked on.
 */
export async function hasAccess(
  user: { userId: number; groupId: number; isSystem: boolean; permissionMode: "inherit" | "manual" },
  permissionKey: string,
): Promise<boolean> {
  if (user.isSystem) return true;
  if (isDemoMode()) return DEMO_REP_PERMISSIONS[permissionKey] ?? false;

  if (user.permissionMode === "manual") {
    const [row] = await getDb()
      .select()
      .from(userPermissions)
      .where(and(eq(userPermissions.userId, user.userId), eq(userPermissions.permissionKey, permissionKey)));
    return row?.enabled ?? false;
  }

  const [row] = await getDb()
    .select()
    .from(groupPermissions)
    .where(and(eq(groupPermissions.groupId, user.groupId), eq(groupPermissions.permissionKey, permissionKey)));
  return row?.enabled ?? false;
}

/** href -> permissionKey, built from nav.ts itself so there is exactly one
 *  place a page's gating key is defined. */
export const PAGE_PERMISSION_KEYS: Record<string, string> = Object.fromEntries(
  navigation.flatMap((g) => g.items.map((i) => [i.href, i.permissionKey])),
);

/** permissionKey -> label, built from nav.ts itself — the Roles tab's
 *  permission matrix reads page names from here, never the raw key. */
export const PAGE_LABELS: Record<string, string> = Object.fromEntries(
  navigation.flatMap((g) => g.items.map((i) => [i.permissionKey, i.label])),
);
