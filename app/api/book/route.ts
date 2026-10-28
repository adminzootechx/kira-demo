import { NextResponse } from "next/server";
import { isDatabaseAvailable } from "@/lib/db/client";
import { getActiveBook, type ActiveBook } from "@/lib/db/repository";
import { activePauses } from "@/lib/db/customerNotes";
import { clientKey } from "@/lib/clientKey";
import { liveViewer, sameOwner, scopeFor, type BookScope } from "@/lib/db/customerAccess";
import { snapshotBook } from "@/lib/data/snapshot";
import { auth } from "@/lib/auth";
import type { AppSessionUser } from "@/lib/sessionUser";

/** Always hit the database — an active import can change between requests. */
export const dynamic = "force-dynamic";

/** Applies the viewer's scope to a book from any source, including the snapshot. */
function scoped(book: ActiveBook | null, scope: BookScope): ActiveBook | null {
  if (!book || scope.kind === "all") return book;
  if (scope.kind === "none") return { ...book, customers: [] };
  return { ...book, customers: book.customers.filter((c) => sameOwner(c.owner, scope.ownerName)) };
}

/**
 * The live customer book, limited to what the signed-in user may see:
 * everyone for management, only their own customers for a salesperson, and
 * nobody for a limited account with no salesperson name linked. Every page,
 * the notification bell and the search box read from this, so the scope here
 * is what keeps one salesperson from seeing another's customers.
 */
export async function GET() {
  const dbUp = await isDatabaseAvailable();
  const viewer = dbUp ? await liveViewer().catch(() => null) : null;
  if (dbUp && !viewer) return NextResponse.json({ error: "Not authorized. (LUSTRE-AUTH-2)" }, { status: 403 });
  // Without the database the live group cannot be read, so fall back to the
  // login token. It can only narrow access: a limited account still gets only
  // its own customers, and one with no salesperson name gets none.
  let scope: BookScope;
  if (viewer) scope = scopeFor(viewer);
  else {
    const user = (await auth())?.user as unknown as AppSessionUser | undefined;
    if (!user) return NextResponse.json({ error: "Not authorized. (LUSTRE-AUTH-2)" }, { status: 403 });
    scope = scopeFor({ id: Number(user.id), isSystem: user.isSystem, scopeOwnData: user.scopeOwnData, ownerName: user.ownerName });
  }

  if (dbUp) {
    try {
      const book =
        scope.kind === "own"
          ? await getActiveBook({ ownerName: scope.ownerName })
          : scoped(await getActiveBook(), scope);
      if (book) {
        // A note can pause a customer's alerts; the pause rides on the customer so every page agrees.
        const pauses = await activePauses().catch(() => new Map<string, string>());
        const customers = pauses.size ? book.customers.map((c) => ({ ...c, pausedUntil: pauses.get(clientKey(c.name)) ?? null })) : book.customers;
        return NextResponse.json({ book: { ...book, customers }, database: "connected" });
      }
    } catch (error) {
      console.error("[api/book]", error);
    }
  }

  const snapshot = scoped(snapshotBook(), scope);
  return NextResponse.json({
    book: snapshot,
    database: snapshot ? "snapshot" : "unavailable",
  });
}
