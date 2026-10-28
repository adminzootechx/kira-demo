import { NextResponse } from "next/server";
import { isDatabaseAvailable } from "@/lib/db/client";
import { liveViewer } from "@/lib/db/customerAccess";
import { ApprovalError, approvalsFor, createRequest } from "@/lib/db/approvals";

export const dynamic = "force-dynamic";

const fail = (e: unknown) => {
  if (e instanceof ApprovalError) return NextResponse.json({ error: e.message }, { status: e.status });
  console.error("[api/approvals]", e);
  return NextResponse.json({ error: "Something went wrong. Try again. (LUSTRE-DATA-2)" }, { status: 500 });
};

/** The signed-in user's own view: what they sent, what waits for them, what they decided. */
export async function GET() {
  if (!(await isDatabaseAvailable())) return NextResponse.json({ error: "Database unavailable. (LUSTRE-DATA-1)" }, { status: 503 });
  const viewer = await liveViewer();
  if (!viewer) return NextResponse.json({ error: "Not authorized. (LUSTRE-AUTH-2)" }, { status: 403 });
  try {
    return NextResponse.json(await approvalsFor(viewer));
  } catch (e) {
    return fail(e);
  }
}

/** Body: { typeId, note, amount?, customerKey?, customerName? } — always sent to the caller's own manager. */
export async function POST(request: Request) {
  if (!(await isDatabaseAvailable())) return NextResponse.json({ error: "Database unavailable. (LUSTRE-DATA-1)" }, { status: 503 });
  const viewer = await liveViewer();
  if (!viewer) return NextResponse.json({ error: "Not authorized. (LUSTRE-AUTH-2)" }, { status: 403 });
  const b = (await request.json().catch(() => ({}))) as {
    typeId?: unknown; note?: unknown; amount?: unknown; customerKey?: unknown; customerName?: unknown;
  };
  if (!Number.isInteger(b.typeId) || typeof b.note !== "string") {
    return NextResponse.json({ error: "Choose a request type and write a note." }, { status: 400 });
  }
  try {
    const id = await createRequest(viewer, {
      typeId: b.typeId as number,
      note: b.note,
      amount: typeof b.amount === "number" ? b.amount : null,
      customerKey: typeof b.customerKey === "string" ? b.customerKey : null,
      customerName: typeof b.customerName === "string" ? b.customerName : null,
    });
    return NextResponse.json({ id });
  } catch (e) {
    return fail(e);
  }
}
