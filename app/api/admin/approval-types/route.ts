import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/adminGuard";
import { isDatabaseAvailable } from "@/lib/db/client";
import { ApprovalError, createApprovalType, listApprovalTypes } from "@/lib/db/approvals";

export const dynamic = "force-dynamic";

async function guard() {
  if (!(await requireAdminSession())) return NextResponse.json({ error: "Not authorized. (LUSTRE-AUTH-2)" }, { status: 403 });
  if (!(await isDatabaseAvailable())) return NextResponse.json({ error: "Database unavailable. (LUSTRE-DATA-1)" }, { status: 503 });
  return null;
}

export async function GET() {
  const blocked = await guard();
  if (blocked) return blocked;
  return NextResponse.json({ types: await listApprovalTypes() });
}

/** Body: { name, needsAmount?, needsCustomer? } */
export async function POST(request: Request) {
  const blocked = await guard();
  if (blocked) return blocked;
  const b = (await request.json().catch(() => ({}))) as { name?: unknown; needsAmount?: unknown; needsCustomer?: unknown };
  if (typeof b.name !== "string") return NextResponse.json({ error: "Give the request type a name." }, { status: 400 });
  try {
    const id = await createApprovalType({ name: b.name, needsAmount: b.needsAmount === true, needsCustomer: b.needsCustomer === true });
    return NextResponse.json({ id });
  } catch (e) {
    if (e instanceof ApprovalError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
