import { NextResponse } from "next/server";
import { isDatabaseAvailable } from "@/lib/db/client";
import { authorizeCustomer, liveViewer } from "@/lib/db/customerAccess";
import { addNote, listNotes, noteSummary, NoteError } from "@/lib/db/customerNotes";

export const dynamic = "force-dynamic";

/**
 * ?customer=<name>: every note on one customer the caller may see.
 * ?customers=<name>,<name>…: count and newest note for each, for the My day list.
 */
export async function GET(request: Request) {
  if (!(await isDatabaseAvailable())) return NextResponse.json({ notes: [], summary: [] });
  const viewer = await liveViewer();
  if (!viewer) return NextResponse.json({ error: "Not authorized. (LUSTRE-AUTH-2)" }, { status: 403 });
  const params = new URL(request.url).searchParams;

  const one = params.get("customer");
  if (one) {
    const access = await authorizeCustomer(one);
    if (!access) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json({ notes: await listNotes(access.key), me: viewer.id, isSystem: viewer.isSystem });
  }

  // Only customers the caller may see: each name is checked, so a guessed name returns nothing.
  const names = (params.get("customers") ?? "").split("|").filter(Boolean).slice(0, 300);
  const allowed: string[] = [];
  for (const n of names) {
    const a = await authorizeCustomer(n);
    if (a) allowed.push(a.key);
  }
  return NextResponse.json({ summary: await noteSummary(allowed) });
}

/** Body: { customer, body, pauseUntil? } — pauseUntil is YYYY-MM-DD, or leave out for no pause. */
export async function POST(request: Request) {
  if (!(await isDatabaseAvailable())) return NextResponse.json({ error: "Database unavailable. (LUSTRE-DATA-1)" }, { status: 503 });
  const viewer = await liveViewer();
  if (!viewer) return NextResponse.json({ error: "Not authorized. (LUSTRE-AUTH-2)" }, { status: 403 });
  const b = (await request.json().catch(() => ({}))) as { customer?: unknown; body?: unknown; pauseUntil?: unknown };
  if (typeof b.customer !== "string" || typeof b.body !== "string") {
    return NextResponse.json({ error: "Send a customer and a note." }, { status: 400 });
  }
  const access = await authorizeCustomer(b.customer);
  if (!access) return NextResponse.json({ error: "Not found." }, { status: 404 });
  try {
    const id = await addNote(viewer.id, access.key, b.body, typeof b.pauseUntil === "string" && b.pauseUntil ? b.pauseUntil : null);
    return NextResponse.json({ id });
  } catch (e) {
    if (e instanceof NoteError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
