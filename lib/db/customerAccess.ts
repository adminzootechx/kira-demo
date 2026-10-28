import "server-only";

import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { clientKey } from "@/lib/clientKey";
import { getDb } from "./client";
import { getActiveBook } from "./repository";
import { groups, users } from "./schema";
import type { AppSessionUser } from "@/lib/sessionUser";
import { isDemoMode } from "@/lib/demo";
import { snapshotBook } from "@/lib/data/snapshot";

export type Viewer = { id: number; isSystem: boolean; scopeOwnData: boolean; ownerName: string | null };

/**
 * The signed-in user's access as it stands in the database right now, not as
 * it was stamped into the login token (which can be days old). A change of
 * group or salesperson name takes effect on the next request.
 */
export async function liveViewer(): Promise<Viewer | null> {
  const user = (await auth())?.user as unknown as AppSessionUser | undefined;
  if (!user) return null;
  // Demo accounts are fixed, so the login token is the live state.
  if (isDemoMode()) return { id: Number(user.id), isSystem: user.isSystem, scopeOwnData: user.scopeOwnData, ownerName: user.ownerName };
  const [row] = await getDb()
    .select({ isSystem: groups.isSystem, scopeOwnData: groups.scopeOwnData, ownerName: users.ownerName })
    .from(users)
    .innerJoin(groups, eq(users.groupId, groups.id))
    .where(eq(users.id, Number(user.id)));
  return row ? { id: Number(user.id), ...row } : null;
}

/**
 * Which customers a viewer may see. Management (and any group not limited to
 * its own data) sees everyone; a salesperson sees only customers handled by
 * their own salesperson name. A limited account with no salesperson name
 * linked sees nobody, never everybody.
 */
export type BookScope = { kind: "all" } | { kind: "own"; ownerName: string } | { kind: "none" };

export function scopeFor(v: Viewer): BookScope {
  if (v.isSystem || !v.scopeOwnData) return { kind: "all" };
  return v.ownerName?.trim() ? { kind: "own", ownerName: v.ownerName } : { kind: "none" };
}

export const sameOwner = (a: string | null | undefined, b: string) =>
  (a ?? "").trim().replace(/\s+/g, " ").toLowerCase() === b.trim().replace(/\s+/g, " ").toLowerCase();

/**
 * Whether the signed-in user may see this customer's transactions. Returns the
 * customer key, or null.
 */
export async function authorizeCustomer(name: string): Promise<{ key: string } | null> {
  if (!name.trim()) return null;
  const viewer = await liveViewer();
  if (!viewer) return null;
  const key = clientKey(name);
  const scope = scopeFor(viewer);
  if (scope.kind === "all") return { key };
  if (scope.kind === "none") return null;
  const book = (isDemoMode() ? null : await getActiveBook({ ownerName: scope.ownerName })) ?? snapshotBook();
  return book?.customers.some((c) => sameOwner(c.owner, scope.ownerName) && clientKey(c.name) === key) ? { key } : null;
}
