import { NextResponse } from "next/server";
import { isDatabaseAvailable } from "@/lib/db/client";
import { liveViewer } from "@/lib/db/customerAccess";
import { ApprovalError, cancelRequest, decideRequest } from "@/lib/db/approvals";

export const dynamic = "force-dynamic";

/** Body: { action: "approve" | "decline" | "cancel", note? }. Who may do what is enforced in the query itself. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isDatabaseAvailable())) return NextResponse.json({ error: "Database unavailable. (LUSTRE-DATA-1)" }, { status: 503 });
  const viewer = await liveViewer();
  if (!viewer) return NextResponse.json({ error: "Not authorized. (LUSTRE-AUTH-2)" }, { status: 403 });
  const id = Number((await params).id);
  const b = (await request.json().catch(() => ({}))) as { action?: unknown; note?: unknown };
  if (!Number.isInteger(id) || !["approve", "decline", "cancel"].includes(b.action as string)) {
    return NextResponse.json({ error: "Unknown request or action." }, { status: 400 });
  }
  try {
    if (b.action === "cancel") await cancelRequest(viewer, id);
    else await decideRequest(viewer, id, b.action === "approve", typeof b.note === "string" ? b.note : "");
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ApprovalError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("[api/approvals/:id]", e);
    return NextResponse.json({ error: "Something went wrong. Try again. (LUSTRE-DATA-2)" }, { status: 500 });
  }
}
