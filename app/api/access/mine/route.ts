import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import { groupPermissions, userPermissions } from "@/lib/db/schema";
import type { AppSessionUser } from "@/lib/sessionUser";
import { DEMO_REP_PERMISSIONS, isDemoMode } from "@/lib/demo";

export const dynamic = "force-dynamic";

/**
 * The signed-in user's own permission map — one fetch on shell mount, used
 * to filter navigation client-side. An isSystem group (Management) gets an
 * empty map back and the client treats `isSystem` as "everything allowed"
 * rather than pre-listing every key here. Otherwise the map comes from
 * `group_permissions` for the normal case, or this user's own
 * `user_permissions` when their `permissionMode` is "manual".
 */
export async function GET() {
  const session = await auth();
  const user = session?.user as unknown as AppSessionUser | undefined;
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  if (user.isSystem) {
    return NextResponse.json({ isSystem: true, permissions: {} });
  }
  if (isDemoMode()) return NextResponse.json({ isSystem: false, permissions: DEMO_REP_PERMISSIONS });

  const rows =
    user.permissionMode === "manual"
      ? await getDb()
          .select({ permissionKey: userPermissions.permissionKey, enabled: userPermissions.enabled })
          .from(userPermissions)
          .where(eq(userPermissions.userId, Number(user.id)))
      : await getDb()
          .select({ permissionKey: groupPermissions.permissionKey, enabled: groupPermissions.enabled })
          .from(groupPermissions)
          .where(eq(groupPermissions.groupId, user.groupId));

  const permissions = Object.fromEntries(rows.map((r) => [r.permissionKey, r.enabled]));
  return NextResponse.json({ isSystem: false, permissions });
}
