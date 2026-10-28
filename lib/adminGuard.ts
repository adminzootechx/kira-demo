import "server-only";

import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import { groups, users } from "@/lib/db/schema";
import type { AppSessionUser } from "@/lib/sessionUser";
import { isDemoMode } from "@/lib/demo";

/**
 * Every /api/admin/* route calls this first. Gated on `isSystem` specifically,
 * never a regular assignable permission — letting a non-system role manage
 * roles/permissions would let it grant itself more access, which defeats the
 * point of having permissions at all.
 *
 * The session JWT's `isSystem` is stamped at login and can be up to 7 days
 * stale — an admin demoted to a regular role would otherwise keep full
 * access to every /api/admin/* route until they next sign in. This re-reads
 * the live value from the DB by user id instead of trusting the token, so a
 * demotion takes effect on the very next admin-panel request.
 */
export async function requireAdminSession(): Promise<AppSessionUser | null> {
  const session = await auth();
  const user = session?.user as unknown as AppSessionUser | undefined;
  if (!user) return null;
  if (isDemoMode()) return user.isSystem ? user : null;

  const [row] = await getDb()
    .select({ isSystem: groups.isSystem })
    .from(users)
    .innerJoin(groups, eq(users.groupId, groups.id))
    .where(eq(users.id, Number(user.id)));
  return row?.isSystem ? user : null;
}
