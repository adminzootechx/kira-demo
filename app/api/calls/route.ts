import { NextResponse } from "next/server";
import { isDatabaseAvailable } from "@/lib/db/client";
import { authorizeCustomer, liveViewer } from "@/lib/db/customerAccess";
import { listCalls, logCall } from "@/lib/db/repository";

export const dynamic = "force-dynamic";

export type CallEntry = { key: string; outcome: "called" | "skipped"; at: string };

/** The signed-in user's own My day actions from the last 7 days. */
export async function GET() {
  if (!(await isDatabaseAvailable())) return NextResponse.json({ calls: [] });
  const viewer = await liveViewer();
  if (!viewer) return NextResponse.json({ error: "Not authorized. (LUSTRE-AUTH-2)" }, { status: 403 });
  const rows = await listCalls(viewer.id);
  return NextResponse.json({ calls: rows.map((r) => ({ key: r.key, outcome: r.outcome, at: r.at.toISOString() })) });
}

/**
 * Body: { customer: string, outcome: "called" | "skipped" | null }. Only for a
 * customer the caller may see, and only ever writes the caller's own row.
 */
export async function POST(request: Request) {
  if (!(await isDatabaseAvailable())) {
    return NextResponse.json({ error: "Database unavailable. (LUSTRE-DATA-1)" }, { status: 503 });
  }
  const viewer = await liveViewer();
  if (!viewer) return NextResponse.json({ error: "Not authorized. (LUSTRE-AUTH-2)" }, { status: 403 });
  const body = (await request.json().catch(() => ({}))) as { customer?: unknown; outcome?: unknown };
  const outcome = body.outcome === "called" || body.outcome === "skipped" ? body.outcome : body.outcome === null ? null : undefined;
  if (typeof body.customer !== "string" || outcome === undefined) {
    return NextResponse.json({ error: "Send a customer and an outcome." }, { status: 400 });
  }
  const access = await authorizeCustomer(body.customer);
  if (!access) return NextResponse.json({ error: "Not found." }, { status: 404 });
  await logCall(viewer.id, access.key, outcome);
  return NextResponse.json({ ok: true });
}
