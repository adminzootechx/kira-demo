import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/adminGuard";
import { isDatabaseAvailable } from "@/lib/db/client";
import { ApprovalError, updateApprovalType } from "@/lib/db/approvals";

export const dynamic = "force-dynamic";

/** Body: any of { name, needsAmount, needsCustomer, active }. Types are switched off, never deleted. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdminSession())) return NextResponse.json({ error: "Not authorized. (LUSTRE-AUTH-2)" }, { status: 403 });
  if (!(await isDatabaseAvailable())) return NextResponse.json({ error: "Database unavailable. (LUSTRE-DATA-1)" }, { status: 503 });
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Invalid request type id." }, { status: 400 });
  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    await updateApprovalType(id, {
      name: typeof b.name === "string" ? b.name : undefined,
      needsAmount: typeof b.needsAmount === "boolean" ? b.needsAmount : undefined,
      needsCustomer: typeof b.needsCustomer === "boolean" ? b.needsCustomer : undefined,
      active: typeof b.active === "boolean" ? b.active : undefined,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ApprovalError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
