import { NextResponse } from "next/server";
import { isNotNull } from "drizzle-orm";
import { requireAdminSession } from "@/lib/adminGuard";
import { getDb, isDatabaseAvailable } from "@/lib/db/client";
import { assignClients, getActiveBook, getAssignments } from "@/lib/db/repository";
import { users } from "@/lib/db/schema";
import { clientKey } from "@/lib/clientKey";
import { isDemoMode } from "@/lib/demo";
import { snapshotBook } from "@/lib/data/snapshot";

export const dynamic = "force-dynamic";

export type AssignmentClient = {
  key: string; name: string; country: string; owner: string; assigned: boolean; ytd: number;
};
export type AssignmentsResponse = { reps: string[]; clients: AssignmentClient[] };

/**
 * Salesperson names as people should pick them: whitespace tidied, one entry
 * per person whatever the spelling case, and no codes or placeholders. Names
 * from user accounts come first, so the account's spelling wins.
 */
const norm = (s: string | null | undefined) => (s ?? "").trim().replace(/\s+/g, " ").toLowerCase();

function cleanReps(names: (string | null | undefined)[]): string[] {
  const seen = new Map<string, string>();
  for (const raw of names) {
    const name = (raw ?? "").trim().replace(/\s+/g, " ");
    if (!name || name.toLowerCase() === "unassigned" || /^\d+$/.test(name)) continue;
    const key = name.toLowerCase();
    if (!seen.has(key)) seen.set(key, name);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

async function knownReps(): Promise<string[]> {
  const [book, accounts] = await Promise.all([
    getActiveBook(),
    getDb().select({ name: users.ownerName }).from(users).where(isNotNull(users.ownerName)),
  ]);
  return cleanReps([...accounts.map((a) => a.name as string), ...(book?.customers ?? []).map((c) => c.owner)]);
}

async function guard() {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: "Not authorized. (LUSTRE-AUTH-2)" }, { status: 403 });
  }
  if (!(await isDatabaseAvailable())) {
    return NextResponse.json({ error: "Database unavailable. (LUSTRE-DATA-1)" }, { status: 503 });
  }
  return null;
}

export async function GET(request: Request) {
  const repsOnly = new URL(request.url).searchParams.has("repsOnly");
  // Demo mode: the salesperson list from the demo book, read-only.
  if (isDemoMode() && (await requireAdminSession())) {
    const book = snapshotBook();
    return NextResponse.json({ reps: cleanReps((book?.customers ?? []).map((c) => c.owner)), clients: [] } satisfies AssignmentsResponse);
  }
  const denied = await guard();
  if (denied) return denied;

  const [book, overrides, accounts] = await Promise.all([
    getActiveBook(),
    getAssignments(),
    getDb().select({ name: users.ownerName }).from(users).where(isNotNull(users.ownerName)),
  ]);
  const reps = cleanReps([...accounts.map((a) => a.name as string), ...(book?.customers ?? []).map((c) => c.owner)]);
  // Every client carries the one spelling of its salesperson's name, so
  // "Jane  Doe" and "Jane Doe" are one person in every list and count.
  const canonical = new Map(reps.map((r) => [norm(r), r]));
  const clients: AssignmentClient[] = (book?.customers ?? []).map((c) => ({
    key: clientKey(c.name), name: c.name, country: c.country, owner: canonical.get(norm(c.owner)) ?? c.owner,
    assigned: overrides.has(clientKey(c.name)), ytd: c.ytd,
  }));
  return NextResponse.json({ reps, clients: repsOnly ? [] : clients } satisfies AssignmentsResponse);
}

/**
 * Body, one of:
 *  - { keys: string[], owner: string | null }  assign those clients (null = back to the sales data's owner)
 *  - { from: string, to: string }              move every client currently with `from` to `to`
 */
export async function PUT(request: Request) {
  const denied = await guard();
  if (denied) return denied;

  const body = (await request.json().catch(() => ({}))) as {
    keys?: string[]; owner?: string | null; from?: string; to?: string;
  };

  let keys = body.keys;
  let owner = body.owner;
  if (body.from !== undefined && body.to) {
    // Unassigned clients have no one to move them from; they are moved by ticking them instead.
    if (!body.from.trim() || norm(body.from) === "unassigned") {
      return NextResponse.json({ error: "Choose a salesperson to move clients from." }, { status: 400 });
    }
    const book = await getActiveBook();
    keys = (book?.customers ?? []).filter((c) => norm(c.owner) === norm(body.from)).map((c) => clientKey(c.name));
    owner = body.to.trim();
  }
  if (!Array.isArray(keys) || !keys.length || owner === undefined || (owner !== null && !owner.trim())) {
    return NextResponse.json({ error: "Choose at least one client and a salesperson." }, { status: 400 });
  }
  if (owner !== null) {
    const match = (await knownReps()).find((r) => r.toLowerCase() === owner!.trim().replace(/\s+/g, " ").toLowerCase());
    if (!match) return NextResponse.json({ error: "That salesperson is not in the list." }, { status: 400 });
    owner = match;
  }
  await assignClients(keys, owner === null ? null : owner.trim());
  return NextResponse.json({ ok: true, moved: keys.length });
}
